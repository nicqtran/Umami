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

// Helper to get ISO date string for a date
export const getDateId = (date: Date = new Date()): string => {
  return date.toISOString().split('T')[0];
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

// Initialize with dates relative to today
const today = getTodayId();
const yesterday = getYesterdayId();

let meals: MealEntry[] = [
  {
    id: '1',
    dayId: today,
    name: 'Chicken bowl',
    time: '1:24 PM',
    image: require('@/assets/images/test-logo.png'),
    foods: [
      { id: 'f1', name: 'Grilled chicken', quantity: '120g', calories: 220, protein: 32, carbs: 0, fat: 8 },
      { id: 'f2', name: 'Steamed rice', quantity: '180g', calories: 280, protein: 5, carbs: 56, fat: 2 },
      { id: 'f3', name: 'Broccoli', quantity: '90g', calories: 80, protein: 5, carbs: 10, fat: 3 },
    ],
  },
  {
    id: '2',
    dayId: today,
    name: 'Avocado toast',
    time: '9:12 AM',
    image: require('@/assets/images/icon.png'),
    foods: [{ id: 'f4', name: 'Avocado toast', quantity: '1 slice', calories: 340, protein: 12, carbs: 28, fat: 15 }],
  },
  {
    id: '3',
    dayId: today,
    name: 'Berry yogurt',
    time: '7:45 AM',
    image: require('@/assets/images/react-logo.png'),
    foods: [{ id: 'f5', name: 'Berry yogurt', quantity: '1 cup', calories: 220, protein: 10, carbs: 26, fat: 6 }],
  },
  {
    id: 'y1',
    dayId: yesterday,
    name: 'Turkey sandwich',
    time: '12:48 PM',
    image: require('@/assets/images/image.png'),
    foods: [
      { id: 'f6', name: 'Turkey sandwich', quantity: '1 serving', calories: 520, protein: 29, carbs: 44, fat: 16 },
    ],
  },
  {
    id: 'y2',
    dayId: yesterday,
    name: 'Greek yogurt & berries',
    time: '8:15 AM',
    image: require('@/assets/images/image-trimmed.png'),
    foods: [{ id: 'f7', name: 'Greek yogurt & berries', quantity: '1 bowl', calories: 210, protein: 12, carbs: 18, fat: 8 }],
  },
];

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

export const updateMealFoods = async (userId: string, mealId: string, foods: FoodItem[]) => {
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
  data: Partial<Omit<MealEntry, 'id' | 'foods'>>
) => {
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
  meal: Omit<MealEntry, 'id'> & { foods: Omit<FoodItem, 'id'>[] }
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
