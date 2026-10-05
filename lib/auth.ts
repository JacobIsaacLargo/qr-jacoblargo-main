import { useSyncExternalStore } from 'react';
import type {
  Session,
  User,
} from '@supabase/supabase-js';

import { supabase } from './supabase';

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

export type SignUpProfile = {
  full_name: string;
  role: 'student' | 'teacher';
};

let authState: AuthState = {
  session: null,
  user: null,
  loading: true,
};

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

function getSnapshot(): AuthState {
  return authState;
}

function updateAuthState(
  session: Session | null,
  loading = false
) {
  authState = {
    session,
    user: session?.user ?? null,
    loading,
  };

  notify();
}

export function setAuth(
  session: Session | null
) {
  updateAuthState(session, false);
}

export async function initializeAuth() {
  if (initialized) {
    return;
  }

  initialized = true;

  authState = {
    ...authState,
    loading: true,
  };

  notify();

  if (!authSubscription) {
    const {
      data: {
        subscription,
      },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        updateAuthState(session, false);
      }
    );

    authSubscription = subscription;
  }

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

      updateAuthState(null, false);
      return;
    }

    updateAuthState(
      data.session ?? null,
      false
    );
  } catch (error) {
    console.warn(
      '[AUTH] Session initialization failed:',
      error
    );

    updateAuthState(null, false);
  }
}

export function cleanupAuth() {
  authSubscription?.unsubscribe();

  authSubscription = null;
  initialized = false;

  authState = {
    session: null,
    user: null,
    loading: true,
  };

  notify();
}

export function useAuth(): AuthState {
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot
  );
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
            full_name:
              profile.full_name.trim(),
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

  if (data.session) {
    updateAuthState(
      data.session,
      false
    );
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
    updateAuthState(
      data.session,
      false
    );
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

  updateAuthState(
    null,
    false
  );

  return {
    error,
  };
}