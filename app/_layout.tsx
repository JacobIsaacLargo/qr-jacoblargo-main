import { useEffect } from 'react';

import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';

import { Stack } from 'expo-router';

import { COLORS } from '@/constants/colors';

import {
  initializeAuth,
  useAuth,
} from '@/lib/auth';

export default function RootLayout() {
  const {
    session,
    loading,
  } = useAuth();

  /*
   * Start Supabase authentication once
   * when the root layout mounts.
   *
   * This restores:
   * - saved login sessions
   * - email confirmation sessions
   * - authentication changes
   */
  useEffect(() => {
    void initializeAuth();
  }, []);

  /*
   * Don't decide whether the user is logged
   * in until Supabase has finished restoring
   * the saved session.
   */
  if (loading) {
    return (
      <View
        style={styles.loadingContainer}
      >
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />

        <View
          style={styles.loadingSpacer}
        />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      {/*
       * Logged-out screens.
       */}
      <Stack.Protected
        guard={!session}
      >
        <Stack.Screen
          name="login"
        />

        <Stack.Screen
          name="register"
        />
      </Stack.Protected>

      {/*
       * Logged-in screens.
       */}
      <Stack.Protected
        guard={!!session}
      >
        <Stack.Screen
          name="(tabs)"
        />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      COLORS.background,
  },

  /*
   * Gives the spinner some breathing room
   * without adding another text dependency.
   */
  loadingSpacer: {
    height: 12,
  },
});