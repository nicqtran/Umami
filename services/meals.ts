import { supabase } from '@/lib/supabase';
import { FoodItem, MealEntry } from '@/state/meals';

const MEAL_IMAGES_BUCKET = 'meal-images';

type SupabaseMealRow = {
  id: string;
  user_id: string;
  day_id: string;
  name: string;
  time: string;
  image_uri: string | null;
  created_at?: string;
  updated_at?: string;
};

type SupabaseFoodItemRow = {
  id: string;
  meal_id: string;
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  created_at?: string;
};

type MealWithFoods = SupabaseMealRow & {
  food_items: SupabaseFoodItemRow[];
};

const toMealEntry = (row: MealWithFoods): MealEntry => ({
  id: row.id,
  dayId: row.day_id,
  name: row.name,
  time: row.time,
  image: row.image_uri ? { uri: row.image_uri } : require('@/assets/images/icon.png'),
  foods: row.food_items.map((f) => ({
    id: f.id,
    name: f.name,
    quantity: f.quantity,
    calories: f.calories,
    protein: f.protein,
    carbs: f.carbs,
    fat: f.fat,
  })),
});

const isUuid = (value?: string) =>
  typeof value === 'string' &&
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);

const isRemoteUrl = (url?: string | null) => {
  if (!url) return false;
  return /^https?:\/\//.test(url);
};

/**
 * Upload a meal image to Supabase Storage and return the public URL.
 * If the image is already a remote URL, return it as-is.
 */
