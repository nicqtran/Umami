import { useFonts, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@/lib/supabase';

// Required for web browser auth to complete properly
WebBrowser.maybeCompleteAuthSession();

const background = '#f5f6fa';
const navy = '#3f5a6d';

export default function OnboardingScreen() {
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [fontsLoaded] = useFonts({
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      
      const redirectUri = makeRedirectUri({
        scheme: 'umami',
        path: 'auth/callback',
      });

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

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUri,
        { showInRecents: true }
      );

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const params = new URLSearchParams(url.hash.substring(1));
        
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (sessionError) {
            Alert.alert('Error', sessionError.message);
            return;
          }

          // Navigate to onboarding flow for new users or main app
          router.replace('/(tabs)');
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" backgroundColor={background} />
      <View style={styles.container}>
        <View style={styles.hero}>
          <Image
            source={require('@/assets/images/image-clean.png')}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={[styles.subtitle, fontsLoaded && styles.subtitleLoaded]}>Flavor, Found.</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => router.push('/signup')}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}>
            <Text style={[styles.primaryLabel, fontsLoaded && styles.primaryLabelLoaded]}>Sign Up</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/login')}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}>
            <Text style={[styles.secondaryLabel, fontsLoaded && styles.secondaryLabelLoaded]}>Log in</Text>
          </Pressable>

          <Pressable
            onPress={handleGoogleSignIn}
            disabled={googleLoading}
            style={({ pressed }) => [
              styles.googleButton, 
              pressed && styles.buttonPressed,
              googleLoading && styles.buttonDisabled
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
                <Text style={[styles.googleLabel, fontsLoaded && styles.googleLabelLoaded]}>
                  Continue with Google
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 26,
    gap: 44,
  },
  hero: {
    alignItems: 'center',
    gap: 18,
    transform: [{ translateY: 120 }],
  },
  logo: {
    width: 320,
    height: 320,
  },
  subtitle: {
    fontSize: 18,
    color: navy,
    opacity: 0.8,
    letterSpacing: 0.2,
    fontWeight: '600',
  },
  actions: {
    width: '100%',
    gap: 14,
    marginTop: 32,
  },
  primaryButton: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#e9eaed',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d3d6da',
  },
  googleButton: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#d6d8db',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    minHeight: 52,
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryLabel: {
    fontSize: 18,
    color: navy,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  secondaryLabel: {
    fontSize: 17,
    color: navy,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  googleLabel: {
    fontSize: 16,
    color: navy,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  googleGlyph: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f6f7f8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d6d8db',
  },
  googleGlyphText: {
    color: '#e43f3a',
    fontWeight: '700',
    fontSize: 15,
  },
  subtitleLoaded: {
    fontFamily: 'Inter_600SemiBold',
  },
  primaryLabelLoaded: {
    fontFamily: 'Inter_700Bold',
  },
  secondaryLabelLoaded: {
    fontFamily: 'Inter_700Bold',
  },
  googleLabelLoaded: {
    fontFamily: 'Inter_600SemiBold',
  },
  googleGlyphLoaded: {
    fontFamily: 'Inter_700Bold',
  },
  buttonPressed: {
    transform: [{ translateY: 1 }],
    opacity: 0.92,
  },
});
