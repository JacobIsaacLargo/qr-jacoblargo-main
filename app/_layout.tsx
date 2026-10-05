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

  useEffect(() => {
    void initializeAuth();
  }, []);

  if (loading) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
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
});