import {
  useFonts,
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
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

export default function SignUpScreen() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<null | 'name' | 'email' | 'password'>(null);

  const canProceed = email.trim().length > 0 && password.trim().length >= 8;

  const handleNext = () => {
    if (!canProceed) {
      Alert.alert('Add details', 'Please enter an email and an 8+ character password.');
      return;
    }
    router.replace('/(tabs)');
  };

  const titleFont = fontsLoaded ? styles.titleLoaded : null;
  const labelFont = fontsLoaded ? styles.labelLoaded : null;
  const bodyFont = fontsLoaded ? styles.bodyLoaded : null;
  const lightFont = fontsLoaded ? styles.lightLoaded : null;

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

          <Text style={[styles.title, titleFont]}>Sign up</Text>

          <View style={styles.field}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Preferred name (Optional)"
              placeholderTextColor="#88939e"
              onFocus={() => setFocused('name')}
              onBlur={() => setFocused(null)}
              style={[
                styles.input,
                focused === 'name' && styles.inputFocused,
                bodyFont,
              ]}
            />
          </View>

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
              style={[
                styles.input,
                focused === 'email' && styles.inputFocused,
                bodyFont,
              ]}
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
              style={[
                styles.passwordInput,
                focused === 'password' && styles.inputFocused,
                bodyFont,
              ]}
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}>
              <Text style={[styles.toggleText, labelFont]}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>
          </View>

          <Text style={[styles.legal, lightFont]}>
            By signing up, you agree to Umami&apos;s{' '}
            <Text style={styles.link} onPress={() => Alert.alert('Terms of Use')}>
              Terms of Use
            </Text>{' '}
            and{' '}
            <Text style={styles.link} onPress={() => Alert.alert('Privacy Policy')}>
              Privacy Policy
            </Text>
            .
          </Text>

          <Pressable
            onPress={handleNext}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
            <Text style={[styles.ctaLabel, titleFont]}>Next</Text>
          </Pressable>

          <Text style={[styles.footerText, bodyFont]}>
            Already have an account?{' '}
            <Text style={styles.link} onPress={() => router.push('/login')}>
              Sign in
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
    padding: 22,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingHorizontal: 30,
    paddingVertical: 28,
    gap: 20,
    shadowColor: '#0b1635',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  illustrationWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  illustration: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 26,
    color: navy,
    fontWeight: '700',
    letterSpacing: 0.15,
    textAlign: 'center',
    marginBottom: 16,
  },
  field: {
    gap: 8,
  },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E5EA',
    paddingHorizontal: 14,
    backgroundColor: '#FCFCFD',
    fontSize: 16,
    fontWeight: '400',
    color: navy,
  },
  inputFocused: {
    borderColor: '#A5B4FC',
    shadowColor: '#A5B4FC',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    backgroundColor: '#ffffff',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E5EA',
    backgroundColor: '#FCFCFD',
    paddingRight: 12,
  },
  passwordInput: {
    flex: 1,
    height: 52,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '400',
    color: navy,
  },
  toggle: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 44,
    alignItems: 'center',
  },
  togglePressed: {
    opacity: 0.7,
  },
  toggleText: {
    color: navy,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  legal: {
    fontSize: 13.5,
    color: navy,
    opacity: 0.6,
    lineHeight: 20,
  },
  link: {
    color: '#4A64EF',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  cta: {
    backgroundColor: indigo,
    borderRadius: 16,
    paddingVertical: 16,
    minHeight: 54,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#0b1635',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  ctaPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
    backgroundColor: '#334a5a',
  },
  ctaLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 14,
    color: navy,
    opacity: 0.85,
    marginTop: 14,
  },
  titleLoaded: {
    fontFamily: 'Inter_700Bold',
  },
  labelLoaded: {
    fontFamily: 'Inter_500Medium',
  },
  bodyLoaded: {
    fontFamily: 'Inter_400Regular',
  },
  lightLoaded: {
    fontFamily: 'Inter_300Light',
  },
});
