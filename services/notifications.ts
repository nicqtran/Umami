import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATIONS_ENABLED_KEY = '@notifications_enabled';
const NOTIFICATION_TIMES_KEY = '@notification_times';

export type MealReminder = {
  id: string;
  label: string;
  hour: number;
  minute: number;
  enabled: boolean;
};

// Default meal reminder times
const DEFAULT_REMINDERS: MealReminder[] = [
  { id: 'breakfast', label: 'Breakfast', hour: 8, minute: 0, enabled: true },
  { id: 'lunch', label: 'Lunch', hour: 12, minute: 30, enabled: true },
  { id: 'dinner', label: 'Dinner', hour: 18, minute: 30, enabled: true },
];

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions
 */
export async function requestPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  // Required for Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('meal-reminders', {
      name: 'Meal Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B00',
    });
  }

  return true;
}

/**
 * Get notification permission status
 */
export async function getPermissionStatus(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/**
 * Check if notifications are enabled by user
 */
export async function areNotificationsEnabled(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

/**
 * Enable or disable notifications
 */
export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? 'true' : 'false');
  
  if (enabled) {
    await scheduleAllReminders();
  } else {
    await cancelAllReminders();
  }
}

/**
 * Get meal reminder settings
 */
export async function getMealReminders(): Promise<MealReminder[]> {
  try {
    const value = await AsyncStorage.getItem(NOTIFICATION_TIMES_KEY);
    if (value) {
      return JSON.parse(value);
    }
  } catch {
    // Fall through to defaults
  }
  return DEFAULT_REMINDERS;
}

/**
 * Save meal reminder settings
 */
export async function saveMealReminders(reminders: MealReminder[]): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATION_TIMES_KEY, JSON.stringify(reminders));
  
  const enabled = await areNotificationsEnabled();
  if (enabled) {
    await scheduleAllReminders();
  }
}

/**
 * Update a single meal reminder
 */
export async function updateMealReminder(
  id: string,
  updates: Partial<Omit<MealReminder, 'id'>>
): Promise<void> {
  const reminders = await getMealReminders();
  const updated = reminders.map(r => 
    r.id === id ? { ...r, ...updates } : r
  );
  await saveMealReminders(updated);
}

/**
 * Schedule all enabled reminders
 */
export async function scheduleAllReminders(): Promise<void> {
  // Cancel existing reminders first
  await cancelAllReminders();
  
  const hasPermission = await getPermissionStatus();
  if (!hasPermission) return;
  
  const enabled = await areNotificationsEnabled();
  if (!enabled) return;
  
  const reminders = await getMealReminders();
  
  for (const reminder of reminders) {
    if (reminder.enabled) {
      await scheduleReminder(reminder);
    }
  }
}

/**
 * Schedule a single reminder
 */
async function scheduleReminder(reminder: MealReminder): Promise<void> {
  const messages = [
    `Time to log your ${reminder.label.toLowerCase()}! 📸`,
    `Don't forget to track your ${reminder.label.toLowerCase()} 🍽️`,
    `${reminder.label} time! Keep your streak going 🔥`,
    `Ready to log ${reminder.label.toLowerCase()}? 📝`,
  ];
  
  const randomMessage = messages[Math.floor(Math.random() * messages.length)];
  
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${reminder.label} Reminder`,
      body: randomMessage,
      sound: true,
      data: { type: 'meal-reminder', mealType: reminder.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: reminder.hour,
      minute: reminder.minute,
      channelId: Platform.OS === 'android' ? 'meal-reminders' : undefined,
    },
    identifier: `meal-reminder-${reminder.id}`,
  });
}

/**
 * Cancel all scheduled reminders
 */
export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get all scheduled notifications (for debugging)
 */
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Send a test notification immediately
 */
export async function sendTestNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔥 Notifications Enabled!',
      body: "You'll now receive meal reminders. Keep your streak going!",
      sound: true,
    },
    trigger: null, // Send immediately
  });
}

