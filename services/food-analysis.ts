import { supabase } from '@/lib/supabase';
import { getLocalTimezone } from '@/services/access';
import { AccessStatus } from '@/types/access';
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
  access?: AccessStatus;
} | {
  success: false;
  error: string;
  state?: string;
  access?: AccessStatus;
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
    const timezone = getLocalTimezone();

    // Call the Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('analyze-food', {
      body: {
        imageBase64: base64Image,
        mimeType,
        timezone,
      },
    });

    if (error) {
      const status = (error as any)?.context?.status ?? (error as any)?.status ?? 'unknown status';
      let message = error.message || 'Failed to analyze image';
      let state = data?.state as string | undefined;
      let access = data?.access as AccessStatus | undefined;

      // Try to read the edge function error body for a more helpful message
      const response = (error as any)?.context;
      if (response && typeof response.text === 'function') {
        try {
          const clone = typeof response.clone === 'function' ? response.clone() : response;
          const bodyText = await clone.text();
          try {
            const bodyJson = JSON.parse(bodyText);
            message = bodyJson?.error || message;
            state = bodyJson?.state ?? state;
            access = bodyJson?.access ?? access;
          } catch {
            if (bodyText) {
              console.warn('Edge function error body:', bodyText);
            }
          }
        } catch (parseError) {
          console.warn('Failed to read edge function error response', parseError);
        }
      }

      console.warn('Edge function error', { message, status });
      return {
        success: false,
        error: `${message} (${status})`,
        state,
        access,
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
        state: data?.state,
        access: data?.access,
      };
    }

    // Return successful result
    return {
      success: true,
      foods: data.foods || [],
      mealName: data.mealName || 'Scanned meal',
      access: data?.access,
    };

  } catch (error) {
    console.error('Food analysis error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze image',
    };
  }
}
