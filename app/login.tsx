import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { signIn } from '@/lib/auth';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return;

    setError(null);
    setLoading(true);

    try {
      const { error: authError } = await signIn(
        email.trim(),
        password
      );

      if (authError) {
        setError(authError.message);
      }
    } catch (err: any) {
      setError(err?.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top },
      ]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === 'web'
              ? undefined
              : 'on-drag'
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContainer}>
            <Header title="QR Attendance" />
          </View>

          <Text style={styles.title}>
            Welcome Back
          </Text>

          <Text style={styles.subtitle}>
            Sign in to record your attendance
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>
              Email
            </Text>

            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your.email@school.edu"
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!loading}
              returnKeyType="next"
            />

            <Text style={styles.label}>
              Password
            </Text>

            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={COLORS.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            {error && (
              <Text style={styles.error}>
                {error}
              </Text>
            )}

            <View style={styles.signInContainer}>
              {loading ? (
                <ActivityIndicator
                  size="large"
                  color={COLORS.primary}
                  style={styles.loader}
                />
              ) : (
                <AppButton
                  theme="primary"
                  title="Sign In"
                  icon="log-in-outline"
                  onPress={handleLogin}
                />
              )}
            </View>
          </View>

          <Link
            href="/register"
            style={styles.link}
          >
            Don't have an account? Sign Up
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  headerContainer: {
    marginBottom: 20,
  },

  title: {
    fontSize: 30,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 20,
  },

  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 8,
    marginBottom: 30,
  },

  form: {
    width: '100%',
  },

  label: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
    marginTop: 16,
  },

  input: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
    minHeight: 48,
  },

  error: {
    color: '#D32F2F',
    fontSize: 14,
    marginTop: 12,
  },

  signInContainer: {
    marginTop: 24,
  },

  loader: {
    marginVertical: 10,
  },

  link: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 15,
    color: COLORS.primary,
  },
});