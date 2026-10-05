import { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { signUp } from '@/lib/auth';

export default function RegisterScreen() {
  const insets =
    useSafeAreaInsets();

  const [
    fullName,
    setFullName,
  ] = useState('');

  const [
    role,
    setRole,
  ] =
    useState<
      'student' | 'teacher'
    >('student');

  const [
    email,
    setEmail,
  ] = useState('');

  const [
    password,
    setPassword,
  ] = useState('');

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('');

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    confirmationRequired,
    setConfirmationRequired,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const cleanEmail =
    email
      .trim()
      .toLowerCase();

  const handleRegister =
    async () => {
      if (loading) {
        return;
      }

      setError(null);
      setConfirmationRequired(
        false
      );

      const cleanName =
        fullName.trim();

      if (
        !cleanName ||
        !cleanEmail ||
        !password ||
        !confirmPassword
      ) {
        setError(
          'Please fill in all fields.'
        );

        return;
      }

      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (
        !emailPattern.test(
          cleanEmail
        )
      ) {
        setError(
          'Please enter a valid email address.'
        );

        return;
      }

      if (
        password.length < 6
      ) {
        setError(
          'Password must be at least 6 characters.'
        );

        return;
      }

      if (
        password !==
        confirmPassword
      ) {
        setError(
          'Passwords do not match.'
        );

        return;
      }

      setLoading(true);

      try {
        const {
          data,
          error: authError,
        } = await signUp(
          cleanEmail,
          password,
          {
            full_name:
              cleanName,
            role,
          }
        );

        if (authError) {
          const message =
            authError.message
              ?.toLowerCase() ??
            '';

          if (
            message.includes(
              'user already registered'
            ) ||
            message.includes(
              'already registered'
            )
          ) {
            setError(
              'This email is already registered. Please sign in instead.'
            );
          } else if (
            message.includes(
              'rate limit'
            ) ||
            message.includes(
              'email rate limit'
            )
          ) {
            setError(
              'Too many requests have been made. Please wait and try again later.'
            );
          } else {
            setError(
              authError.message ||
                'Unable to create your account.'
            );
          }

          return;
        }

        if (!data.session) {
          setConfirmationRequired(
            true
          );
        }
      } catch (err) {
        console.error(
          '[REGISTER] Registration error:',
          err
        );

        setError(
          'An unexpected error occurred. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop:
            insets.top,
        },
      ]}
    >
      <KeyboardAvoidingView
        style={
          styles.keyboardView
        }
        behavior={
          Platform.OS ===
          'ios'
            ? 'padding'
            : Platform.OS ===
                'android'
              ? 'height'
              : undefined
        }
        keyboardVerticalOffset={
          Platform.OS ===
          'ios'
            ? 0
            : 20
        }
      >
        <TouchableWithoutFeedback
          onPress={
            Keyboard.dismiss
          }
        >
          <ScrollView
            contentContainerStyle={
              styles.scrollContent
            }
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={
              false
            }
          >
            <View
              style={
                styles.headerContainer
              }
            >
              <Header
                title="QR Attendance"
              />
            </View>

            <Text
              style={
                styles.title
              }
            >
              Create Account
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              Register to start
              recording attendance
            </Text>

            {confirmationRequired ? (
              <View
                style={
                  styles.successContainer
                }
              >
                <Text
                  style={
                    styles.successTitle
                  }
                >
                  Check your
                  email!
                </Text>

                <Text
                  style={
                    styles.successText
                  }
                >
                  We sent a
                  confirmation link
                  to {cleanEmail}.
                  {'\n\n'}
                  Open the email
                  and tap the
                  confirmation
                  link, then return
                  to the app and
                  sign in.
                </Text>

                <Link
                  href="/login"
                  style={
                    styles.link
                  }
                >
                  Back to Sign In
                </Link>
              </View>
            ) : (
              <View
                style={
                  styles.form
                }
              >
                <Text
                  style={
                    styles.label
                  }
                >
                  Full Name
                </Text>

                <TextInput
                  style={
                    styles.input
                  }
                  value={
                    fullName
                  }
                  onChangeText={
                    setFullName
                  }
                  placeholder="Enter your full name"
                  placeholderTextColor={
                    COLORS.textSecondary
                  }
                  autoCapitalize="words"
                  autoCorrect={
                    false
                  }
                  editable={
                    !loading
                  }
                  returnKeyType="next"
                />

                <Text
                  style={
                    styles.label
                  }
                >
                  I am a...
                </Text>

                <View
                  style={
                    styles.roleRow
                  }
                >
                  <Pressable
                    style={[
                      styles.roleChip,
                      role ===
                        'student' &&
                        styles.roleChipActive,
                    ]}
                    onPress={() =>
                      setRole(
                        'student'
                      )
                    }
                    disabled={
                      loading
                    }
                  >
                    <Text
                      style={[
                        styles.roleChipText,
                        role ===
                          'student' &&
                          styles.roleChipTextActive,
                      ]}
                    >
                      Student
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.roleChip,
                      role ===
                        'teacher' &&
                        styles.roleChipActive,
                    ]}
                    onPress={() =>
                      setRole(
                        'teacher'
                      )
                    }
                    disabled={
                      loading
                    }
                  >
                    <Text
                      style={[
                        styles.roleChipText,
                        role ===
                          'teacher' &&
                          styles.roleChipTextActive,
                      ]}
                    >
                      Teacher
                    </Text>
                  </Pressable>
                </View>

                <Text
                  style={
                    styles.label
                  }
                >
                  Email
                </Text>

                <TextInput
                  style={
                    styles.input
                  }
                  value={
                    email
                  }
                  onChangeText={
                    setEmail
                  }
                  placeholder="your.email@school.edu"
                  placeholderTextColor={
                    COLORS.textSecondary
                  }
                  autoCapitalize="none"
                  autoCorrect={
                    false
                  }
                  keyboardType="email-address"
                  editable={
                    !loading
                  }
                  returnKeyType="next"
                />

                <Text
                  style={
                    styles.label
                  }
                >
                  Password
                </Text>

                <TextInput
                  style={
                    styles.input
                  }
                  value={
                    password
                  }
                  onChangeText={
                    setPassword
                  }
                  placeholder="At least 6 characters"
                  placeholderTextColor={
                    COLORS.textSecondary
                  }
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={
                    false
                  }
                  editable={
                    !loading
                  }
                  returnKeyType="next"
                />

                <Text
                  style={
                    styles.label
                  }
                >
                  Confirm Password
                </Text>

                <TextInput
                  style={
                    styles.input
                  }
                  value={
                    confirmPassword
                  }
                  onChangeText={
                    setConfirmPassword
                  }
                  placeholder="Re-enter your password"
                  placeholderTextColor={
                    COLORS.textSecondary
                  }
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={
                    false
                  }
                  editable={
                    !loading
                  }
                  returnKeyType="done"
                  onSubmitEditing={
                    handleRegister
                  }
                />

                {error && (
                  <Text
                    style={
                      styles.error
                    }
                  >
                    {error}
                  </Text>
                )}

                {loading ? (
                  <ActivityIndicator
                    size="large"
                    color={
                      COLORS.primary
                    }
                    style={
                      styles.loader
                    }
                  />
                ) : (
                  <AppButton
                    theme="primary"
                    title="Sign Up"
                    icon="person-add-outline"
                    onPress={
                      handleRegister
                    }
                  />
                )}
              </View>
            )}

            {!confirmationRequired && (
              <Link
                href="/login"
                style={
                  styles.link
                }
              >
                Already have an
                account? Sign In
              </Link>
            )}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        COLORS.background,
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
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 16,
    },

    title: {
      fontSize: 28,
      fontWeight: '700',
      color:
        COLORS.textPrimary,
      marginBottom: 4,
    },

    subtitle: {
      fontSize: 15,
      color:
        COLORS.textSecondary,
      lineHeight: 21,
      marginBottom: 32,
    },

    form: {
      marginBottom: 24,
    },

    label: {
      fontSize: 14,
      fontWeight: '600',
      color:
        COLORS.textPrimary,
      marginBottom: 6,
      marginTop: 10,
    },

    input: {
      backgroundColor:
        COLORS.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color:
        COLORS.textPrimary,
    },

    roleRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 6,
    },

    roleChip: {
      flex: 1,
      alignItems: 'center',
      justifyContent:
        'center',
      borderRadius: 10,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      backgroundColor:
        COLORS.card,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },

    roleChipActive: {
      borderColor:
        COLORS.primary,
      backgroundColor:
        COLORS.primary + '14',
    },

    roleChipText: {
      fontSize: 14,
      fontWeight: '600',
      color:
        COLORS.textPrimary,
    },

    roleChipTextActive: {
      color: COLORS.primary,
      fontWeight: '700',
    },

    error: {
      fontSize: 14,
      color: COLORS.danger,
      marginTop: 12,
      marginBottom: 4,
    },

    loader: {
      marginVertical: 16,
    },

    link: {
      fontSize: 14,
      color: COLORS.primary,
      textAlign: 'center',
      fontWeight: '600',
    },

    successContainer: {
      alignItems: 'center',
      marginBottom: 24,
      padding: 20,
      backgroundColor:
        COLORS.card,
      borderRadius: 14,
    },

    successTitle: {
      fontSize: 18,
      fontWeight: '700',
      color:
        COLORS.textPrimary,
      marginBottom: 8,
    },

    successText: {
      fontSize: 14,
      color:
        COLORS.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 16,
    },
  });