// Goals state with automatic weight loss calculations

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
// Gender options for BMR calculation - non-binary and prefer-not-to-say use average of male/female formulas
export type BiologicalSex = 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';
export type HeightUnit = 'cm' | 'inches';

export type GoalsState = {
  // User inputs
  startingWeight: number; // lbs
  currentWeight: number; // lbs
  goalWeight: number; // lbs
  timelineWeeks: number; // weeks to reach goal
  activityLevel: ActivityLevel; // activity level for TDEE calculation
  heightCm: number; // height always stored in cm for BMR calculation
  heightUnit: HeightUnit; // display preference
  age: number; // age in years for BMR calculation
  biologicalSex: BiologicalSex; // biological sex for BMR calculation

  // Calculated values (automatically updated)
  totalWeightToLose: number; // lbs (can be negative for gain)
  weeklyTarget: number; // lbs per week
  dailyTarget: number; // lbs per day
  dailyCalorieDeficit: number; // calories per day (3500 cal = 1 lb)
  bmr: number; // Basal Metabolic Rate (Mifflin-St Jeor)
  tdee: number; // Total Daily Energy Expenditure
  dailyCalorieGoal: number; // target daily calories based on TDEE - deficit
  progressPercent: number; // 0-100 based on starting -> goal
  remainingWeight: number; // lbs left to lose
  remainingWeeks: number; // weeks left based on current progress
  onTrack: boolean; // whether user is on pace
  estimatedCompletionDate: string; // ISO date string
};

export type GoalsInput = {
  startingWeight?: number;
  currentWeight?: number;
  goalWeight?: number;
  timelineWeeks?: number;
  activityLevel?: ActivityLevel;
  heightCm?: number;
  heightUnit?: HeightUnit;
  age?: number;
  biologicalSex?: BiologicalSex;
};

type Listener = (goals: GoalsState) => void;

// Base metabolic constants
const CALORIES_PER_POUND = 3500;
const MIN_SAFE_CALORIES = 1200; // Minimum safe daily calories
const MAX_SAFE_WEEKLY_LOSS = 2; // Max recommended lbs per week

// Activity level multipliers for TDEE calculation (standard presets)
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,      // Little to no exercise
  light: 1.375,        // Light exercise 1-3 days/week
  moderate: 1.55,      // Moderate exercise 3-5 days/week
  active: 1.725,       // Hard exercise 6-7 days/week
  veryActive: 1.9,     // Very hard exercise, physical job
};

/**
 * Calculate BMR using the Mifflin-St Jeor equation (modern standard)
 * Men:   BMR = (10 × weight in kg) + (6.25 × height in cm) − (5 × age) + 5
 * Women: BMR = (10 × weight in kg) + (6.25 × height in cm) − (5 × age) − 161
 * Non-binary/Prefer not to say: Uses average of male and female formulas
 */
const calculateBMR = (weightLbs: number, heightCm: number, age: number, sex: BiologicalSex): number => {
  const weightKg = weightLbs / 2.205;
  // Male: +5, Female: -161, Average (for non-binary/prefer-not-to-say): -78
  let sexAdjustment: number;
  if (sex === 'male') {
    sexAdjustment = 5;
  } else if (sex === 'female') {
    sexAdjustment = -161;
  } else {
    // Average of male and female adjustments for non-binary/prefer-not-to-say
    sexAdjustment = (5 + -161) / 2; // -78
  }
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + sexAdjustment);
};

