import { useStreak } from '@/hooks/useStreak';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { upsertProfile } from '@/services/profile';
import { ActivityLevel, BiologicalSex, getGoals, GoalsState, HeightUnit, subscribeGoals, updateGoals } from '@/state/goals';
import { getUserProfile, subscribeUserProfile, updateUserProfile, UserProfile } from '@/state/user';
import { addWeightEntry } from '@/state/weight-log';
import { Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Animated,
  Dimensions,
  Easing,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');

const background = '#F8F9FB';
const card = '#FFFFFF';
const border = '#E6E8EB';
const text = '#111418';
const muted = '#6A7178';
const accent = '#2C3E50';

type WeightUnit = 'kg' | 'lbs';

const activityLevels: Array<{ key: ActivityLevel; label: string; description: string }> = [
  { key: 'sedentary', label: 'Sedentary', description: 'Little to no exercise' },
  { key: 'light', label: 'Light', description: '1-3 days/week' },
  { key: 'moderate', label: 'Moderate', description: '3-5 days/week' },
  { key: 'active', label: 'Active', description: '6-7 days/week' },
  { key: 'veryActive', label: 'Very Active', description: 'Intense daily training' },
];

const genderOptions: Array<{ key: BiologicalSex; label: string; short: string }> = [
  { key: 'male', label: 'Male', short: 'M' },
  { key: 'female', label: 'Female', short: 'F' },
  { key: 'non-binary', label: 'Non-binary', short: 'NB' },
  { key: 'prefer-not-to-say', label: 'Prefer not to say', short: '—' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useSupabaseAuth();
  const [fontsLoaded] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Goals state from global store
  const [goals, setGoals] = useState<GoalsState | null>(null);

  const [weightUnit, setWeightUnit] = useState<WeightUnit>('lbs');

  const [editingWeight, setEditingWeight] = useState<'start' | 'current' | 'goal' | 'timeline' | 'height' | 'age' | null>(null);
  const [weightDraft, setWeightDraft] = useState('');
  const inputRefs = useRef<Record<string, TextInput | null>>({});

  // Global user profile state
  const [userProfile, setUserProfile] = useState<UserProfile>({ name: '' });
  const [showGenderPicker, setShowGenderPicker] = useState(false);

  // Streak tracking
  const streakData = useStreak();

  // Subscribe to global user state
  useEffect(() => {
    const unsubscribe = subscribeUserProfile(setUserProfile);
    return () => unsubscribe();
  }, []);

  // Avatar picker functions
  const handleAvatarPress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library', 'Remove Photo'],
          destructiveButtonIndex: 3,
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) {
            await takePhoto();
          } else if (buttonIndex === 2) {
            await pickImage();
          } else if (buttonIndex === 3) {
            removePhoto();
          }
        }
      );
    } else {
      // For Android, show a simple alert-based picker (or use a modal)
      pickImage();
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      updateUserProfile({ avatarUri: result.assets[0].uri });
      await syncProfileToSupabase();
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      updateUserProfile({ avatarUri: result.assets[0].uri });
      await syncProfileToSupabase();
    }
  };

  const removePhoto = () => {
    updateUserProfile({ avatarUri: null });
    syncProfileToSupabase();
  };

  // Subscribe to goals state
  useEffect(() => {
    const unsubscribe = subscribeGoals(setGoals);
    return () => unsubscribe();
  }, []);

  // Derived values from goals
  const startWeight = goals?.startingWeight ?? 180;
  const currentWeight = goals?.currentWeight ?? 175;
  const goalWeight = goals?.goalWeight ?? 165;
  const goalTimeline = goals?.timelineWeeks ?? 12;

  const kgToLbs = (kg: number) => kg * 2.20462;
  const lbsToKg = (lbs: number) => lbs / 2.20462;

  const formatWeight = (weight: number) => {
    if (weightUnit === 'kg') {
      return lbsToKg(weight).toFixed(1);
    }
    return weight.toFixed(1);
  };

  const toggleWeightUnit = () => {
    setWeightUnit(weightUnit === 'kg' ? 'lbs' : 'kg');
  };

  // Use calculated progress from goals state
  const progressPercent = goals?.progressPercent ?? 0;
  const clampedProgress = Math.max(0, Math.min(100, progressPercent));

  const entrance = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef([...Array(6)].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    Animated.stagger(
      80,
      cardAnims.map((anim) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [entrance, cardAnims]);

  const pageStyle = {
    opacity: entrance,
    transform: [
      {
        scale: entrance.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1],
        }),
      },
    ],
  };

  const createCardStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
        }),
      },
    ],
  });

  const titleFont = fontsLoaded ? styles.titleLoaded : null;
  const semiFont = fontsLoaded ? styles.semiLoaded : null;
  const bodyFont = fontsLoaded ? styles.bodyLoaded : null;
  const lightFont = fontsLoaded ? styles.lightLoaded : null;

  const openWeightEditor = (type: 'start' | 'current' | 'goal' | 'timeline' | 'height' | 'age', currentValue: number) => {
    setEditingWeight(type);
    if (type === 'timeline' || type === 'age') {
      setWeightDraft(currentValue.toString());
    } else if (type === 'height') {
      // Convert to display unit when editing height
      const displayValue = goals?.heightUnit === 'inches' 
        ? Math.round(currentValue / 2.54) 
        : currentValue;
      setWeightDraft(displayValue.toString());
    } else {
      setWeightDraft(formatWeight(currentValue));
    }
    // Focus the input after state update
    setTimeout(() => {
      inputRefs.current[type]?.focus();
    }, 50);
  };

  // Helper function to sync all profile data to Supabase
  const syncProfileToSupabase = async () => {
    if (!user?.id) return;

    // Pull the freshest snapshots to avoid stale state
    const latestGoals = getGoals();
    const latestProfile = getUserProfile();

    try {
      await upsertProfile({
        userId: user.id,
        name: latestProfile.name,
        email: latestProfile.email,
        avatarUrl: latestProfile.avatarUri,
        age: latestGoals.age,
        dateOfBirth: latestProfile.dateOfBirth,
        biologicalSex: latestGoals.biologicalSex,
        currentWeight: latestGoals.currentWeight,
        goalWeight: latestGoals.goalWeight,
        startingWeight: latestGoals.startingWeight,
        timelineWeeks: latestGoals.timelineWeeks,
        activityLevel: latestGoals.activityLevel,
        heightCm: latestGoals.heightCm,
        heightUnit: latestGoals.heightUnit,
      });
    } catch (error) {
      console.error('Failed to sync profile to Supabase:', error);
    }
  };

  const saveWeightEdit = async (type: 'start' | 'current' | 'goal' | 'timeline' | 'height' | 'age') => {
    const parsed = parseFloat(weightDraft);
    if (Number.isFinite(parsed) && parsed > 0) {
      // Convert from display unit to lbs for storage if needed
      const valueInLbs = weightUnit === 'kg' && !['timeline', 'height', 'age'].includes(type) ? kgToLbs(parsed) : parsed;

      if (type === 'start') {
        updateGoals({ startingWeight: valueInLbs });
      } else if (type === 'current') {
        updateGoals({ currentWeight: valueInLbs });
        // Create a weight log entry when current weight is updated
        if (user?.id) {
          try {
            await addWeightEntry(user.id, valueInLbs);
          } catch (error) {
            console.error('Failed to add weight log entry:', error);
          }
        }
      } else if (type === 'goal') {
        updateGoals({ goalWeight: valueInLbs });
      } else if (type === 'timeline') {
        updateGoals({ timelineWeeks: Math.round(parsed) });
      } else if (type === 'height') {
        // Convert from display unit to cm for storage
        const valueInCm = goals?.heightUnit === 'inches'
          ? Math.round(parsed * 2.54)
          : Math.round(parsed);
        updateGoals({ heightCm: valueInCm });
      } else if (type === 'age') {
        updateGoals({ age: Math.round(parsed) });
      }

      // Sync to Supabase
      await syncProfileToSupabase();
    }
    setEditingWeight(null);
    setWeightDraft('');
  };

  const toggleHeightUnit = async () => {
    const newUnit: HeightUnit = goals?.heightUnit === 'inches' ? 'cm' : 'inches';
    updateGoals({ heightUnit: newUnit });
    await syncProfileToSupabase();
  };

  // Helper to get display height in current unit
  const getDisplayHeight = () => {
    const heightCm = goals?.heightCm ?? 175;
    if (goals?.heightUnit === 'inches') {
      return Math.round(heightCm / 2.54);
    }
    return heightCm;
  };

  const cancelWeightEdit = () => {
    setEditingWeight(null);
    setWeightDraft('');
  };

  // Render editable value - inline TextInput when editing, Text when not
  const renderEditableWeight = (
    type: 'start' | 'current' | 'goal',
    value: number,
    style: any,
  ) => {
    if (editingWeight === type) {
      return (
        <View style={styles.inlineInputContainer}>
          <TextInput
            ref={(ref) => { inputRefs.current[type] = ref; }}
            style={[style, styles.inlineInput]}
            value={weightDraft}
            onChangeText={setWeightDraft}
            keyboardType="decimal-pad"
            onBlur={() => saveWeightEdit(type)}
            onSubmitEditing={() => saveWeightEdit(type)}
            selectTextOnFocus
          />
          <Text style={[styles.inlineUnit, bodyFont]}>{weightUnit}</Text>
        </View>
      );
    }
    return (
      <Text style={style}>
        {formatWeight(value)} {weightUnit}
      </Text>
    );
  };

  const renderEditableTimeline = (value: number, style: any) => {
    if (editingWeight === 'timeline') {
      return (
        <TextInput
          ref={(ref) => { inputRefs.current['timeline'] = ref; }}
          style={[style, styles.inlineInput]}
          value={weightDraft}
          onChangeText={setWeightDraft}
          keyboardType="number-pad"
          onBlur={() => saveWeightEdit('timeline')}
          onSubmitEditing={() => saveWeightEdit('timeline')}
          selectTextOnFocus
        />
      );
    }
    return <Text style={style}>{value}</Text>;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View style={[styles.container, pageStyle]}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={text} />
          </Pressable>
          <Pressable style={styles.settingsButton} onPress={() => router.push('/account-details')}>
            <MaterialCommunityIcons name="tune-variant" size={22} color={muted} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.heroSection, createCardStyle(cardAnims[0])]}>
            <Pressable onPress={handleAvatarPress} style={styles.avatarPressable}>
              {userProfile.avatarUri ? (
                <Image source={{ uri: userProfile.avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarLarge}>
                  <Text style={[styles.avatarText, titleFont]}>{userProfile.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <MaterialCommunityIcons name="camera" size={12} color="#FFFFFF" />
              </View>
            </Pressable>
            <Text style={[styles.heroName, titleFont]}>{userProfile.name || 'Your Name'}</Text>
            
            {/* Streak Counter */}
            <View style={styles.streakContainer}>
              <View style={styles.streakCard}>
                <View style={styles.streakIconContainer}>
                  <Text style={styles.streakEmoji}>🔥</Text>
                </View>
                <View style={styles.streakInfo}>
                  <Text style={[styles.streakCount, titleFont]}>{streakData.currentStreak}</Text>
                  <Text style={[styles.streakLabel, lightFont]}>
                    {streakData.currentStreak === 1 ? 'Day Streak' : 'Day Streak'}
                  </Text>
                </View>
                {streakData.isLoggedToday && (
                  <View style={styles.loggedTodayBadge}>
                    <MaterialCommunityIcons name="check-circle" size={14} color="#22C55E" />
                    <Text style={[styles.loggedTodayText, lightFont]}>Today</Text>
                  </View>
                )}
              </View>
              {streakData.longestStreak > streakData.currentStreak && (
                <Text style={[styles.bestStreakText, lightFont]}>
                  Best: {streakData.longestStreak} days
                </Text>
              )}
            </View>
          </Animated.View>

          {/* Body Stats - now directly under the profile header */}
          <Animated.View style={[styles.bodyStatsSection, createCardStyle(cardAnims[1])]}>
            <View style={styles.bodyStatsRow}>
              <View style={styles.bodyStatItem}>
                <View style={styles.bodyStatLabelRow}>
                  <Text style={[styles.bodyStatLabel, { marginBottom: 0 }]}>Height</Text>
                  <Pressable onPress={toggleHeightUnit} style={styles.heightUnitToggle}>
                    <Text style={[styles.heightUnitText, lightFont]}>{goals?.heightUnit === 'inches' ? 'in' : 'cm'}</Text>
                    <MaterialCommunityIcons name="swap-horizontal" size={12} color={muted} />
                  </Pressable>
                </View>
                <Pressable 
                  style={styles.bodyStatValueContainer}
                  onPress={() => openWeightEditor('height', goals?.heightCm ?? 175)}>
                  {editingWeight === 'height' ? (
                    <TextInput
                      ref={(ref) => { inputRefs.current['height'] = ref; }}
                      style={[styles.bodyStatValue, bodyFont, styles.bodyStatInput]}
                      value={weightDraft}
                      onChangeText={setWeightDraft}
                      keyboardType="number-pad"
                      onBlur={() => saveWeightEdit('height')}
                      onSubmitEditing={() => saveWeightEdit('height')}
                      selectTextOnFocus
                    />
                  ) : (
                    <Text style={[styles.bodyStatValue, bodyFont]}>{getDisplayHeight()}</Text>
                  )}
                  <Text style={[styles.bodyStatUnit, lightFont]}>{goals?.heightUnit === 'inches' ? 'in' : 'cm'}</Text>
                </Pressable>
              </View>
              <View style={styles.bodyStatDivider} />
              <View style={styles.bodyStatItem}>
                <Text style={[styles.bodyStatLabel, lightFont]}>Age</Text>
                <Pressable 
                  style={styles.bodyStatValueContainer}
                  onPress={() => openWeightEditor('age', goals?.age ?? 30)}>
                  {editingWeight === 'age' ? (
                    <TextInput
                      ref={(ref) => { inputRefs.current['age'] = ref; }}
                      style={[styles.bodyStatValue, bodyFont, styles.bodyStatInput]}
                      value={weightDraft}
                      onChangeText={setWeightDraft}
                      keyboardType="number-pad"
                      onBlur={() => saveWeightEdit('age')}
                      onSubmitEditing={() => saveWeightEdit('age')}
                      selectTextOnFocus
                    />
                  ) : (
                    <Text style={[styles.bodyStatValue, bodyFont]}>{goals?.age ?? 30}</Text>
                  )}
                  <Text style={[styles.bodyStatUnit, lightFont]}>yrs</Text>
                </Pressable>
              </View>
              <View style={styles.bodyStatDivider} />
              <View style={styles.bodyStatItem}>
                <Text style={[styles.bodyStatLabel, lightFont]}>Sex</Text>
                <Pressable 
                  style={styles.genderSelectorButton}
                  onPress={() => setShowGenderPicker(!showGenderPicker)}>
                  <Text style={[styles.genderButtonText, bodyFont]}>
                    {genderOptions.find(g => g.key === goals?.biologicalSex)?.short ?? 'M'}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={14} color={muted} />
                </Pressable>
              </View>
            </View>
            {showGenderPicker && (
              <View style={styles.genderPickerContainer}>
                <Text style={[styles.genderPickerNote, lightFont]}>
                  Used for calorie calculations
                </Text>
                {genderOptions.map((option) => (
                  <Pressable
                    key={option.key}
                    style={[styles.genderOption, goals?.biologicalSex === option.key && styles.genderOptionActive]}
                    onPress={async () => {
                      updateGoals({ biologicalSex: option.key });
                      setShowGenderPicker(false);
                      await syncProfileToSupabase();
                    }}>
                    <Text style={[styles.genderOptionText, bodyFont, goals?.biologicalSex === option.key && styles.genderOptionTextActive]}>
                      {option.label}
                    </Text>
                    {goals?.biologicalSex === option.key && (
                      <MaterialCommunityIcons name="check" size={16} color={accent} />
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </Animated.View>

          <Animated.View style={createCardStyle(cardAnims[2])}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, bodyFont]}>Weight Journey</Text>
              <Pressable style={styles.unitToggle} onPress={toggleWeightUnit}>
                <Text style={[styles.unitText, bodyFont, weightUnit === 'kg' && styles.unitTextActive]}>kg</Text>
                <Text style={[styles.unitSeparator, bodyFont]}>/</Text>
                <Text style={[styles.unitText, bodyFont, weightUnit === 'lbs' && styles.unitTextActive]}>lbs</Text>
              </Pressable>
            </View>
            <View style={styles.weightJourneyGrid}>
              <Pressable style={styles.metricCard} onPress={() => openWeightEditor('start', startWeight)}>
                <Text style={[styles.metricLabel, bodyFont]}>Starting</Text>
                {renderEditableWeight('start', startWeight, [styles.metricValue, titleFont, weightUnit === 'lbs' && styles.metricValueSmall])}
              </Pressable>

              <Pressable style={styles.metricCard} onPress={() => openWeightEditor('goal', goalWeight)}>
                <Text style={[styles.metricLabel, bodyFont]}>Goal</Text>
                {renderEditableWeight('goal', goalWeight, [styles.metricValue, titleFont, weightUnit === 'lbs' && styles.metricValueSmall])}
              </Pressable>
            </View>
          </Animated.View>

          <Animated.View style={createCardStyle(cardAnims[3])}>
            <View style={styles.currentWeightCard}>
              <Text style={[styles.currentWeightLabel, bodyFont]}>Current Weight</Text>
              {renderEditableWeight('current', currentWeight, [styles.currentWeightValue, titleFont, weightUnit === 'lbs' && styles.currentWeightValueSmall])}
              <View style={styles.progressWrapper}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${clampedProgress}%` }]} />
                </View>
                <Text style={[styles.progressLabel, bodyFont]}>{clampedProgress}% to goal</Text>
              </View>
            </View>
          </Animated.View>

          <Animated.View style={[styles.metricCard, createCardStyle(cardAnims[4])]}>
            <Pressable onPress={() => openWeightEditor('timeline', goalTimeline)}>
              <Text style={[styles.metricLabel, bodyFont]}>Goal Timeline</Text>
              <View style={styles.inputRow}>
                {renderEditableTimeline(goalTimeline, [styles.metricValue, titleFont])}
                <Text style={[styles.timelineUnit, bodyFont]}>weeks</Text>
              </View>
              {goals && (
                <Text style={[styles.calculatedInfo, lightFont]}>
                  {goals.weeklyTarget.toFixed(2)} lbs/week • {goals.dailyCalorieGoal} cal/day
                </Text>
              )}
            </Pressable>
          </Animated.View>

          <Animated.View style={createCardStyle(cardAnims[5])}>
            <Text style={[styles.sectionTitle, semiFont]}>Activity Level</Text>
            <View style={styles.activitySelector}>
              {activityLevels.map((level) => (
                <Pressable
                  key={level.key}
                  style={[styles.activityOption, goals?.activityLevel === level.key && styles.activityOptionActive]}
                  onPress={async () => {
                    updateGoals({ activityLevel: level.key });
                    await syncProfileToSupabase();
                  }}>
                  <View style={styles.activityContent}>
                    <Text style={[styles.activityLabel, semiFont, goals?.activityLevel === level.key && styles.activityLabelActive]}>
                      {level.label}
                    </Text>
                    <Text style={[styles.activityDescription, lightFont, goals?.activityLevel === level.key && styles.activityDescriptionActive]}>
                      {level.description}
                    </Text>
                  </View>
                  {goals?.activityLevel === level.key && (
                    <View style={styles.activityCheck}>
                      <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </Animated.View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: background,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: border,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 60,
    gap: 20,
  },
  heroSection: {
    alignItems: 'center',
    gap: 6,
    paddingTop: 0,
    paddingBottom: 0,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(44, 62, 80, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: {
    fontSize: 28,
    color: accent,
    fontWeight: '700',
  },
  heroName: {
    fontSize: 36,
    color: text,
    fontWeight: '700',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 15,
    color: muted,
    opacity: 0.75,
    textAlign: 'center',
    maxWidth: width * 0.75,
    lineHeight: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 14,
    color: muted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  unitToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: background,
  },
  unitText: {
    fontSize: 13,
    color: muted,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  unitTextActive: {
    color: accent,
    fontWeight: '600',
  },
  unitSeparator: {
    fontSize: 13,
    color: border,
    fontWeight: '400',
  },
  weightJourneyGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: border,
    padding: 20,
    gap: 10,
  },
  metricLabel: {
    fontSize: 13,
    color: muted,
    letterSpacing: 0.2,
    opacity: 0.8,
  },
  metricValue: {
    fontSize: 32,
    color: text,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  currentWeightCard: {
    backgroundColor: card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: border,
    padding: 24,
    gap: 12,
  },
  currentWeightLabel: {
    fontSize: 14,
    color: muted,
    letterSpacing: 0.2,
    opacity: 0.8,
  },
  currentWeightValue: {
    fontSize: 48,
    color: text,
    fontWeight: '700',
    letterSpacing: -1,
  },
  progressWrapper: {
    gap: 10,
    marginTop: 8,
  },
  progressBar: {
    height: 10,
    backgroundColor: '#EFF0F3',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: accent,
    borderRadius: 5,
  },
  progressLabel: {
    fontSize: 13,
    color: muted,
    opacity: 0.8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  timelineInput: {
    fontSize: 36,
    color: text,
    fontWeight: '700',
    letterSpacing: -0.6,
    minWidth: 60,
    padding: 0,
  },
  timelineUnit: {
    fontSize: 18,
    color: muted,
    fontWeight: '400',
  },
  calculatedInfo: {
    fontSize: 13,
    color: muted,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    color: text,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 12,
  },
  activitySelector: {
    gap: 10,
  },
  activityOption: {
    backgroundColor: card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: border,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activityOptionActive: {
    backgroundColor: '#E8EDF2',
    borderColor: accent,
  },
  activityContent: {
    flex: 1,
    gap: 4,
  },
  activityLabel: {
    fontSize: 16,
    color: text,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  activityLabelActive: {
    color: text,
  },
  activityDescription: {
    fontSize: 13,
    color: muted,
    opacity: 0.8,
  },
  activityDescriptionActive: {
    color: muted,
    opacity: 0.8,
  },
  activityCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleLoaded: {
    fontFamily: 'Inter_700Bold',
  },
  semiLoaded: {
    fontFamily: 'Inter_600SemiBold',
  },
  bodyLoaded: {
    fontFamily: 'Inter_400Regular',
  },
  lightLoaded: {
    fontFamily: 'Inter_300Light',
  },
  metricValueSmall: {
    fontSize: 26,
  },
  currentWeightValueSmall: {
    fontSize: 38,
  },
  inlineInputContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  inlineInput: {
    padding: 0,
    margin: 0,
    minWidth: 60,
    color: text,
  },
  inlineUnit: {
    fontSize: 16,
    color: muted,
    marginLeft: 4,
  },
  // Body Stats section - connected to profile identity
  bodyStatsSection: {
    backgroundColor: card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: border,
    padding: 16,
  },
  bodyStatsTitle: {
    fontSize: 13,
    color: muted,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  bodyStatsSubtitle: {
    fontSize: 12,
    color: muted,
    opacity: 0.7,
    marginBottom: 14,
  },
  bodyStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bodyStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  bodyStatLabel: {
    fontSize: 11,
    color: muted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  bodyStatLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 6,
  },
  heightUnitToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(44, 62, 80, 0.06)',
  },
  heightUnitText: {
    fontSize: 10,
    color: muted,
    textTransform: 'uppercase',
  },
  bodyStatValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  bodyStatValue: {
    fontSize: 18,
    color: text,
    fontWeight: '600',
  },
  bodyStatUnit: {
    fontSize: 12,
    color: muted,
  },
  bodyStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: border,
    marginHorizontal: 8,
  },
  sexToggle: {
    flexDirection: 'row',
    gap: 6,
  },
  sexOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: border,
  },
  sexOptionActive: {
    backgroundColor: accent,
    borderColor: accent,
  },
  sexOptionText: {
    fontSize: 14,
    color: muted,
    fontWeight: '500',
  },
  sexOptionTextActive: {
    color: '#FFFFFF',
  },
  bodyStatInput: {
    padding: 0,
    margin: 0,
    minWidth: 40,
    textAlign: 'center',
  },
  // Avatar with image support
  avatarPressable: {
    position: 'relative',
    marginBottom: 4,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: background,
  },
  // Gender picker styles
  genderSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: background,
    borderWidth: 1,
    borderColor: border,
  },
  genderButtonText: {
    fontSize: 14,
    color: text,
    fontWeight: '500',
  },
  genderPickerContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: border,
  },
  genderPickerNote: {
    fontSize: 11,
    color: muted,
    marginBottom: 12,
    textAlign: 'center',
    opacity: 0.8,
  },
  genderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: background,
  },
  genderOptionActive: {
    backgroundColor: 'rgba(44, 62, 80, 0.08)',
  },
  genderOptionText: {
    fontSize: 15,
    color: text,
    fontWeight: '400',
  },
  genderOptionTextActive: {
    fontWeight: '600',
    color: accent,
  },
  // Streak Counter Styles
  streakContainer: {
    marginTop: 16,
    alignItems: 'center',
    gap: 8,
  },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: card,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: border,
    gap: 12,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  streakIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 107, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakEmoji: {
    fontSize: 24,
  },
  streakInfo: {
    alignItems: 'flex-start',
  },
  streakCount: {
    fontSize: 28,
    fontWeight: '700',
    color: text,
    letterSpacing: -0.5,
  },
  streakLabel: {
    fontSize: 12,
    color: muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: -2,
  },
  loggedTodayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 'auto',
  },
  loggedTodayText: {
    fontSize: 11,
    color: '#22C55E',
    fontWeight: '500',
  },
  bestStreakText: {
    fontSize: 12,
    color: muted,
    opacity: 0.7,
  },
});
