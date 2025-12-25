import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { upsertProfile } from '@/services/profile';
import { ActivityLevel, BiologicalSex, updateGoals } from '@/state/goals';
import { getUserProfile, updateUserProfile } from '@/state/user';
import {
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    useFonts,
} from '@expo-google-fonts/inter';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    Easing,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

// Design tokens
const COLORS = {
  background: '#F8F9FB',
  card: '#FFFFFF',
  text: '#111418',
  textMuted: '#6A7178',
  textLight: '#9CA3AF',
  accent: '#2C3E50',
  accentLight: 'rgba(44, 62, 80, 0.08)',
  border: '#E6E8EB',
  success: '#6AB7A8',
  highlight: '#D8A648',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Onboarding steps
type OnboardingStep = 'birthday' | 'sex' | 'weight' | 'goalWeight' | 'timeline' | 'activity';

const STEPS: OnboardingStep[] = ['birthday', 'sex', 'weight', 'goalWeight', 'timeline', 'activity'];

// Month names for date picker
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Sex options
const SEX_OPTIONS: { value: BiologicalSex; label: string; icon: string }[] = [
  { value: 'male', label: 'Male', icon: 'gender-male' },
  { value: 'female', label: 'Female', icon: 'gender-female' },
  { value: 'non-binary', label: 'Non-binary', icon: 'gender-non-binary' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say', icon: 'account-question-outline' },
];

// Activity options
const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; description: string; icon: string }[] = [
  { value: 'sedentary', label: 'Sedentary', description: 'Little to no exercise', icon: 'sofa-outline' },
  { value: 'light', label: 'Light', description: 'Exercise 1-3 days/week', icon: 'walk' },
  { value: 'moderate', label: 'Moderate', description: 'Exercise 3-5 days/week', icon: 'run' },
  { value: 'active', label: 'Active', description: 'Hard exercise 6-7 days/week', icon: 'run-fast' },
  { value: 'veryActive', label: 'Very Active', description: 'Intense daily exercise', icon: 'lightning-bolt' },
];

// Timeline presets (weeks)
const TIMELINE_PRESETS = [
  { weeks: 4, label: '1 month' },
  { weeks: 8, label: '2 months' },
  { weeks: 12, label: '3 months' },
  { weeks: 16, label: '4 months' },
  { weeks: 24, label: '6 months' },
  { weeks: 52, label: '1 year' },
];

export default function OnboardingFlowScreen() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Current step
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = STEPS[currentStepIndex];

  // Form state
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [birthMonth, setBirthMonth] = useState<number | null>(null);
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [sex, setSex] = useState<BiologicalSex | null>(null);
  const [weight, setWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [timeline, setTimeline] = useState<number | null>(null);
  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [saving, setSaving] = useState(false);
  const { user, loading: authLoading } = useSupabaseAuth();

  // Calculate age from birthday
  const calculateAge = useCallback((birthDate: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }, []);

  // Get fun age comment
  const getAgeComment = useCallback((age: number): string => {
    if (age < 18) return `${age} and ready to glow up! ✨`;
    if (age === 18) return `18! Adulting starts now 🎉`;
    if (age === 21) return `21! You can do... more things now 🍾`;
    if (age < 25) return `${age} - Still figuring it out 🤷`;
    if (age === 25) return `Quarter century crisis? Nah, just vibes 💅`;
    if (age < 30) return `${age} and thriving in your prime! 🔥`;
    if (age === 30) return `Dirty thirty! Welcome to the club 🎂`;
    if (age < 35) return `${age} - You've got this figured out 😎`;
    if (age < 40) return `${age} and absolutely crushing it 💪`;
    if (age === 40) return `40 years young! Aging like fine wine 🍷`;
    if (age < 45) return `${age} years young and unstoppable 🚀`;
    if (age < 50) return `${age}? More like ${age - 10} with experience 😏`;
    if (age === 50) return `Half a century of awesome! 🌟`;
    if (age < 60) return `${age} years young - Wisdom unlocked 🧠`;
    if (age < 70) return `${age}? You're just getting started! 🏃`;
    if (age < 80) return `${age} years of living your best life 👑`;
    return `${age}? Legend status achieved 🏆`;
  }, []);

  // Build birthday from components
  const buildBirthday = useCallback((): Date | null => {
    if (birthMonth === null || !birthDay || !birthYear) return null;
    const day = parseInt(birthDay, 10);
    const year = parseInt(birthYear, 10);
    if (isNaN(day) || isNaN(year)) return null;
    return new Date(year, birthMonth, day);
  }, [birthMonth, birthDay, birthYear]);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Animate step entrance
  const animateStepIn = useCallback(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
    scaleAnim.setValue(0.95);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }),
    ]).start();

    // Progress bar
    Animated.timing(progressAnim, {
      toValue: (currentStepIndex + 1) / STEPS.length,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fadeAnim, slideAnim, scaleAnim, progressAnim, currentStepIndex]);

  useEffect(() => {
    animateStepIn();
  }, [currentStepIndex, animateStepIn]);

  // Check if current step is valid
  const isStepValid = useCallback(() => {
    switch (currentStep) {
      case 'birthday':
        const bday = buildBirthday();
        if (!bday) return false;
        const age = calculateAge(bday);
        return age >= 13 && age <= 120;
      case 'sex':
        return sex !== null;
      case 'weight':
        const weightNum = parseFloat(weight);
        return !isNaN(weightNum) && weightNum > 50 && weightNum < 700;
      case 'goalWeight':
        const goalNum = parseFloat(goalWeight);
        return !isNaN(goalNum) && goalNum > 50 && goalNum < 700;
      case 'timeline':
        return timeline !== null;
      case 'activity':
        return activity !== null;
      default:
        return false;
    }
  }, [currentStep, buildBirthday, calculateAge, sex, weight, goalWeight, timeline, activity]);

  // Go to next step or finish
  const handleNext = useCallback(async () => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      // Wait for auth to finish loading
      if (authLoading) {
        Alert.alert('Please wait', 'Loading your session...');
        return;
      }

      if (!user?.id) {
        Alert.alert('Not signed in', 'Please sign in again before completing onboarding.');
        router.replace('/login');
        return;
      }
      if (saving) return;
      setSaving(true);
      try {
        const weightNum = parseFloat(weight);
        const goalWeightNum = parseFloat(goalWeight);
        const birthdayDate = buildBirthday()!;
        const ageNum = calculateAge(birthdayDate);

        // Format date of birth as ISO string
        const year = birthdayDate.getFullYear();
        const month = String(birthdayDate.getMonth() + 1).padStart(2, '0');
        const day = String(birthdayDate.getDate()).padStart(2, '0');
        const dateOfBirth = `${year}-${month}-${day}`;

        // Update local state first
        updateUserProfile({
          age: ageNum,
          currentWeight: weightNum,
          goalWeight: goalWeightNum,
          dateOfBirth: dateOfBirth,
          biologicalSex: sex!,
        });

        // NOTE: Height is not collected during onboarding, so it defaults to 0.
        // Users MUST add their height in profile settings for accurate calorie calculations.
        // Calorie calculations require: age, biologicalSex, heightCm, currentWeight, goalWeight,
        // activityLevel, and timelineWeeks. Missing height will result in inaccurate TDEE/BMR.
        updateGoals({
          startingWeight: weightNum,
          currentWeight: weightNum,
          goalWeight: goalWeightNum,
          timelineWeeks: timeline!,
          activityLevel: activity!,
          age: ageNum,
          biologicalSex: sex!,
          heightCm: 0, // User must add height in profile for accurate calorie calculations
        });

        // Save to Supabase
        const profile = getUserProfile();
        await upsertProfile({
          userId: user.id,
          name: profile.name,
          email: profile.email,
          age: ageNum,
          dateOfBirth,
          biologicalSex: sex!,
          currentWeight: weightNum,
          goalWeight: goalWeightNum,
          startingWeight: weightNum,
          timelineWeeks: timeline!,
          activityLevel: activity!,
          heightCm: 0, // User must add height in profile for accurate calorie calculations
        });

        // Navigate after successful save
        router.replace('/(tabs)');
      } catch (error: any) {
        console.error('Failed to save profile', error);
        Alert.alert('Save failed', error?.message ?? 'Could not save your profile. Please try again.');
      } finally {
        setSaving(false);
      }
    }
  }, [currentStepIndex, buildBirthday, calculateAge, sex, weight, goalWeight, timeline, activity, router, saving, user, authLoading]);

  // Go back
  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  // Skip onboarding
  const handleSkip = useCallback(() => {
    router.replace('/(tabs)');
  }, [router]);

  // Font styles
  const titleFont = fontsLoaded ? { fontFamily: 'Inter_700Bold' } : {};
  const semiFont = fontsLoaded ? { fontFamily: 'Inter_600SemiBold' } : {};
  const bodyFont = fontsLoaded ? { fontFamily: 'Inter_400Regular' } : {};
  const lightFont = fontsLoaded ? { fontFamily: 'Inter_300Light' } : {};

  // Get step content
  const getStepTitle = () => {
    switch (currentStep) {
      case 'birthday':
        return 'When were you born?';
      case 'sex':
        return 'What\'s your biological sex?';
      case 'weight':
        return 'What\'s your current weight?';
      case 'goalWeight':
        return 'What\'s your goal weight?';
      case 'timeline':
        return 'When do you want to reach your goal?';
      case 'activity':
        return 'How active are you?';
      default:
        return '';
    }
  };

  const getStepSubtitle = () => {
    switch (currentStep) {
      case 'birthday':
        return 'This helps us personalize your calorie goals';
      case 'sex':
        return 'Used to calculate your metabolism accurately';
      case 'weight':
        return 'We\'ll track your progress from here';
      case 'goalWeight':
        return 'Set a realistic target you\'re excited about';
      case 'timeline':
        return 'We\'ll create a sustainable plan for you';
      case 'activity':
        return 'This determines your daily energy needs';
      default:
        return '';
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'birthday':
        const currentAge = buildBirthday() ? calculateAge(buildBirthday()!) : null;
        return (
          <View style={styles.birthdayContainer}>
            {/* Month Selector */}
            <Text style={[styles.birthdayLabel, semiFont]}>Month</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.monthScroll}
              contentContainerStyle={styles.monthScrollContent}
            >
              {MONTHS.map((month, index) => {
                const isSelected = birthMonth === index;
                return (
                  <Pressable
                    key={month}
                    onPress={() => setBirthMonth(index)}
                    style={[styles.monthChip, isSelected && styles.monthChipSelected]}
                  >
                    <Text style={[styles.monthChipText, semiFont, isSelected && styles.monthChipTextSelected]}>
                      {month.slice(0, 3)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Day and Year */}
            <View style={styles.dayYearRow}>
              <View style={styles.dayYearField}>
                <Text style={[styles.birthdayLabel, semiFont]}>Day</Text>
                <TextInput
                  style={[styles.birthdayInput, bodyFont]}
                  value={birthDay}
                  onChangeText={(text) => {
                    const num = text.replace(/[^0-9]/g, '');
                    if (num === '' || (parseInt(num) >= 1 && parseInt(num) <= 31)) {
                      setBirthDay(num);
                    }
                  }}
                  keyboardType="number-pad"
                  placeholder="15"
                  placeholderTextColor={COLORS.textLight}
                  maxLength={2}
                  returnKeyType="done"
                />
              </View>
              <View style={styles.dayYearField}>
                <Text style={[styles.birthdayLabel, semiFont]}>Year</Text>
                <TextInput
                  style={[styles.birthdayInput, bodyFont]}
                  value={birthYear}
                  onChangeText={(text) => {
                    const num = text.replace(/[^0-9]/g, '');
                    setBirthYear(num);
                  }}
                  keyboardType="number-pad"
                  placeholder="1995"
                  placeholderTextColor={COLORS.textLight}
                  maxLength={4}
                  returnKeyType="done"
                />
              </View>
            </View>

            {/* Age Preview */}
            {currentAge !== null && currentAge >= 13 && currentAge <= 120 && (
              <View style={styles.agePreview}>
                <Text style={[styles.agePreviewText, semiFont]}>
                  {getAgeComment(currentAge)}
                </Text>
              </View>
            )}
          </View>
        );

      case 'sex':
        return (
          <View style={styles.optionsGrid}>
            {SEX_OPTIONS.map((option, index) => {
              const isSelected = sex === option.value;
              return (
                <AnimatedOption
                  key={option.value}
                  delay={index * 80}
                  onPress={() => setSex(option.value)}
                  isSelected={isSelected}
                >
                  <View style={[styles.optionCard, isSelected && styles.optionCardSelected]}>
                    <View style={[styles.optionIconContainer, isSelected && styles.optionIconSelected]}>
                      <MaterialCommunityIcons
                        name={option.icon as any}
                        size={28}
                        color={isSelected ? '#FFFFFF' : COLORS.accent}
                      />
                    </View>
                    <Text 
                      style={[
                        styles.optionLabel, 
                        semiFont, 
                        isSelected && styles.optionLabelSelected,
                        option.value === 'prefer-not-to-say' && styles.optionLabelSmall
                      ]}
                      numberOfLines={1}
                    >
                      {option.label}
                    </Text>
                  </View>
                </AnimatedOption>
              );
            })}
          </View>
        );

      case 'weight':
        return (
          <View style={styles.inputContainer}>
            <View style={styles.weightInputWrapper}>
              <TextInput
                style={[styles.largeInput, bodyFont]}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholder="175"
                placeholderTextColor={COLORS.textLight}
                maxLength={5}
                autoFocus
                returnKeyType="done"
              />
              <Text style={[styles.inputSuffix, lightFont]}>lbs</Text>
            </View>
            <Text style={[styles.inputHint, lightFont]}>
              This becomes your starting point
            </Text>
          </View>
        );

      case 'goalWeight':
        return (
          <View style={styles.inputContainer}>
            <View style={styles.weightInputWrapper}>
              <TextInput
                style={[styles.largeInput, bodyFont]}
                value={goalWeight}
                onChangeText={setGoalWeight}
                keyboardType="decimal-pad"
                placeholder="155"
                placeholderTextColor={COLORS.textLight}
                maxLength={5}
                autoFocus
                returnKeyType="done"
              />
              <Text style={[styles.inputSuffix, lightFont]}>lbs</Text>
            </View>
            {weight && goalWeight && (
              <WeightDifferenceDisplay
                current={parseFloat(weight)}
                goal={parseFloat(goalWeight)}
                semiFont={semiFont}
                lightFont={lightFont}
              />
            )}
          </View>
        );

      case 'timeline':
        return (
          <View style={styles.timelineContainer}>
            {TIMELINE_PRESETS.map((preset, index) => {
              const isSelected = timeline === preset.weeks;
              return (
                <AnimatedOption
                  key={preset.weeks}
                  delay={index * 60}
                  onPress={() => setTimeline(preset.weeks)}
                  isSelected={isSelected}
                >
                  <View style={[styles.timelineOption, isSelected && styles.timelineOptionSelected]}>
                    <Text style={[styles.timelineLabel, semiFont, isSelected && styles.timelineLabelSelected]}>
                      {preset.label}
                    </Text>
                  </View>
                </AnimatedOption>
              );
            })}
          </View>
        );

      case 'activity':
        return (
          <ScrollView 
            style={styles.activityScroll} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.activityScrollContent}
          >
            {ACTIVITY_OPTIONS.map((option, index) => {
              const isSelected = activity === option.value;
              return (
                <AnimatedOption
                  key={option.value}
                  delay={index * 80}
                  onPress={() => setActivity(option.value)}
                  isSelected={isSelected}
                >
                  <View style={[styles.activityCard, isSelected && styles.activityCardSelected]}>
                    <View style={[styles.activityIconContainer, isSelected && styles.activityIconSelected]}>
                      <MaterialCommunityIcons
                        name={option.icon as any}
                        size={20}
                        color={isSelected ? '#FFFFFF' : COLORS.accent}
                      />
                    </View>
                    <View style={styles.activityContent}>
                      <Text style={[styles.activityLabel, semiFont, isSelected && styles.activityLabelSelected]}>
                        {option.label}
                      </Text>
                      <Text style={[styles.activityDescription, lightFont, isSelected && styles.activityDescSelected]}>
                        {option.description}
                      </Text>
                    </View>
                    {isSelected && (
                      <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.accent} />
                    )}
                  </View>
                </AnimatedOption>
              );
            })}
          </ScrollView>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          {currentStepIndex > 0 ? (
            <Pressable style={styles.backButton} onPress={handleBack}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
            </Pressable>
          ) : (
            <View style={styles.backButton} />
          )}
          
          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressText, lightFont]}>
              {currentStepIndex + 1} of {STEPS.length}
            </Text>
          </View>

          <View style={styles.backButton} />
        </View>

        {/* Content */}
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          <View style={styles.questionSection}>
            <Text style={[styles.title, titleFont]}>{getStepTitle()}</Text>
            <Text style={[styles.subtitle, lightFont]}>{getStepSubtitle()}</Text>
          </View>

          <View style={styles.answerSection}>
            {renderStepContent()}
          </View>
        </Animated.View>

        {/* Footer */}
        <View style={styles.footer}>
          <Pressable
            style={[styles.continueButton, !isStepValid() && styles.continueButtonDisabled]}
            onPress={handleNext}
            disabled={!isStepValid()}
          >
            <Text style={[styles.continueText, semiFont]}>
              {currentStepIndex === STEPS.length - 1 ? 'Get Started' : 'Continue'}
            </Text>
            <MaterialCommunityIcons
              name={currentStepIndex === STEPS.length - 1 ? 'check' : 'arrow-right'}
              size={20}
              color="#FFFFFF"
            />
          </Pressable>

          <Pressable style={styles.skipButton} onPress={handleSkip}>
            <Text style={[styles.skipText, bodyFont]}>Set up later</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

// Animated option wrapper component
function AnimatedOption({
  children,
  delay,
  onPress,
  isSelected,
}: {
  children: React.ReactNode;
  delay: number;
  onPress: () => void;
  isSelected: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacityAnim, scaleAnim]);

  const handlePress = () => {
    // Bounce animation on select
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
    onPress();
  };

  return (
    <Pressable onPress={handlePress}>
      <Animated.View
        style={{
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        }}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

// Weight difference display component
function WeightDifferenceDisplay({
  current,
  goal,
  semiFont,
  lightFont,
}: {
  current: number;
  goal: number;
  semiFont: object;
  lightFont: object;
}) {
  const diff = current - goal;
  const isLoss = diff > 0;
  const isGain = diff < 0;

  if (isNaN(diff) || diff === 0) return null;

  return (
    <View style={styles.diffContainer}>
      <MaterialCommunityIcons
        name={isLoss ? 'arrow-down' : 'arrow-up'}
        size={20}
        color={isLoss ? COLORS.success : COLORS.highlight}
      />
      <Text style={[styles.diffText, semiFont, { color: isLoss ? COLORS.success : COLORS.highlight }]}>
        {Math.abs(diff).toFixed(1)} lbs to {isLoss ? 'lose' : 'gain'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  progressContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 8,
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  questionSection: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    color: COLORS.text,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textMuted,
    lineHeight: 24,
  },
  answerSection: {
    flex: 1,
  },

  // Input styles
  inputContainer: {
    alignItems: 'center',
    paddingTop: 20,
  },
  ageInputWrapper: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  weightInputWrapper: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  largeInput: {
    fontSize: 64,
    fontWeight: '300',
    color: COLORS.text,
    textAlign: 'center',
    minWidth: 120,
    padding: 0,
  },
  inputSuffix: {
    fontSize: 24,
    color: COLORS.textMuted,
  },
  inputHint: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 16,
  },

  // Birthday picker styles
  birthdayContainer: {
    paddingTop: 10,
  },
  birthdayLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  monthScroll: {
    marginBottom: 24,
    marginHorizontal: -24,
  },
  monthScrollContent: {
    paddingHorizontal: 24,
    gap: 8,
  },
  monthChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  monthChipSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentLight,
  },
  monthChipText: {
    fontSize: 15,
    color: COLORS.text,
  },
  monthChipTextSelected: {
    color: COLORS.accent,
  },
  dayYearRow: {
    flexDirection: 'row',
    gap: 16,
  },
  dayYearField: {
    flex: 1,
  },
  birthdayInput: {
    fontSize: 32,
    color: COLORS.text,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    textAlign: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  agePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(106, 183, 168, 0.1)',
    borderRadius: 12,
  },
  agePreviewText: {
    fontSize: 16,
    color: COLORS.success,
  },

  // Options grid (sex)
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  optionCard: {
    width: (SCREEN_WIDTH - 72) / 2,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  optionCardSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentLight,
  },
  optionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconSelected: {
    backgroundColor: COLORS.accent,
  },
  optionLabel: {
    fontSize: 15,
    color: COLORS.text,
    textAlign: 'center',
  },
  optionLabelSmall: {
    fontSize: 14,
  },
  optionLabelSelected: {
    color: COLORS.accent,
  },

  // Timeline options
  timelineContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  timelineOption: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  timelineOptionSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentLight,
  },
  timelineLabel: {
    fontSize: 16,
    color: COLORS.text,
  },
  timelineLabelSelected: {
    color: COLORS.accent,
  },

  // Activity options
  activityScroll: {
    flex: 1,
  },
  activityScrollContent: {
    gap: 8,
    paddingBottom: 20,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 12,
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  activityCardSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentLight,
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityIconSelected: {
    backgroundColor: COLORS.accent,
  },
  activityContent: {
    flex: 1,
    gap: 4,
  },
  activityLabel: {
    fontSize: 15,
    color: COLORS.text,
  },
  activityLabelSelected: {
    color: COLORS.accent,
  },
  activityDescription: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  activityDescSelected: {
    color: COLORS.accent,
    opacity: 0.8,
  },

  // Weight difference
  diffContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  diffText: {
    fontSize: 16,
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
    gap: 16,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    paddingVertical: 18,
  },
  continueButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  continueText: {
    fontSize: 17,
    color: '#FFFFFF',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 15,
    color: COLORS.textMuted,
  },
});
