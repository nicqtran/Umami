import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { fetchProfile } from '@/services/profile';
import { loadWeightEntriesFromDb } from '@/state/weight-log';
import { loadMealsFromDb } from '@/state/meals';
import { Text, View } from 'react-native';
import { useEffect, useRef } from 'react';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { user, loading } = useSupabaseAuth();
  const fetchedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const loadUserData = async () => {
      if (user && fetchedUserIdRef.current !== user.id) {
        fetchedUserIdRef.current = user.id;
        try {
          await Promise.all([
            fetchProfile(user.id),
            loadWeightEntriesFromDb(user.id),
            loadMealsFromDb(user.id),
          ]);
        } catch (e) {
          console.warn('Failed to load user data', e);
        }
      }
    };
    loadUserData();
  }, [user]);

  if (loading) {
    return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text>Loading...</Text>
        </View>
        <StatusBar style="auto" />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack initialRouteName={user ? '(tabs)' : 'index'}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding-flow" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
            gestureEnabled: false
          }}
        />
        <Stack.Screen
          name="meal-details"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="profile"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="account-details"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="day-details"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
