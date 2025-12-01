// Goals state with automatic weight loss calculations

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
// Gender options for BMR calculation - non-binary and prefer-not-to-say use average of male/female formulas
export type BiologicalSex = 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';
export type HeightUnit = 'cm' | 'inches';
export type GoalType = 'loss' | 'maintenance' | 'gain';

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
  goalType: GoalType; // deficit, maintenance, or surplus plan
  weeklyTarget: number; // planned rate of change in lbs/week (direction driven by goalType)

  // Calculated values (automatically updated)
  totalWeightToLose: number; // lbs (can be negative for gain)
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
  goalType?: GoalType;
  weeklyTarget?: number;
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

// Progress-only metrics that shift with starting weight changes
const calculateProgressMetrics = (startingWeight: number, currentWeight: number, goalWeight: number) => {
  const totalWeightToLose = startingWeight - goalWeight;
  const remainingWeight = currentWeight - goalWeight;

  let progressPercent = 0;
  if (totalWeightToLose !== 0) {
    const weightLost = startingWeight - currentWeight;
    progressPercent = Math.min(100, Math.max(0, (weightLost / totalWeightToLose) * 100));
  } else if (currentWeight === goalWeight) {
    progressPercent = 100;
  }

  const expectedWeightLost = totalWeightToLose * (progressPercent / 100);
  const actualWeightLost = startingWeight - currentWeight;
  const variance = Math.abs(actualWeightLost - expectedWeightLost);
  const onTrack = variance <= 2;

  return {
    totalWeightToLose: Math.round(totalWeightToLose * 10) / 10,
    progressPercent: Math.round(progressPercent * 10) / 10,
    remainingWeight: Math.round(remainingWeight * 10) / 10,
    onTrack,
  };
};

// Calorie plan based on Mifflin-St Jeor and user goal type/weekly rate (never uses starting weight)
const calculateCaloriePlan = (
  currentWeight: number,
  goalWeight: number,
  weeklyTarget: number,
  goalType: GoalType,
  activityLevel: ActivityLevel,
  heightCm: number,
  age: number,
  biologicalSex: BiologicalSex
) => {
  const planGoalType: GoalType = goalType ?? 'maintenance';
  const targetRate = Math.max(0, weeklyTarget);
  const dailyTargetRaw = targetRate / 7;

  const bmr = calculateBMR(currentWeight, heightCm, age, biologicalSex);
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
  const calorieDelta = targetRate > 0 ? Math.round((targetRate * CALORIES_PER_POUND) / 7) : 0;

  let dailyCalorieGoal = tdee;
  let dailyCalorieDeficit = 0;
  let appliedWeeklyTarget = 0;
  let dailyTarget = 0;

  if (planGoalType === 'loss') {
    dailyCalorieGoal = Math.max(MIN_SAFE_CALORIES, tdee - calorieDelta);
    dailyCalorieDeficit = calorieDelta;
    appliedWeeklyTarget = targetRate;
    dailyTarget = dailyTargetRaw;
  } else if (planGoalType === 'gain') {
    dailyCalorieGoal = tdee + calorieDelta;
    dailyCalorieDeficit = -calorieDelta;
    appliedWeeklyTarget = targetRate;
    dailyTarget = -dailyTargetRaw;
  } else {
    dailyCalorieGoal = tdee;
    dailyCalorieDeficit = 0;
    appliedWeeklyTarget = 0;
    dailyTarget = 0;
  }

  const remainingWeightForPlan = Math.abs(goalWeight - currentWeight);
  const remainingWeeks = appliedWeeklyTarget > 0 ? Math.ceil(remainingWeightForPlan / appliedWeeklyTarget) : 0;
  const completionDate = new Date();
  completionDate.setDate(completionDate.getDate() + Math.max(0, remainingWeeks * 7));
  // Format as YYYY-MM-DD in local time to avoid timezone drift
  const year = completionDate.getFullYear();
  const month = String(completionDate.getMonth() + 1).padStart(2, '0');
  const day = String(completionDate.getDate()).padStart(2, '0');
  const estimatedCompletionDate = `${year}-${month}-${day}`;

  return {
    weeklyTarget: Math.round(appliedWeeklyTarget * 100) / 100,
    dailyTarget: Math.round(dailyTarget * 1000) / 1000,
    dailyCalorieDeficit,
    bmr,
    tdee,
    dailyCalorieGoal,
    remainingWeeks: Math.max(0, remainingWeeks),
    estimatedCompletionDate,
  };
};

// Helper to calculate all derived values
const calculateDerivedValues = (
  startingWeight: number,
  currentWeight: number,
  goalWeight: number,
  _timelineWeeks: number,
  activityLevel: ActivityLevel,
  heightCm: number,
  age: number,
  biologicalSex: BiologicalSex,
  goalType: GoalType,
  weeklyTarget: number
): Omit<
  GoalsState,
  | 'startingWeight'
  | 'currentWeight'
  | 'goalWeight'
  | 'timelineWeeks'
  | 'activityLevel'
  | 'heightCm'
  | 'heightUnit'
  | 'age'
  | 'biologicalSex'
  | 'goalType'
  | 'weeklyTarget'
> => {
  return {
    ...calculateProgressMetrics(startingWeight, currentWeight, goalWeight),
    ...calculateCaloriePlan(currentWeight, goalWeight, weeklyTarget, goalType, activityLevel, heightCm, age, biologicalSex),
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
  goalType: 'loss',
  weeklyTarget: 1,
  ...calculateDerivedValues(180, 175, 165, 12, 'moderate', 175, 30, 'male', 'loss', 1),
};

const listeners: Set<Listener> = new Set();

const notify = () => {
  listeners.forEach((listener) => listener(goals));
};

// Get current goals state
export const getGoals = (): GoalsState => goals;

// Update goals - automatically recalculates all derived values
export const updateGoals = (updates: GoalsInput): void => {
  const prevGoals = goals;
  const newStartingWeight = updates.startingWeight ?? prevGoals.startingWeight;
  const newCurrentWeight = updates.currentWeight ?? prevGoals.currentWeight;
  const newGoalWeight = updates.goalWeight ?? prevGoals.goalWeight;
  const newTimelineWeeks = updates.timelineWeeks ?? prevGoals.timelineWeeks;
  const newActivityLevel = updates.activityLevel ?? prevGoals.activityLevel;
  const newHeightCm = updates.heightCm ?? prevGoals.heightCm;
  const newHeightUnit = updates.heightUnit ?? prevGoals.heightUnit;
  const newAge = updates.age ?? prevGoals.age;
  const newBiologicalSex = updates.biologicalSex ?? prevGoals.biologicalSex;
  const newGoalType = updates.goalType ?? prevGoals.goalType ?? 'maintenance';
  const newWeeklyTarget = Math.max(0, updates.weeklyTarget ?? prevGoals.weeklyTarget ?? 0);

  const derived = calculateDerivedValues(
    newStartingWeight,
    newCurrentWeight,
    newGoalWeight,
    newTimelineWeeks,
    newActivityLevel,
    newHeightCm,
    newAge,
    newBiologicalSex,
    newGoalType,
    newWeeklyTarget
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
    goalType: newGoalType,
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
  const remaining = Math.max(0, goals.currentWeight - goals.goalWeight);
  return Math.ceil(remaining / MAX_SAFE_WEEKLY_LOSS);
};

// Helper to get days with meal data (for calendar)
export const getDaysWithMealData = (meals: Array<{ dayId: string }>): Set<string> => {
  return new Set(meals.map((meal) => meal.dayId));
};
