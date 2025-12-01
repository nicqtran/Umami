# Umami - AI-Powered Calorie Tracker

A modern calorie and macro tracking app with AI-powered food recognition.

## Features

- **AI Food Scanner** - Take a photo of your meal and get instant calorie/macro estimates
- **Daily Tracking** - Track calories, protein, carbs, and fat
- **Weight Logging** - Monitor your weight over time
- **Goal Setting** - Set and track your nutrition goals

## Get Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Create a `.env` file in the project root:

```bash
# Supabase (required for data storage)
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Deploy the AI Food Scanner (Edge Function)

The AI food scanning feature uses a Supabase Edge Function to securely call the Google Gemini API. This keeps your API key safe on the server.

#### Step 1: Get a Gemini API Key (Free)

1. Go to [Google AI Studio](https://aistudio.google.com)
2. Sign in with your Google account
3. Click "Get API Key" in the left sidebar
4. Create a new API key and copy it

The free tier includes 15 requests per minute - plenty for personal use.

#### Step 2: Install Supabase CLI

```bash
npm install -g supabase
```

#### Step 3: Login to Supabase

```bash
supabase login
```

#### Step 4: Link your project

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

(Find your project ref in your Supabase dashboard URL: `supabase.com/dashboard/project/YOUR_PROJECT_REF`)

#### Step 5: Set API keys as secrets

**Gemini API Key** (required):
```bash
supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here
```

**USDA API Key** (optional, for more accurate nutrition data):
1. Get a free API key at [USDA FoodData Central](https://fdc.nal.usda.gov/api-key-signup.html)
2. Set it as a secret:
```bash
supabase secrets set USDA_API_KEY=your_usda_api_key_here
```

The USDA database has 300k+ foods with lab-verified nutrition data. If configured, the AI will look up identified foods in this database for accurate values instead of estimating.

#### Step 6: Deploy the Edge Function

```bash
supabase functions deploy analyze-food
```

That's it! Your API key is now securely stored on Supabase's servers, not in your app.

### 4. Start the app

```bash
npx expo start
```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

## Project Structure

```
├── app/                    # App screens (file-based routing)
├── components/             # Reusable UI components
├── services/               # API service functions
│   ├── food-analysis.ts    # AI food scanning (calls Edge Function)
│   ├── meals.ts            # Meal CRUD operations
│   └── ...
├── state/                  # State management
├── supabase/
│   └── functions/
│       └── analyze-food/   # Edge Function for secure AI calls
└── lib/
    └── supabase.ts         # Supabase client config
```

## How the AI Food Scanner Works

1. **User takes a photo** of their meal
2. **App sends image** to Supabase Edge Function (authenticated)
3. **Edge Function calls Gemini** with the image (API key stays on server)
4. **AI analyzes the food** and returns nutritional estimates
5. **Meal is created** with detected foods pre-populated
6. **User can review/edit** the detected items

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Google Gemini API](https://ai.google.dev/docs)