// Helper to calculate all derived values
const calculateDerivedValues = (
  startingWeight: number,
  currentWeight: number,
  goalWeight: number,
  timelineWeeks: number,
  activityLevel: ActivityLevel,
  heightCm: number,
  age: number,
  biologicalSex: BiologicalSex
): Omit<GoalsState, 'startingWeight' | 'currentWeight' | 'goalWeight' | 'timelineWeeks' | 'activityLevel' | 'heightCm' | 'heightUnit' | 'age' | 'biologicalSex'> => {
  // Total weight change needed from starting point
  const totalWeightToLose = startingWeight - goalWeight;
  
  // Remaining weight from current position
  const remainingWeight = currentWeight - goalWeight;
  
  // Weekly and daily targets based on timeline
  const weeklyTarget = timelineWeeks > 0 ? totalWeightToLose / timelineWeeks : 0;
  const dailyTarget = weeklyTarget / 7;
  
  // Calculate BMR and TDEE based on current weight, height, age, sex, and activity level
  const bmr = calculateBMR(currentWeight, heightCm, age, biologicalSex);
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
  
  // Calorie calculations
  const dailyCalorieDeficit = Math.round((weeklyTarget * CALORIES_PER_POUND) / 7);
  const dailyCalorieGoal = Math.max(MIN_SAFE_CALORIES, tdee - dailyCalorieDeficit);
  
  // Progress calculation (0-100%)
  let progressPercent = 0;
  if (totalWeightToLose !== 0) {
    const weightLost = startingWeight - currentWeight;
    progressPercent = Math.min(100, Math.max(0, (weightLost / totalWeightToLose) * 100));
  } else if (currentWeight === goalWeight) {
    progressPercent = 100;
  }
  
  // Remaining weeks based on current progress and weekly target
  const remainingWeeks = weeklyTarget !== 0 ? Math.ceil(remainingWeight / weeklyTarget) : 0;
  
  // Check if on track (within reasonable variance)
  const expectedWeightLost = (startingWeight - goalWeight) * (progressPercent / 100);
  const actualWeightLost = startingWeight - currentWeight;
  const variance = Math.abs(actualWeightLost - expectedWeightLost);
  const onTrack = variance <= 2;
  
  // Estimated completion date
  const completionDate = new Date();
  completionDate.setDate(completionDate.getDate() + Math.max(0, remainingWeeks * 7));
  const estimatedCompletionDate = completionDate.toISOString().split('T')[0];
  
  return {
    totalWeightToLose: Math.round(totalWeightToLose * 10) / 10,
    weeklyTarget: Math.round(weeklyTarget * 100) / 100,
    dailyTarget: Math.round(dailyTarget * 1000) / 1000,
    dailyCalorieDeficit,
    bmr,
    tdee,
    dailyCalorieGoal,
    progressPercent: Math.round(progressPercent * 10) / 10,
    remainingWeight: Math.round(remainingWeight * 10) / 10,
    remainingWeeks: Math.max(0, remainingWeeks),
    onTrack,
    estimatedCompletionDate,
  };
};

// Initialize with default values
let goals: GoalsState = {
  startingWeight: 180,
  currentWeight: 175,
  goalWeight: 165,
  timelineWeeks: 12,
  activityLevel: 'moderate',
  heightCm: 175,
  heightUnit: 'cm',
  age: 30,
  biologicalSex: 'male',
  ...calculateDerivedValues(180, 175, 165, 12, 'moderate', 175, 30, 'male'),
};

const listeners: Set<Listener> = new Set();

const notify = () => {
  listeners.forEach((listener) => listener(goals));
};

// Get current goals state
export const getGoals = (): GoalsState => goals;

// Update goals - automatically recalculates all derived values
export const updateGoals = (updates: GoalsInput): void => {
  const newStartingWeight = updates.startingWeight ?? goals.startingWeight;
  const newCurrentWeight = updates.currentWeight ?? goals.currentWeight;
  const newGoalWeight = updates.goalWeight ?? goals.goalWeight;
  const newTimelineWeeks = updates.timelineWeeks ?? goals.timelineWeeks;
  const newActivityLevel = updates.activityLevel ?? goals.activityLevel;
  const newHeightCm = updates.heightCm ?? goals.heightCm;
  const newHeightUnit = updates.heightUnit ?? goals.heightUnit;
  const newAge = updates.age ?? goals.age;
  const newBiologicalSex = updates.biologicalSex ?? goals.biologicalSex;
  
  // Recalculate all derived values
  const derived = calculateDerivedValues(
    newStartingWeight,
    newCurrentWeight,
    newGoalWeight,
    newTimelineWeeks,
    newActivityLevel,
    newHeightCm,
    newAge,
    newBiologicalSex
  );
  
  goals = {
    startingWeight: newStartingWeight,
    currentWeight: newCurrentWeight,
    goalWeight: newGoalWeight,
    timelineWeeks: newTimelineWeeks,
    activityLevel: newActivityLevel,
    heightCm: newHeightCm,
    heightUnit: newHeightUnit,
    age: newAge,
    biologicalSex: newBiologicalSex,
    ...derived,
  };
  
  notify();
};

// Subscribe to goals changes
export const subscribeGoals = (listener: Listener): (() => void) => {
  listeners.add(listener);
  listener(goals);
  return () => {
    listeners.delete(listener);
  };
};

// Helper to check if weight loss rate is safe
export const isWeeklyTargetSafe = (): boolean => {
  return Math.abs(goals.weeklyTarget) <= MAX_SAFE_WEEKLY_LOSS;
};

// Helper to get recommended timeline for safe weight loss
export const getRecommendedTimeline = (): number => {
  const totalToLose = Math.abs(goals.startingWeight - goals.goalWeight);
  return Math.ceil(totalToLose / MAX_SAFE_WEEKLY_LOSS);
};

// Helper to get days with meal data (for calendar)
export const getDaysWithMealData = (meals: Array<{ dayId: string }>): Set<string> => {
  return new Set(meals.map((meal) => meal.dayId));
};
