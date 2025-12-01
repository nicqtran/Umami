import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const USDA_API_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

// Step 1: AI identifies foods and portions from image
const IDENTIFICATION_PROMPT = `You are a multicultural food recognition expert. Analyze this food image and identify ALL visible food items.

IMPORTANT: Recognize foods from ALL cuisines including:
- Vietnamese: phở, bún bò Huế, bánh mì, gỏi cuốn, cơm tấm, chả giò
- Japanese: ramen, katsu, sushi, tempura, donburi, udon
- Korean: bibimbap, bulgogi, kimchi, japchae, tteokbokki
- Chinese: dim sum, fried rice, lo mein, kung pao, mapo tofu
- Thai: pad thai, green curry, tom yum, som tam
- Indian: curry, naan, biryani, samosa, dal
- Mexican: tacos, burritos, enchiladas, pozole
- And all other world cuisines

For COMPLEX DISHES (soups, bowls, stews), break down into components:
Example - Phở:
- Rice noodles (2 cups)
- Beef broth (2 cups)  
- Beef slices (4 oz)
- Bean sprouts (0.5 cup)
- Fresh herbs/basil (0.25 cup)
- Hoisin sauce (1 tbsp)
- Sriracha (1 tsp)

Return a JSON object:
{
  "mealName": "Name in original language + English (e.g., 'Phở Bò - Vietnamese Beef Noodle Soup')",
  "items": [
    {
      "searchName": "simple ingredient for database (e.g., 'rice noodles', 'beef sirloin')",
      "displayName": "descriptive name (e.g., 'Flat Rice Noodles')",
      "quantity": "amount with units",
      "servings": number
    }
  ]
}

Guidelines:
- ALWAYS break down complex dishes into individual components
- searchName = simple English ingredient name for nutrition database lookup
- displayName = can include cultural context
- For broths/soups: separate the liquid, protein, noodles, and toppings
- For fried foods: note if deep-fried (adds ~50% more calories)
- Typical Asian soup bowl = 2-3 cups broth
- Typical rice serving in Asian cuisine = 1.5 cups (larger than Western)

Return ONLY valid JSON, no markdown.`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Common international food mappings to help USDA search
const FOOD_ALIASES: Record<string, string> = {
  // Vietnamese
  'pho broth': 'beef broth',
  'pho noodles': 'rice noodles',
  'banh mi bread': 'french baguette',
  'cha lua': 'pork sausage',
  'nem nuong': 'grilled pork',
  // Japanese
  'katsu': 'breaded fried pork cutlet',
  'tonkatsu': 'breaded fried pork cutlet',
  'chicken katsu': 'breaded fried chicken',
  'ramen noodles': 'chinese noodles',
  'ramen broth': 'pork broth',
  'udon noodles': 'wheat noodles',
  'soba noodles': 'buckwheat noodles',
  'tempura batter': 'fried batter',
  // Korean
  'gochujang': 'hot pepper paste',
  'kimchi': 'fermented cabbage',
  'bulgogi': 'marinated beef',
  // Thai
  'pad thai noodles': 'rice noodles',
  'fish sauce': 'fish sauce',
  // General Asian
  'hoisin sauce': 'hoisin sauce',
  'sriracha': 'hot sauce',
  'bean sprouts': 'mung bean sprouts',
  'bok choy': 'chinese cabbage',
};

