import { useFonts, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { makeRedirectUri } from 'expo-auth-session';

// Required for web browser auth to complete properly
WebBrowser.maybeCompleteAuthSession();

const background = '#f5f6fa';
const navy = '#2f3c46';
const indigo = '#3c5566';

export default function LoginScreen() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<null | 'email' | 'password'>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const labelFont = fontsLoaded ? styles.labelLoaded : null;
  const bodyFont = fontsLoaded ? styles.bodyLoaded : null;
  const titleFont = fontsLoaded ? styles.titleLoaded : null;

  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      
      // Create the redirect URI for Expo
      const redirectUri = makeRedirectUri({
        scheme: 'umami', // Your app scheme - add this to app.json
        path: 'auth/callback',
      });

      // Get the OAuth URL from Supabase
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      if (!data.url) {
        Alert.alert('Error', 'Could not get authentication URL');
        return;
      }

      // Open the browser for OAuth
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUri,
        {
          showInRecents: true,
        }
      );

      if (result.type === 'success' && result.url) {
        // Extract the tokens from the URL
        const url = new URL(result.url);
        const params = new URLSearchParams(url.hash.substring(1)); // Remove # from hash
        
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken) {
          // Set the session with the tokens
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (sessionError) {
            Alert.alert('Error', sessionError.message);
            return;
          }

          // Navigate to main app
          router.replace('/(tabs)');
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Log in', 'Please enter your email and password.');
      return;
    }
    try {
      setSubmitting(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });
      if (error) {
        Alert.alert('Login failed', error.message);
        return;
      }
      router.replace('/(tabs)');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" backgroundColor={background} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.illustrationWrap}>
            <Image
              source={require('@/assets/images/umami logo.png')}
              style={styles.illustration}
              contentFit="contain"
            />
          </View>
          <Text style={[styles.title, titleFont]}>Log in</Text>

          <View style={styles.field}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="#88939e"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              returnKeyType="next"
              style={[styles.input, focused === 'email' && styles.inputFocused, bodyFont]}
            />
          </View>

          <View style={styles.field}>
            <View style={styles.passwordRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor="#88939e"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (email.trim() && password.trim() && !submitting) {
                    handleLogin();
                  }
                }}
                style={[styles.passwordInput, focused === 'password' && styles.inputFocused, bodyFont]}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}>
                <Text style={[styles.toggleText, labelFont]}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>
          </View>

          <Pressable onPress={() => Alert.alert('Reset password')} style={styles.forgot}>
            <Text style={[styles.forgotText, labelFont]}>Forgot password?</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              if (!submitting) handleLogin();
            }}
            disabled={submitting}
            style={({ pressed }) => [
              styles.cta,
              pressed && styles.ctaPressed,
              submitting && styles.ctaDisabled,
            ]}>
            <Text style={[styles.ctaLabel, titleFont]}>{submitting ? 'Logging in...' : 'Log in'}</Text>
          </Pressable>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={[styles.dividerText, bodyFont]}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Sign-In Button */}
          <Pressable
            onPress={handleGoogleSignIn}
            disabled={googleLoading}
            style={({ pressed }) => [
              styles.googleButton,
              pressed && styles.googleButtonPressed,
              googleLoading && styles.ctaDisabled,
            ]}>
            {googleLoading ? (
              <ActivityIndicator size="small" color={navy} />
            ) : (
              <>
                <Image
                  source={{ uri: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg' }}
                  style={styles.googleIcon}
                  contentFit="contain"
                />
                <Text style={[styles.googleButtonText, labelFont]}>Continue with Google</Text>
              </>
            )}
          </Pressable>

          <Text style={[styles.footerText, bodyFont]}>
            New to Umami?{' '}
            <Text style={styles.link} onPress={() => router.push('/signup')}>
              Sign up
            </Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: background,
  },
  scroll: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 26,
    gap: 18,
    shadowColor: '#0f1c2c',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  illustrationWrap: {
    alignItems: 'center',
    marginBottom: 4,
  },
  illustration: {
    width: 76,
    height: 76,
  },
  title: {
    fontSize: 26,
    color: navy,
    fontWeight: '600',
    letterSpacing: 0.1,
    textAlign: 'center',
    marginBottom: 6,
  },
  field: {
    gap: 8,
  },
  input: {
    height: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe1e7',
    paddingHorizontal: 14,
    backgroundColor: '#f9fafb',
    fontSize: 16,
    fontWeight: '500',
    color: navy,
  },
  inputFocused: {
    borderColor: indigo,
    shadowColor: indigo,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    backgroundColor: '#ffffff',
  },
  forgot: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    color: navy,
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe1e7',
    backgroundColor: '#f9fafb',
    paddingRight: 10,
  },
  passwordInput: {
    flex: 1,
    height: 54,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '500',
    color: navy,
  },
  toggle: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  togglePressed: {
    opacity: 0.7,
  },
  toggleText: {
    color: navy,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  cta: {
    backgroundColor: indigo,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#0b1635',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  ctaPressed: {
    transform: [{ translateY: 1 }],
    backgroundColor: '#334a5a',
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 14,
    color: navy,
    opacity: 0.85,
    marginTop: 4,
  },
  link: {
    color: navy,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#dbe1e7',
  },
  dividerText: {
    color: '#88939e',
    fontSize: 13,
    fontWeight: '500',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#dbe1e7',
    shadowColor: '#0b1635',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  googleButtonPressed: {
    backgroundColor: '#f5f6fa',
    transform: [{ translateY: 1 }],
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  googleButtonText: {
    color: navy,
    fontSize: 15,
    fontWeight: '600',
  },
  bodyLoaded: {
    fontFamily: 'Inter_400Regular',
  },
  titleLoaded: {
    fontFamily: 'Inter_600SemiBold',
  },
  labelLoaded: {
    fontFamily: 'Inter_500Medium',
  },
});
