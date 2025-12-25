import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { ToastProvider } from '@/components/toast-provider';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { fetchProfile } from '@/services/profile';
import { clearAccessStatusState, refreshAccessStatusState } from '@/state/access';
import { getDateId, loadMealsFromDb } from '@/state/meals';
import { loadWeightEntriesFromDb } from '@/state/weight-log';
import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { user, loading } = useSupabaseAuth();
  const fetchedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const loadUserData = async () => {
      if (!user) {
        clearAccessStatusState();
        return;
      }

      if (user && fetchedUserIdRef.current !== user.id) {
        fetchedUserIdRef.current = user.id;
        try {
          // First, get access status to know if user is Pro
          const [accessStatus] = await Promise.all([
            refreshAccessStatusState(),
            fetchProfile(user.id),
            loadWeightEntriesFromDb(user.id),
          ]);

          // Free users can only see past month of meal history
          // Note: TRIAL_EXPIRED and PRO_EXPIRED should NOT have full access
          const isPro = accessStatus?.state?.startsWith('PRO') && accessStatus?.state !== 'PRO_EXPIRED';
          const isTrial = accessStatus?.state?.startsWith('TRIAL') && accessStatus?.state !== 'TRIAL_EXPIRED';
          let mealHistoryLimit: string | undefined;

          if (!isPro && !isTrial) {
            // Limit to past 30 days for free users
            const limitDate = new Date();
            limitDate.setDate(limitDate.getDate() - 30);
            mealHistoryLimit = getDateId(limitDate);
          }

          await loadMealsFromDb(user.id, mealHistoryLimit);
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
      <ToastProvider>
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
          <Stack.Screen
            name="upgrade"
            options={{ headerShown: false }}
          />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ToastProvider>
    </ThemeProvider>
  );
}
