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
  dayId: string;
  name: string;
  time: string;
  image: number | { uri: string };
  foods: FoodItem[];
};

type Listener = (meals: MealEntry[]) => void;

let meals: MealEntry[] = [
  {
    id: '1',
    dayId: 'today',
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
    dayId: 'today',
    name: 'Avocado toast',
    time: '9:12 AM',
    image: require('@/assets/images/icon.png'),
    foods: [{ id: 'f4', name: 'Avocado toast', quantity: '1 slice', calories: 340, protein: 12, carbs: 28, fat: 15 }],
  },
  {
    id: '3',
    dayId: 'today',
    name: 'Berry yogurt',
    time: '7:45 AM',
    image: require('@/assets/images/react-logo.png'),
    foods: [{ id: 'f5', name: 'Berry yogurt', quantity: '1 cup', calories: 220, protein: 10, carbs: 26, fat: 6 }],
  },
  {
    id: 'y1',
    dayId: 'yesterday',
    name: 'Turkey sandwich',
    time: '12:48 PM',
    image: require('@/assets/images/image.png'),
    foods: [
      { id: 'f6', name: 'Turkey sandwich', quantity: '1 serving', calories: 520, protein: 29, carbs: 44, fat: 16 },
    ],
  },
  {
    id: 'y2',
    dayId: 'yesterday',
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

export const updateMealFoods = (mealId: string, foods: FoodItem[]) => {
  meals = meals.map((meal) => (meal.id === mealId ? { ...meal, foods } : meal));
  notify();
};

export const updateMealMeta = (mealId: string, data: Partial<Omit<MealEntry, 'id' | 'foods'>>) => {
  meals = meals.map((meal) => (meal.id === mealId ? { ...meal, ...data } : meal));
  notify();
};

export const deleteMeal = (mealId: string) => {
  meals = meals.filter((meal) => meal.id !== mealId);
  notify();
};

export const addFoodToMeal = (mealId: string, food: FoodItem) => {
  meals = meals.map((meal) => (meal.id === mealId ? { ...meal, foods: [...meal.foods, food] } : meal));
  notify();
};

export const addMeal = (meal: MealEntry) => {
  meals = [meal, ...meals];
  notify();
};
