import { useFonts, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
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

  const labelFont = fontsLoaded ? styles.labelLoaded : null;
  const bodyFont = fontsLoaded ? styles.bodyLoaded : null;
  const titleFont = fontsLoaded ? styles.titleLoaded : null;

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
              if (email.trim() && password.trim()) {
                router.replace('/(tabs)');
              } else {
                Alert.alert('Log in', 'Please enter your email and password.');
              }
            }}
            style={({ pressed }) => [
              styles.cta,
              pressed && styles.ctaPressed,
            ]}>
            <Text style={[styles.ctaLabel, titleFont]}>Log in</Text>
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
  bodyLoaded: {
    fontFamily: 'Inter_400Regular',
  },
  titleLoaded: {
    fontFamily: 'Inter_600SemiBold',
  },
});