export const uploadMealImage = async (userId: string, imageUri: string): Promise<string> => {
  // If already a remote URL, return as-is
  if (isRemoteUrl(imageUri)) {
    return imageUri;
  }

  const response = await fetch(imageUri);
  if (!response.ok) {
    throw new Error('Unable to read image file for upload');
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const extensionFromType = contentType.split('/').pop() || 'jpg';
  const extensionFromUri = imageUri.split('.').pop()?.split('?')[0]; // Handle query params
  const extension = extensionFromUri && extensionFromUri.length <= 4 ? extensionFromUri : extensionFromType;

  const arrayBuffer = await response.arrayBuffer();
  const fileData = new Uint8Array(arrayBuffer);

  const filePath = `${userId}/${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(MEAL_IMAGES_BUCKET)
    .upload(filePath, fileData, { contentType, upsert: true });

  if (uploadError) throw uploadError;

  const { data: publicData } = supabase.storage.from(MEAL_IMAGES_BUCKET).getPublicUrl(filePath);
  return publicData.publicUrl;
};

export const fetchMealsForUser = async (userId: string, limitToDate?: string): Promise<MealEntry[]> => {
  let query = supabase
    .from('meals')
    .select(`
      *,
      food_items (*)
    `)
    .eq('user_id', userId);

  // If a date limit is provided, only fetch meals from that date onwards
  if (limitToDate) {
    query = query.gte('day_id', limitToDate);
  }

  const { data, error } = await query
    .order('day_id', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toMealEntry);
};

export const fetchMealsForDay = async (userId: string, dayId: string): Promise<MealEntry[]> => {
  const { data, error } = await supabase
    .from('meals')
    .select(`
      *,
      food_items (*)
    `)
    .eq('user_id', userId)
    .eq('day_id', dayId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toMealEntry);
};

export const insertMeal = async (params: {
  userId: string;
  dayId: string;
  name: string;
  time: string;
  imageUri?: string;
  foods: Omit<FoodItem, 'id'>[];
}): Promise<MealEntry> => {
  const { userId, dayId, name, time, imageUri, foods } = params;

  // Upload image to Supabase Storage if it's a local file
  let finalImageUri: string | null = null;
  if (imageUri) {
    try {
      finalImageUri = await uploadMealImage(userId, imageUri);
    } catch (e) {
      console.warn('Failed to upload meal image, saving without image:', e);
    }
  }

  const { data: mealData, error: mealError } = await supabase
    .from('meals')
    .insert([
      {
        user_id: userId,
        day_id: dayId,
        name,
        time,
        image_uri: finalImageUri,
      },
    ])
    .select()
    .single();

  if (mealError) throw mealError;

  const mealId = mealData.id;

  if (foods.length > 0) {
    const { data: foodData, error: foodError } = await supabase
      .from('food_items')
      .insert(
        foods.map((f) => ({
          meal_id: mealId,
          name: f.name,
          quantity: f.quantity,
          calories: f.calories,
          protein: f.protein,
          carbs: f.carbs,
          fat: f.fat,
        }))
      )
      .select();

    if (foodError) throw foodError;

    return toMealEntry({ ...mealData, food_items: foodData } as MealWithFoods);
  }

  return toMealEntry({ ...mealData, food_items: [] } as MealWithFoods);
};

export const updateMealMeta = async (params: {
  mealId: string;
  userId: string;
  updates: {
    name?: string;
    time?: string;
    dayId?: string;
    imageUri?: string;
  };
}): Promise<MealEntry> => {
  const { mealId, userId, updates } = params;

  const payload: Record<string, unknown> = {};
  if (updates.name) payload.name = updates.name;
  if (updates.time) payload.time = updates.time;
  if (updates.dayId) payload.day_id = updates.dayId;
  
  // Upload image to Supabase Storage if it's a local file
  if (updates.imageUri !== undefined) {
    if (updates.imageUri) {
      try {
        payload.image_uri = await uploadMealImage(userId, updates.imageUri);
      } catch (e) {
        console.warn('Failed to upload meal image:', e);
        // Keep the existing image if upload fails
      }
    } else {
      payload.image_uri = null; // Explicitly removing the image
    }
  }

  const { data: mealData, error: mealError } = await supabase
    .from('meals')
    .update(payload)
    .eq('id', mealId)
    .eq('user_id', userId)
    .select()
    .single();

  if (mealError) throw mealError;

  const { data: foodData, error: foodError } = await supabase
    .from('food_items')
    .select('*')
    .eq('meal_id', mealId);

  if (foodError) throw foodError;

  return toMealEntry({ ...mealData, food_items: foodData ?? [] } as MealWithFoods);
};

export const updateMealFoods = async (params: {
  mealId: string;
  userId: string;
  foods: FoodItem[];
}): Promise<MealEntry> => {
  const { mealId, userId, foods = [] } = params;

  if (!mealId || !userId || !isUuid(mealId) || !isUuid(userId)) {
    throw new Error('Invalid meal or user id');
  }

  const { error: deleteError } = await supabase.from('food_items').delete().eq('meal_id', mealId);

  if (deleteError) throw deleteError;

  if (foods.length > 0) {
    const rows = foods.map((f) => {
      const row: Record<string, unknown> = {
        meal_id: mealId,
        name: f.name,
        quantity: f.quantity,
        calories: f.calories,
        protein: f.protein,
        carbs: f.carbs,
        fat: f.fat,
      };

      if (isUuid(f.id)) {
        row.id = f.id;
      }

      return row;
    });

    const { error: insertError } = await supabase.from('food_items').insert(rows);

    if (insertError) throw insertError;
  }

  const { data: mealData, error: mealError } = await supabase
    .from('meals')
    .select(`
      *,
      food_items (*)
    `)
    .eq('id', mealId)
    .eq('user_id', userId)
    .single();

  if (mealError) throw mealError;

  return toMealEntry(mealData as MealWithFoods);
};

export const addFoodToMeal = async (params: {
  mealId: string;
  userId: string;
  food: Omit<FoodItem, 'id'>;
}): Promise<FoodItem> => {
  const { mealId, userId, food } = params;

  const { data: mealCheck } = await supabase
    .from('meals')
    .select('id')
    .eq('id', mealId)
    .eq('user_id', userId)
    .single();

  if (!mealCheck) throw new Error('Meal not found or unauthorized');

  const { data, error } = await supabase
    .from('food_items')
    .insert([
      {
        meal_id: mealId,
        name: food.name,
        quantity: food.quantity,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    quantity: data.quantity,
    calories: data.calories,
    protein: data.protein,
    carbs: data.carbs,
    fat: data.fat,
  };
};

export const deleteMeal = async (params: { mealId: string; userId: string }): Promise<void> => {
  const { mealId, userId } = params;
  const { error } = await supabase.from('meals').delete().eq('id', mealId).eq('user_id', userId);
  if (error) throw error;
};
