import { useSyncExternalStore } from 'react';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

export type SignUpProfile = {
  full_name: string;
  role: 'student' | 'teacher';
};

let globalSession: Session | null = null;
let globalUser: User | null = null;
let globalLoading = true;

const listeners = new Set<() => void>();

let initialized = false;
let authSubscription: { unsubscribe: () => void } | null = null;
let linkingSubscription: { remove: () => void } | null = null;

function notify() {
  listeners.forEach((listener) => {
    listener();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return globalSession;
}

function setGlobalAuth(session: Session | null) {
  globalSession = session;
  globalUser = session?.user ?? null;
  globalLoading = false;

  notify();
}

export function setAuth(session: Session | null) {
  setGlobalAuth(session);
}

/**
 * Extracts Supabase authentication information from a deep-link URL.
 *
 * Supports:
 *   qr-attendance://auth/callback?code=...
 *
 * and:
 *   qr-attendance://auth/callback#access_token=...&refresh_token=...
 */
async function handleAuthUrl(url: string | null) {
  if (!url) {
    return;
  }

  try {
    const parsed = Linking.parse(url);

    const queryParams = parsed.queryParams ?? {};

    /*
     * PKCE flow:
     *
     * ?code=xxxxxxxx
     */
    const code =
      typeof queryParams.code === 'string'
        ? queryParams.code
        : null;

    if (code) {
      const { data, error } =
        await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.warn(
          '[AUTH] Failed to exchange confirmation code:',
          error.message
        );
        return;
      }

      if (data.session) {
        setGlobalAuth(data.session);
      }

      return;
    }

    /*
     * Implicit flow:
     *
     * #access_token=...
     * &refresh_token=...
     */
    const hashIndex = url.indexOf('#');

    if (hashIndex !== -1) {
      const hash = url.substring(hashIndex + 1);
      const hashParams = new URLSearchParams(hash);

      const accessToken =
        hashParams.get('access_token');

      const refreshToken =
        hashParams.get('refresh_token');

      if (accessToken && refreshToken) {
        const { data, error } =
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

        if (error) {
          console.warn(
            '[AUTH] Failed to create session from confirmation link:',
            error.message
          );
          return;
        }

        if (data.session) {
          setGlobalAuth(data.session);
        }
      }
    }
  } catch (error) {
    console.warn(
      '[AUTH] Failed to process authentication URL:',
      error
    );
  }
}

/**
 * Initializes Supabase authentication.
 *
 * This:
 * - Restores an existing saved session.
 * - Listens for login/logout/token refresh.
 * - Handles email confirmation deep links.
 */
export async function initializeAuth() {
  if (initialized) {
    return;
  }

  initialized = true;
  globalLoading = true;
  notify();

  try {
    /*
     * First restore the session stored by Supabase.
     */
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.warn(
        '[AUTH] Failed to restore session:',
        error.message
      );
    }

    setGlobalAuth(session);
  } catch (error) {
    console.warn(
      '[AUTH] Session initialization failed:',
      error
    );

    setGlobalAuth(null);
  }

  /*
   * Listen for future authentication changes.
   */
  if (!authSubscription) {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setGlobalAuth(session);
      }
    );

    authSubscription = subscription;
  }

  /*
   * Handle a confirmation link that opened the app
   * from a completely closed state.
   */
  try {
    const initialUrl = await Linking.getInitialURL();

    if (initialUrl) {
      await handleAuthUrl(initialUrl);
    }
  } catch (error) {
    console.warn(
      '[AUTH] Failed to read initial deep link:',
      error
    );
  }

  /*
   * Handle confirmation links when the app is already open.
   */
  if (!linkingSubscription) {
    linkingSubscription = Linking.addEventListener(
      'url',
      ({ url }) => {
        void handleAuthUrl(url);
      }
    );
  }
}

/**
 * Optional cleanup.
 *
 * Usually the root layout remains mounted for the lifetime
 * of the app, so this does not normally need to be called.
 */
export function cleanupAuth() {
  authSubscription?.unsubscribe();
  authSubscription = null;

  linkingSubscription?.remove();
  linkingSubscription = null;

  initialized = false;
}

/**
 * React hook used throughout the application.
 */
export function useAuth(): AuthState {
  const session = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot
  );

  return {
    session,
    user: session?.user ?? globalUser,
    loading: globalLoading,
  };
}

/**
 * Register a new user.
 *
 * The profile information is placed in Supabase Auth metadata.
 * The database trigger reads that metadata and creates the
 * profile correctly even when email confirmation is required.
 */
export async function signUp(
  email: string,
  password: string,
  profile?: SignUpProfile
) {
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } =
    await supabase.auth.signUp({
      email: normalizedEmail,
      password,

      options: {
        /*
         * IMPORTANT:
         *
         * Add this exact URL to:
         *
         * Supabase Dashboard
         * -> Authentication
         * -> URL Configuration
         * -> Redirect URLs
         *
         * qr-attendance://auth/callback
         */
        emailRedirectTo:
          'qr-attendance://auth/callback',

        /*
         * Supabase stores these values inside
         * auth.users.raw_user_meta_data.
         *
         * The SQL trigger below uses them to create
         * the correct profile.
         */
        data: profile
          ? {
              full_name: profile.full_name,
              role: profile.role,
            }
          : undefined,
      },
    });

  if (error) {
    return {
      data,
      error,
    };
  }

  /*
   * If email confirmation is disabled, Supabase may return
   * a session immediately.
   *
   * The SQL trigger has already created the profile,
   * but we update it here as an extra safeguard.
   */
  if (data.session && profile) {
    const { error: profileError } =
      await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          role: profile.role,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.session.user.id);

    if (profileError) {
      console.warn(
        '[AUTH] Profile update failed:',
        profileError.message
      );
    }
  }

  if (data.session) {
    setGlobalAuth(data.session);
  }

  return {
    data,
    error: null,
  };
}

/**
 * Sign in with email and password.
 */
export async function signIn(
  email: string,
  password: string
) {
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

  if (!error && data.session) {
    setGlobalAuth(data.session);
  }

  return {
    data,
    error,
  };
}

/**
 * Sign out.
 */
export async function signOut() {
  const { error } =
    await supabase.auth.signOut();

  /*
   * Clear local application state regardless of
   * whether Supabase returned an error.
   */
  setGlobalAuth(null);

  return {
    error,
  };
}