import {
  fetchMealsForUser,
  insertMeal as insertMealDb,
  updateMealMeta as updateMealMetaDb,
  updateMealFoods as updateMealFoodsDb,
  addFoodToMeal as addFoodToMealDb,
  deleteMeal as deleteMealDb,
} from '@/services/meals';

export type FoodItem = {
  id: string;
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type MealEntry = {
  id: string;
  dayId: string; // ISO date string format: 'YYYY-MM-DD'
  name: string;
  time: string;
  image: number | { uri: string };
  foods: FoodItem[];
};

type Listener = (meals: MealEntry[]) => void;

// Format a Date as YYYY-MM-DD in local time to avoid timezone drift
const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to get ISO date string for a date (in local timezone)
export const getDateId = (date: Date = new Date()): string => {
  // Use formatDateLocal to avoid timezone issues with toISOString()
  return formatDateLocal(date);
};

// Helper to get today's date ID
export const getTodayId = (): string => getDateId(new Date());

// Helper to get yesterday's date ID
export const getYesterdayId = (): string => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getDateId(yesterday);
};

// Helper to get date ID for N days ago
export const getDaysAgoId = (daysAgo: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return getDateId(date);
};

// Start empty; meals are hydrated from Supabase after login
let meals: MealEntry[] = [];

const listeners: Listener[] = [];

export const subscribeMeals = (listener: Listener) => {
  listeners.push(listener);
  listener(meals);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
};

const notify = () => {
  listeners.forEach((l) => l(meals));
};

export const getMeals = () => meals;

export const loadMealsFromDb = async (userId: string): Promise<void> => {
  try {
    const fetchedMeals = await fetchMealsForUser(userId);
    meals = fetchedMeals;
    notify();
  } catch (error) {
    console.error('Failed to load meals:', error);
    throw error;
  }
};

const isUuid = (value?: string) =>
  typeof value === 'string' &&
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);

export const updateMealFoods = async (userId: string, mealId: string, foods: FoodItem[] = []) => {
  if (!userId || !mealId || !isUuid(userId) || !isUuid(mealId)) {
    console.warn('Skipped updateMealFoods due to invalid ids', { userId, mealId });
    return;
  }
  console.log('updateMealFoods payload', {
    userId,
    mealId,
    foodCount: foods.length,
    foodIds: foods.map((f) => f.id),
  });
  try {
    const updatedMeal = await updateMealFoodsDb({ mealId, userId, foods });
    meals = meals.map((meal) => (meal.id === mealId ? updatedMeal : meal));
    notify();
  } catch (error) {
    console.error('Failed to update meal foods:', error);
    throw error;
  }
};

export const updateMealMeta = async (
  userId: string,
  mealId: string,
  data: Partial<Omit<MealEntry, 'id' | 'foods'>> = {}
) => {
  if (!userId || !mealId || !isUuid(userId) || !isUuid(mealId)) {
    console.warn('Skipped updateMealMeta due to invalid ids', { userId, mealId });
    return;
  }
  try {
    const updates: {
      name?: string;
      time?: string;
      dayId?: string;
      imageUri?: string;
    } = {};

    if (data.name) updates.name = data.name;
    if (data.time) updates.time = data.time;
    if (data.dayId) updates.dayId = data.dayId;
    if (data.image && typeof data.image === 'object' && 'uri' in data.image) {
      updates.imageUri = data.image.uri;
    }

    const updatedMeal = await updateMealMetaDb({ mealId, userId, updates });
    meals = meals.map((meal) => (meal.id === mealId ? updatedMeal : meal));
    notify();
  } catch (error) {
    console.error('Failed to update meal meta:', error);
    throw error;
  }
};

export const deleteMeal = async (userId: string, mealId: string) => {
  try {
    await deleteMealDb({ mealId, userId });
    meals = meals.filter((meal) => meal.id !== mealId);
    notify();
  } catch (error) {
    console.error('Failed to delete meal:', error);
    throw error;
  }
};

export const addFoodToMeal = async (userId: string, mealId: string, food: Omit<FoodItem, 'id'>) => {
  try {
    const newFood = await addFoodToMealDb({ mealId, userId, food });
    meals = meals.map((meal) =>
      meal.id === mealId ? { ...meal, foods: [...meal.foods, newFood] } : meal
    );
    notify();
    return newFood;
  } catch (error) {
    console.error('Failed to add food to meal:', error);
    throw error;
  }
};

export const addMeal = async (
  userId: string,
  meal: Omit<MealEntry, 'id' | 'foods'> & { foods: Omit<FoodItem, 'id'>[] }
) => {
  try {
    const imageUri =
      meal.image && typeof meal.image === 'object' && 'uri' in meal.image ? meal.image.uri : undefined;

    const newMeal = await insertMealDb({
      userId,
      dayId: meal.dayId,
      name: meal.name,
      time: meal.time,
      imageUri,
      foods: meal.foods,
    });

    meals = [newMeal, ...meals];
    notify();
    return newMeal;
  } catch (error) {
    console.error('Failed to add meal:', error);
    throw error;
  }
};