// Helper: Search USDA database for a food
async function searchUSDA(foodName: string, apiKey: string): Promise<any | null> {
  // Try alias first
  const searchTerm = FOOD_ALIASES[foodName.toLowerCase()] || foodName;
  
  const trySearch = async (query: string) => {
    try {
      const response = await fetch(`${USDA_API_URL}?api_key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          pageSize: 5,
          dataType: ['Survey (FNDDS)', 'Foundation', 'SR Legacy'],
        }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data.foods?.[0] || null;
    } catch {
      return null;
    }
  };

  // Try the search term
  let food = await trySearch(searchTerm);
  
  // If no result, try simplifying (remove adjectives)
  if (!food && searchTerm !== foodName) {
    food = await trySearch(foodName);
  }
  
  // If still no result, try just the main noun
  if (!food) {
    const words = foodName.split(' ');
    if (words.length > 1) {
      // Try last word (usually the main food)
      food = await trySearch(words[words.length - 1]);
    }
  }

  if (!food) {
    console.log(`No USDA match for: "${foodName}"`);
    return null;
  }

  // Extract nutrients (USDA nutrient IDs)
  const nutrients = food.foodNutrients || [];
  const getNutrient = (id: number) => {
    const n = nutrients.find((x: any) => x.nutrientId === id);
    return n?.value || 0;
  };

  return {
    name: food.description,
    caloriesPer100g: getNutrient(1008),
    proteinPer100g: getNutrient(1003),
    carbsPer100g: getNutrient(1005),
    fatPer100g: getNutrient(1004),
  };
}

// Helper: Convert quantity to grams for calculation
function estimateGrams(quantity: string): number {
  const q = quantity.toLowerCase();
  
  // Extract number from string
  const numMatch = q.match(/[\d.]+/);
  const num = numMatch ? parseFloat(numMatch[0]) : 1;
  
  // Common conversions to grams
  if (q.includes('oz')) return num * 28.35;
  if (q.includes('lb')) return num * 453.6;
  if (q.includes('cup')) return num * 240; // rough average
  if (q.includes('tbsp') || q.includes('tablespoon')) return num * 15;
  if (q.includes('tsp') || q.includes('teaspoon')) return num * 5;
  if (q.includes('slice')) return num * 30;
  if (q.includes('piece') || q.includes('medium')) return num * 150;
  if (q.includes('large')) return num * 200;
  if (q.includes('small')) return num * 100;
  if (q.includes('g') || q.includes('gram')) return num;
  
  // Default: assume it's a medium serving
  return num * 150;
}

// Fallback nutrition data for international foods (per 100g)
// Values are approximate averages from various sources
const FALLBACK_NUTRITION: Record<string, { cal: number; pro: number; carb: number; fat: number }> = {
  // Vietnamese
  'rice noodles': { cal: 109, pro: 0.9, carb: 25, fat: 0.2 },
  'pho broth': { cal: 10, pro: 1, carb: 1, fat: 0.3 },
  'beef broth': { cal: 13, pro: 1.5, carb: 0.5, fat: 0.5 },
  'fish sauce': { cal: 35, pro: 5, carb: 4, fat: 0 },
  'hoisin sauce': { cal: 220, pro: 3, carb: 44, fat: 3 },
  'sriracha': { cal: 93, pro: 2, carb: 19, fat: 1 },
  'bean sprouts': { cal: 31, pro: 3, carb: 6, fat: 0.2 },
  'fresh herbs': { cal: 22, pro: 2, carb: 3, fat: 0.5 },
  'cilantro': { cal: 23, pro: 2, carb: 4, fat: 0.5 },
  'thai basil': { cal: 23, pro: 3, carb: 3, fat: 0.6 },
  // Japanese
  'ramen noodles': { cal: 138, pro: 4.5, carb: 26, fat: 2 },
  'tonkotsu broth': { cal: 50, pro: 4, carb: 2, fat: 3 },
  'miso broth': { cal: 40, pro: 3, carb: 5, fat: 1 },
  'chashu pork': { cal: 290, pro: 18, carb: 5, fat: 22 },
  'breaded pork cutlet': { cal: 297, pro: 15, carb: 15, fat: 20 },
  'breaded chicken cutlet': { cal: 260, pro: 20, carb: 12, fat: 15 },
  'tempura': { cal: 250, pro: 8, carb: 25, fat: 13 },
  'sushi rice': { cal: 130, pro: 2.5, carb: 28, fat: 0.3 },
  'nori seaweed': { cal: 35, pro: 6, carb: 5, fat: 0.3 },
  'pickled ginger': { cal: 20, pro: 0.2, carb: 4, fat: 0 },
  // Korean
  'kimchi': { cal: 15, pro: 1, carb: 2, fat: 0.5 },
  'gochujang': { cal: 130, pro: 4, carb: 24, fat: 2 },
  'bulgogi beef': { cal: 190, pro: 20, carb: 8, fat: 9 },
  'japchae noodles': { cal: 160, pro: 0.1, carb: 39, fat: 0 },
  // Thai
  'pad thai noodles': { cal: 109, pro: 0.9, carb: 25, fat: 0.2 },
  'coconut milk': { cal: 230, pro: 2, carb: 6, fat: 24 },
  'thai curry paste': { cal: 94, pro: 2, carb: 12, fat: 5 },
  'peanut sauce': { cal: 200, pro: 8, carb: 12, fat: 14 },
  // Chinese
  'lo mein noodles': { cal: 138, pro: 5, carb: 25, fat: 2 },
  'fried rice': { cal: 163, pro: 4, carb: 24, fat: 6 },
  'wonton wrapper': { cal: 290, pro: 8, carb: 55, fat: 3 },
  'oyster sauce': { cal: 51, pro: 1, carb: 11, fat: 0 },
  'soy sauce': { cal: 53, pro: 8, carb: 5, fat: 0 },
  // Indian
  'naan bread': { cal: 290, pro: 9, carb: 50, fat: 6 },
  'basmati rice': { cal: 130, pro: 2.5, carb: 28, fat: 0.4 },
  'dal lentils': { cal: 116, pro: 9, carb: 20, fat: 0.4 },
  'curry sauce': { cal: 80, pro: 2, carb: 8, fat: 5 },
  'ghee': { cal: 900, pro: 0, carb: 0, fat: 100 },
  // Mexican
  'corn tortilla': { cal: 218, pro: 6, carb: 44, fat: 3 },
  'flour tortilla': { cal: 312, pro: 8, carb: 52, fat: 8 },
  'refried beans': { cal: 91, pro: 5, carb: 13, fat: 2 },
  'guacamole': { cal: 150, pro: 2, carb: 9, fat: 13 },
  'salsa': { cal: 36, pro: 2, carb: 7, fat: 0.2 },
  'queso': { cal: 290, pro: 16, carb: 3, fat: 24 },
};

// Helper: Get fallback nutrition for international foods
function getFallbackNutrition(foodName: string): { cal: number; pro: number; carb: number; fat: number } | null {
  const name = foodName.toLowerCase();
  
  // Direct match
  if (FALLBACK_NUTRITION[name]) {
    return FALLBACK_NUTRITION[name];
  }
  
  // Partial match
  for (const [key, value] of Object.entries(FALLBACK_NUTRITION)) {
    if (name.includes(key) || key.includes(name)) {
      return value;
    }
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const usdaApiKey = Deno.env.get('USDA_API_KEY');
    
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { imageBase64, mimeType = 'image/jpeg' } = await req.json();
    
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Missing imageBase64' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Use Gemini to identify foods in the image
    const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: IDENTIFICATION_PROMPT },
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
          ],
        }],
        generationConfig: {
          temperature: 0.3,
          topK: 32,
          topP: 1,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      return new Response(
        JSON.stringify({ error: `AI service error: ${geminiResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiResponse.json();
    const textResponse = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textResponse) {
      return new Response(
        JSON.stringify({ error: 'No response from AI' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse Gemini response
    let cleanedResponse = textResponse.trim();
    if (cleanedResponse.startsWith('```json')) cleanedResponse = cleanedResponse.slice(7);
    if (cleanedResponse.startsWith('```')) cleanedResponse = cleanedResponse.slice(3);
    if (cleanedResponse.endsWith('```')) cleanedResponse = cleanedResponse.slice(0, -3);
    cleanedResponse = cleanedResponse.trim();

    const identified = JSON.parse(cleanedResponse);
    
    if (identified.error || !identified.items?.length) {
      return new Response(
        JSON.stringify({ success: false, error: identified.error || 'No foods identified' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Look up each food in USDA database (if API key available)
    const foods = await Promise.all(
      identified.items.map(async (item: any) => {
        let calories = 0, protein = 0, carbs = 0, fat = 0;
        
        // Try USDA lookup if API key is configured
        if (usdaApiKey) {
          const usdaData = await searchUSDA(item.searchName, usdaApiKey);
          
          if (usdaData) {
            // Calculate nutrition based on quantity
            const grams = estimateGrams(item.quantity);
            const multiplier = grams / 100; // USDA gives per 100g
            
            calories = Math.round(usdaData.caloriesPer100g * multiplier);
            protein = Math.round(usdaData.proteinPer100g * multiplier);
            carbs = Math.round(usdaData.carbsPer100g * multiplier);
            fat = Math.round(usdaData.fatPer100g * multiplier);
            
            console.log(`USDA match for "${item.searchName}": ${usdaData.name} (${grams}g = ${calories} cal)`);
          } else {
            console.log(`No USDA match for "${item.searchName}", using AI estimate`);
          }
        }
        
        // If no USDA data, try fallback database for international foods
        if (calories === 0) {
          const fallback = getFallbackNutrition(item.searchName);
          if (fallback) {
            const grams = estimateGrams(item.quantity);
            const multiplier = grams / 100;
            calories = Math.round(fallback.cal * multiplier);
            protein = Math.round(fallback.pro * multiplier);
            carbs = Math.round(fallback.carb * multiplier);
            fat = Math.round(fallback.fat * multiplier);
            console.log(`Fallback match for "${item.searchName}": ${calories} cal`);
          } else {
            // Last resort: estimate based on servings
            const servings = item.servings || 1;
            calories = Math.round(200 * servings);
            protein = Math.round(15 * servings);
            carbs = Math.round(20 * servings);
            fat = Math.round(8 * servings);
          }
        }

        return {
          name: item.displayName || item.searchName,
          quantity: item.quantity,
          calories,
          protein,
          carbs,
          fat,
        };
      })
    );

    const mealName = identified.mealName || 'Scanned meal';

    return new Response(
      JSON.stringify({ success: true, foods, mealName }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
