import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const ANALYSIS_PROMPT = `Analyze this food image and provide nutritional estimates.

Return a JSON object with this exact structure:
{
  "mealName": "A short descriptive name for the overall meal (e.g., 'Chicken Salad', 'Breakfast Burrito')",
  "foods": [
    {
      "name": "Food item name",
      "quantity": "Estimated portion size (e.g., '1 cup', '6 oz', '2 slices')",
      "calories": number,
      "protein": number (grams),
      "carbs": number (grams),
      "fat": number (grams)
    }
  ]
}

Guidelines:
- Identify each distinct food item visible in the image
- Estimate realistic portion sizes based on visual cues
- Provide reasonable nutritional estimates based on typical values for each food
- If you cannot identify food in the image, return: {"mealName": "Unknown", "foods": [], "error": "Could not identify food in image"}
- Round all numbers to whole integers
- Be conservative with estimates when uncertain

Return ONLY the JSON object, no additional text or markdown formatting.`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the Gemini API key from environment (set via Supabase secrets)
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured in Supabase secrets');
    }

    // Verify the user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client to verify the JWT
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

    // Parse request body
    const { imageBase64, mimeType = 'image/jpeg' } = await req.json();
    
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Missing imageBase64 in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare the request payload for Gemini
    const requestBody = {
      contents: [
        {
          parts: [
            { text: ANALYSIS_PROMPT },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        topK: 32,
        topP: 1,
        maxOutputTokens: 1024,
      },
    };

    // Call the Gemini API
    const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      return new Response(
        JSON.stringify({ error: `Gemini API error: ${geminiResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiResponse.json();
    
    // Extract the text response from Gemini
    const textResponse = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textResponse) {
      return new Response(
        JSON.stringify({ error: 'No response from AI model' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean up the response in case it has markdown code blocks
    let cleanedResponse = textResponse.trim();
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.slice(7);
    }
    if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.slice(3);
    }
    if (cleanedResponse.endsWith('```')) {
      cleanedResponse = cleanedResponse.slice(0, -3);
    }
    cleanedResponse = cleanedResponse.trim();

    // Parse and validate the response
    const parsedResult = JSON.parse(cleanedResponse);

    // Check for error in response
    if (parsedResult.error) {
      return new Response(
        JSON.stringify({ success: false, error: parsedResult.error }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize the foods array
    const foods = (parsedResult.foods || []).map((food: any) => ({
      name: String(food.name || 'Unknown food'),
      quantity: String(food.quantity || '1 serving'),
      calories: Math.round(Number(food.calories) || 0),
      protein: Math.round(Number(food.protein) || 0),
      carbs: Math.round(Number(food.carbs) || 0),
      fat: Math.round(Number(food.fat) || 0),
    }));

    const mealName = String(parsedResult.mealName || 'Scanned meal');

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

