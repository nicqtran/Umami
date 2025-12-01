import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';

export type AnalyzedFood = {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type FoodAnalysisResult = {
  success: true;
  foods: AnalyzedFood[];
  mealName: string;
} | {
  success: false;
  error: string;
};

/**
 * Analyzes a food image using the Supabase Edge Function (which calls Gemini securely)
 * @param imageUri - Local file URI of the image to analyze
 * @returns Analysis result with detected foods and nutritional info
 */
export async function analyzeFoodImage(imageUri: string): Promise<FoodAnalysisResult> {
  try {
    // Read the image file and convert to base64
    const base64Image = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64',
    });

    // Determine MIME type from URI
    const mimeType = imageUri.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';

    // Call the Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('analyze-food', {
      body: {
        imageBase64: base64Image,
        mimeType,
      },
    });

    if (error) {
      console.error('Edge function error:', JSON.stringify(error, null, 2));
      console.error('Error context:', error.context);
      return {
        success: false,
        error: `${error.message || 'Failed to analyze image'} (${error.context?.status || 'unknown status'})`,
      };
    }

    if (!data) {
      return {
        success: false,
        error: 'No response from analysis service',
      };
    }

    // Handle error response from the function
    if (data.error) {
      return {
        success: false,
        error: data.error,
      };
    }

    // Return successful result
    return {
      success: true,
      foods: data.foods || [],
      mealName: data.mealName || 'Scanned meal',
    };

  } catch (error) {
    console.error('Food analysis error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze image',
    };
  }
}
