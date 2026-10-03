import { useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import type {
  Session,
  User,
} from '@supabase/supabase-js';

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

let authSubscription: {
  unsubscribe: () => void;
} | null = null;

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

function setGlobalAuth(
  session: Session | null
) {
  globalSession = session;
  globalUser = session?.user ?? null;
  globalLoading = false;

  notify();
}

export function setAuth(
  session: Session | null
) {
  setGlobalAuth(session);
}

export async function initializeAuth() {
  if (initialized) {
    return;
  }

  initialized = true;
  globalLoading = true;

  notify();

  try {
    const {
      data,
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.warn(
        '[AUTH] Failed to restore session:',
        error.message
      );

      setGlobalAuth(null);
    } else {
      setGlobalAuth(data.session);
    }
  } catch (error) {
    console.warn(
      '[AUTH] Session initialization failed:',
      error
    );

    setGlobalAuth(null);
  }

  if (!authSubscription) {
    const {
      data: {
        subscription,
      },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setGlobalAuth(session);
      }
    );

    authSubscription = subscription;
  }
}

export function cleanupAuth() {
  authSubscription?.unsubscribe();

  authSubscription = null;
  initialized = false;
}

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

export async function signUp(
  email: string,
  password: string,
  profile?: SignUpProfile
) {
  const normalizedEmail =
    email.trim().toLowerCase();

  const {
    data,
    error,
  } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,

    options: {
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
   * Email confirmation is disabled
   * in Supabase.
   */
  if (data.session) {
    setGlobalAuth(data.session);
  }

  /*
   * Update the profile with the
   * information entered during signup.
   */
  if (data.session && profile) {
    const {
      error: profileError,
    } = await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        role: profile.role,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        data.session.user.id
      );

    if (profileError) {
      console.warn(
        '[AUTH] Profile update failed:',
        profileError.message
      );
    }
  }

  return {
    data,
    error: null,
  };
}

export async function signIn(
  email: string,
  password: string
) {
  const normalizedEmail =
    email.trim().toLowerCase();

  const {
    data,
    error,
  } =
    await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

  if (
    !error &&
    data.session
  ) {
    setGlobalAuth(data.session);
  }

  return {
    data,
    error,
  };
}

export async function signOut() {
  const {
    error,
  } = await supabase.auth.signOut();

  setGlobalAuth(null);

  return {
    error,
  };
}