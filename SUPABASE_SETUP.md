# Supabase Backend Setup Guide

This guide will help you complete the Supabase backend setup for your Umami app.

## Overview

Your app now has:
- ✅ Supabase client configured
- ✅ Authentication (login/signup)
- ✅ Profile service (fetch/upsert user profiles)
- ✅ Weight entries service (CRUD operations)
- ✅ Meals service (CRUD operations)
- ✅ Auto-loading data on user authentication

## Database Setup

### Step 1: Create Meals and Food Items Tables

You need to run the SQL schema to create the `meals` and `food_items` tables.

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/cjzsechbbzejfrscjtfy
2. Click on the **SQL Editor** in the left sidebar
3. Click **New query**
4. Copy the entire contents of `supabase-schema.sql` and paste it into the SQL editor
5. Click **Run** to execute the SQL

The schema will create:
- `meals` table with columns: id, user_id, day_id, name, time, image_uri, created_at, updated_at
- `food_items` table with columns: id, meal_id, name, quantity, calories, protein, carbs, fat, created_at
- Indexes for better query performance
- Row Level Security (RLS) policies to protect user data
- Auto-update trigger for `updated_at` timestamp

### Step 2: Verify Tables Are Created

1. Go to **Table Editor** in the left sidebar
2. You should see:
   - `profiles` (already exists)
   - `weight_entries` (already exists)
   - `meals` (newly created)
   - `food_items` (newly created)

### Step 3: Verify RLS Policies

1. Go to **Authentication** > **Policies** in the left sidebar
2. Verify each table has policies:
   - **meals**: Should have 4 policies (SELECT, INSERT, UPDATE, DELETE)
   - **food_items**: Should have 4 policies (SELECT, INSERT, UPDATE, DELETE)

## How the Backend Works

### Authentication Flow

1. User signs up or logs in via `app/login.tsx` or `app/signup.tsx`
2. Supabase creates a session and stores it in AsyncStorage
3. The `useSupabaseAuth` hook manages the auth state
4. When authenticated, `app/_layout.tsx` loads user data:
   - Profile data → updates user and goals state
   - Weight entries → loads into weight log state
   - Meals → loads into meals state

### Data Synchronization

All state mutation functions now sync with Supabase:

#### Weight Entries
```typescript
// Load all entries for user
await loadWeightEntriesFromDb(userId);

// Add new entry
await addWeightEntry(userId, weight, date, note);

// Update entry
await updateWeightEntry(userId, entryId, updates);

// Delete entry
await deleteWeightEntry(userId, entryId);
```

#### Meals
```typescript
// Load all meals for user
await loadMealsFromDb(userId);

// Add new meal
await addMeal(userId, mealData);

// Update meal metadata
await updateMealMeta(userId, mealId, updates);

// Update meal foods
await updateMealFoods(userId, mealId, foods);

// Add food to meal
await addFoodToMeal(userId, mealId, food);

// Delete meal
await deleteMeal(userId, mealId);
```

#### Profile
```typescript
// Load profile
await fetchProfile(userId);

// Update profile
await upsertProfile({ userId, name, email, age, ... });
```

## Important Notes

### Function Signatures Changed

The state mutation functions now require `userId` as the first parameter. When updating your UI components, make sure to pass the user ID:

**Before:**
```typescript
addWeightEntry(175, '2025-11-29', 'Morning weight');
deleteMeal('meal-id');
```

**After:**
```typescript
const { user } = useSupabaseAuth();
await addWeightEntry(user.id, 175, '2025-11-29', 'Morning weight');
await deleteMeal(user.id, 'meal-id');
```

### Sample Data

The `initializeSampleData` function in `state/weight-log.ts` has been updated to work with Supabase. If you want to populate sample data for testing:

```typescript
import { initializeSampleData } from '@/state/weight-log';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

const { user } = useSupabaseAuth();
if (user) {
  await initializeSampleData(user.id, 180, 175, 8); // startWeight, currentWeight, weeks
}
```

### Image Storage

Currently, meal images are stored as URIs in the database. If you want to use Supabase Storage for images:

1. Create a storage bucket in Supabase
2. Update the `addMeal` and `updateMealMeta` functions to upload images to storage
3. Store the public URL in the `image_uri` column

## Testing Your Setup

### 1. Test Authentication
- Sign up with a new account
- Verify a profile is created in the `profiles` table
- Log out and log back in

### 2. Test Weight Entries
- Add a weight entry in your app
- Check the `weight_entries` table in Supabase to verify it was saved
- Update and delete entries

### 3. Test Meals
- Add a meal with food items
- Check the `meals` and `food_items` tables
- Update meal details and foods
- Delete a meal

## Troubleshooting

### "relation does not exist" error
- Make sure you ran the SQL schema in the correct project
- Verify tables exist in Table Editor

### "permission denied" or RLS errors
- Check that RLS policies are enabled and correctly configured
- Make sure the user is authenticated before making requests

### Data not loading
- Check browser/app console for errors
- Verify the user ID is being passed correctly
- Check network tab to see if Supabase requests are being made

### Profile not updating
- The profile table uses `user_id` as primary key
- Use `upsertProfile` to update existing profiles

## Next Steps

1. **Run the SQL schema** in Supabase SQL Editor
2. **Test the authentication flow** by signing up/logging in
3. **Update your UI components** to use the new async function signatures
4. **Test CRUD operations** for weight entries and meals
5. **Remove sample data initialization** from production code

## File Reference

- Database Schema: [supabase-schema.sql](supabase-schema.sql)
- Supabase Client: [lib/supabase.ts](lib/supabase.ts)
- Auth Hook: [hooks/useSupabaseAuth.ts](hooks/useSupabaseAuth.ts)
- Services:
  - [services/profile.ts](services/profile.ts)
  - [services/weight-log.ts](services/weight-log.ts)
  - [services/meals.ts](services/meals.ts)
- State Management:
  - [state/user.ts](state/user.ts)
  - [state/goals.ts](state/goals.ts)
  - [state/weight-log.ts](state/weight-log.ts)
  - [state/meals.ts](state/meals.ts)
