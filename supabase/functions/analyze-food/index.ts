import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Gemini prompt to identify foods AND calculate nutrition directly
const ANALYSIS_PROMPT = `You are a multicultural food recognition expert and nutritionist. Analyze this food image, identify ALL visible food items, and calculate their nutritional values.

CRITICAL - ACCURATE PORTION SIZE ESTIMATION:
Use visual references to estimate portions accurately:
- A standard dinner plate is 10-11 inches diameter
- A fist = approximately 1 cup or 4 oz of solid food
- Palm of hand (no fingers) = approximately 3 oz of meat
- Thumb tip = approximately 1 teaspoon
- Whole thumb = approximately 1 tablespoon
- Cupped hand = approximately 1/2 cup

MEAT PORTION GUIDELINES (cooked weight):
- Small bite-sized piece of meat (1 inch cube) = 0.5-0.75 oz
- Medium piece of meat (1.5 inch cube) = 1-1.5 oz
- Chicken nugget size = 0.5-0.75 oz each
- Typical pork belly piece (Korean BBQ style, 1.5x1.5 inch) = 0.75-1 oz each
- A deck of cards = 3 oz of meat
- 10-15 bite-sized pieces of meat = typically 6-10 oz total, NOT 20 oz

IMPORTANT: Recognize foods from ALL cuisines including:
- Vietnamese: phở, bún bò Huế, bánh mì, gỏi cuốn, cơm tấm, chả giò
- Japanese: ramen, katsu, sushi, tempura, donburi, udon
- Korean: bibimbap, bulgogi, kimchi, japchae, tteokbokki, samgyeopsal
- Chinese: dim sum, fried rice, lo mein, kung pao, mapo tofu
- Thai: pad thai, green curry, tom yum, som tam
- Indian: curry, naan, biryani, samosa, dal
- Mexican: tacos, burritos, enchiladas, pozole
- And all other world cuisines

FAST FOOD & RESTAURANT ITEMS: Recognize common items from known chains:
- McDonald's: Big Mac, McChicken, Quarter Pounder, McNuggets, McFlurry, fries
- Chick-fil-A: Original Sandwich, Spicy Deluxe, nuggets, waffle fries
- Chipotle: burrito bowls, burritos, tacos, chips & guac
- Taco Bell: Crunchwrap Supreme, Chalupa, Baja Blast, nachos
- Subway: footlong/6-inch subs, cookies
- Starbucks: Frappuccinos, lattes, pastries, sandwiches
- Panda Express: orange chicken, Beijing beef, chow mein, fried rice
- In-N-Out: Double-Double, Animal Style fries, protein style burgers
- Five Guys: burgers, Cajun fries, milkshakes
- Wendy's: Baconator, Frosty, spicy chicken sandwich
- Popeyes: chicken sandwich, tenders, biscuits, Cajun fries
- Dunkin': donuts, munchkins, iced coffee, breakfast sandwiches
- Pizza chains: recognize slice sizes, deep dish vs thin crust
- Use accurate published nutrition data for these known menu items when identified

NUTRITION REFERENCE VALUES (per oz cooked):
- Cooked pork belly: ~75-85 calories, 5g protein, 0g carbs, 7g fat per oz
- Cooked bacon: ~45 calories, 3g protein, 0g carbs, 3.5g fat per oz
- Cooked chicken breast: ~45 calories, 8g protein, 0g carbs, 1g fat per oz
- Cooked beef (lean): ~55 calories, 8g protein, 0g carbs, 2.5g fat per oz
- Cooked beef (fatty): ~75 calories, 7g protein, 0g carbs, 5g fat per oz
- Cooked salmon: ~55 calories, 7g protein, 0g carbs, 3g fat per oz

For COMPLEX DISHES (soups, bowls, stews), break down into components:
Example - Phở:
- Rice noodles (2 cups) - 220 cal, 2g protein, 50g carbs, 0g fat
- Beef broth (2 cups) - 40 cal, 5g protein, 1g carbs, 2g fat
- Beef slices (4 oz) - 280 cal, 26g protein, 0g carbs, 19g fat
- Bean sprouts (0.5 cup) - 15 cal, 2g protein, 3g carbs, 0g fat
- Fresh herbs/basil (0.25 cup) - 5 cal, 0g protein, 1g carbs, 0g fat
- Hoisin sauce (1 tbsp) - 35 cal, 1g protein, 7g carbs, 1g fat
- Sriracha (1 tsp) - 5 cal, 0g protein, 1g carbs, 0g fat

Return a JSON object:
{
  "mealName": "Name in original language + English (e.g., 'Phở Bò - Vietnamese Beef Noodle Soup')",
  "items": [
    {
      "name": "descriptive name (e.g., 'Flat Rice Noodles')",
      "quantity": "amount with units",
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number
    }
  ]
}

Guidelines:
- ALWAYS break down complex dishes into individual components
- name: can include cultural context
- quantity: estimated amount using oz, cups, tbsp, or pieces - BE CONSERVATIVE with weight estimates
- calories: total calories for the quantity (integer) - DOUBLE CHECK this matches the weight and per-oz values
- protein: grams of protein for the quantity (integer)
- carbs: grams of carbohydrates for the quantity (integer)
- fat: grams of fat for the quantity (integer)
- For broths/soups: separate the liquid, protein, noodles, and toppings
- For fried foods: note if deep-fried (adds ~50% more calories)
- Typical Asian soup bowl = 2-3 cups broth
- Typical rice serving in Asian cuisine = 1.5 cups (larger than Western)
- CRITICAL: Count the actual pieces visible and multiply by per-piece weight. Do NOT overestimate.
- Example: 13 pieces of pork belly at ~0.7 oz each = 9.1 oz total, ~600-750 calories
- Limit to 8 most significant items
- Group similar ingredients together

Return ONLY valid JSON, no markdown.`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function tryParseJsonStrictish(raw: string): any | null {
  const trimmed = raw.trim();
  // First attempt: direct JSON.parse
  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue
  }

  // Try to extract the substring between the first "{" and last "}"
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    const slice = trimmed.slice(start, end + 1);
    try {
      return JSON.parse(slice);
    } catch {
      // Continue
    }
  }

  // Try to repair truncated JSON by closing unclosed brackets
  if (start !== -1) {
    let slice = trimmed.slice(start);
    // Count unclosed brackets
    let openBraces = 0, openBrackets = 0;
    let inString = false, escape = false;
    for (const char of slice) {
      if (escape) { escape = false; continue; }
      if (char === '\\') { escape = true; continue; }
      if (char === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (char === '{') openBraces++;
      if (char === '}') openBraces--;
      if (char === '[') openBrackets++;
      if (char === ']') openBrackets--;
    }
    // If we have unclosed structures, try to close them
    if (openBraces > 0 || openBrackets > 0) {
      // Remove trailing incomplete property (ends with comma or unfinished value)
      slice = slice.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"]*$/, '');
      slice = slice.replace(/,\s*$/, '');
      // Close arrays then objects
      slice += ']'.repeat(Math.max(0, openBrackets)) + '}'.repeat(Math.max(0, openBraces));
      try {
        return JSON.parse(slice);
      } catch {
        // Continue
      }
    }
  }

  // Last resort: quote unquoted keys in an object-ish string
  const quoted = trimmed.replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":');
  try {
    return JSON.parse(quoted);
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

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
    const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseKey || !supabaseAnonKey) {
      throw new Error('Missing SUPABASE_URL, SERVICE_ROLE_KEY, or SUPABASE_ANON_KEY');
    }

    // Use anon key + user token to validate the caller
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role (no user token) for RPCs that require service_role
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const { imageBase64, mimeType = 'image/jpeg', timezone = null } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Missing imageBase64' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Guardrails: check entitlement and increment usage atomically before hitting Gemini
    const { data: access, error: accessError } = await supabaseAdmin.rpc('get_access_status', {
      p_user_id: user.id,
      p_timezone: timezone,
      p_increment: true,
    });

    if (accessError || !access) {
      const message = accessError?.message || 'Unable to verify access';
      return new Response(
        JSON.stringify({ success: false, error: message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (access.reason) {
      const friendlyError = access.reason === 'daily_limit_reached'
        ? 'Daily scan limit reached'
        : 'Scan not allowed';
      return new Response(
        JSON.stringify({ success: false, error: friendlyError, state: access.state, access }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use Gemini to identify foods AND get nutrition values
    const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: ANALYSIS_PROMPT },
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
          ],
        }],
        generationConfig: {
          temperature: 0.3,
          topK: 32,
          topP: 1,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      // Refund the scan since analysis failed
      await supabaseAdmin.rpc('refund_scan_usage', { p_user_id: user.id, p_timezone: timezone });
      const message = errorText
        ? `AI service error (${geminiResponse.status}): ${errorText}`
        : `AI service error: ${geminiResponse.status}`;
      return new Response(
        JSON.stringify({ success: false, error: message, refunded: true }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiResponse.json();
    const candidate = geminiData?.candidates?.[0];
    const textResponse = candidate?.content?.parts?.[0]?.text;
    const finishReason = candidate?.finishReason;

    if (!textResponse) {
      // Refund the scan since analysis failed
      await supabaseAdmin.rpc('refund_scan_usage', { p_user_id: user.id, p_timezone: timezone });
      return new Response(
        JSON.stringify({ success: false, error: 'No response from AI', refunded: true }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if response was truncated
    if (finishReason === 'MAX_TOKENS') {
      console.warn('Gemini response was truncated due to max tokens');
    }

    // Parse Gemini response
    let cleanedResponse = textResponse.trim();
    if (cleanedResponse.startsWith('```json')) cleanedResponse = cleanedResponse.slice(7);
    if (cleanedResponse.startsWith('```')) cleanedResponse = cleanedResponse.slice(3);
    if (cleanedResponse.endsWith('```')) cleanedResponse = cleanedResponse.slice(0, -3);
    cleanedResponse = cleanedResponse.trim();

    const analyzed = tryParseJsonStrictish(cleanedResponse);

    if (!analyzed) {
      console.error('Failed to parse Gemini response:', cleanedResponse);
      // Refund the scan since we couldn't parse the response
      await supabaseAdmin.rpc('refund_scan_usage', { p_user_id: user.id, p_timezone: timezone });
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Could not analyze this image. Please try again with a clearer photo.',
          refunded: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (analyzed.error || !analyzed.items?.length) {
      // Refund the scan since no foods were identified
      await supabaseAdmin.rpc('refund_scan_usage', { p_user_id: user.id, p_timezone: timezone });
      return new Response(
        JSON.stringify({ success: false, error: analyzed.error || 'No foods identified in image. Please try again.', access, refunded: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map items directly from Gemini response (nutrition already included)
    const foods = analyzed.items.map((item: any) => ({
      name: item.name,
      quantity: item.quantity,
      calories: Math.round(item.calories || 0),
      protein: Math.round(item.protein || 0),
      carbs: Math.round(item.carbs || 0),
      fat: Math.round(item.fat || 0),
    }));

    const mealName = analyzed.mealName || 'Scanned meal';

    return new Response(
      JSON.stringify({ success: true, foods, mealName, access }),
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
