# Testing Your Supabase Backend

Follow these steps to verify everything is working correctly.

## ✅ Pre-Test Checklist

- [ ] Tables created in Supabase (meals, food_items)
- [ ] Expo dev server running (`npm start`)
- [ ] You have a test account (or create one)

## 🧪 Test 1: Authentication Flow

### Steps:
1. **Start your app** (iOS/Android/Web)
2. **Sign up** with a new account or **log in** with existing account
3. **Check the console** for any errors

### What to Look For:
- App should show a loading screen briefly
- Should navigate to the home screen after login
- Check browser/terminal console for:
  ```
  ✅ No errors related to Supabase
  ✅ No "Failed to load user data" warnings
  ```

### Verify in Supabase:
1. Go to [Authentication > Users](https://supabase.com/dashboard/project/cjzsechbbzejfrscjtfy/auth/users)
2. Your new user should appear in the list
3. Go to [Table Editor > profiles](https://supabase.com/dashboard/project/cjzsechbbzejfrscjtfy/editor)
4. A profile row should exist for your user

---

## 🧪 Test 2: Weight Entries

Since your weight entry functions now require `userId`, you'll need to update any UI components that use them. Here's how to test manually:

### Option A: Use Browser Console (Web Only)

1. Run your app in web browser (`w` in Expo CLI)
2. Log in to your account
3. Open browser DevTools (F12)
4. In the Console tab, run:

```javascript
// Get the current user ID (you'll see it in the console)
// Then test adding a weight entry:
const testWeight = async () => {
  const { useSupabaseAuth } = require('./hooks/useSupabaseAuth');
  const { addWeightEntry } = require('./state/weight-log');

  // You'll need to get the user.id from your app state
  // For now, replace 'USER_ID_HERE' with your actual user ID
  await addWeightEntry('USER_ID_HERE', 175.5, '2025-11-29', 'Test entry');
  console.log('Weight entry added!');
};

testWeight();
```

### Option B: Check Existing Data

1. Go to [Table Editor > weight_entries](https://supabase.com/dashboard/project/cjzsechbbzejfrscjtfy/editor)
2. Your existing weight entry should be there
3. Click on a row to see the data

### Verify:
- [ ] Entry appears in Supabase table
- [ ] `user_id` matches your authenticated user
- [ ] Data is correct (weight, date, note)

---

## 🧪 Test 3: Meals (Most Important - New Tables)

### Quick Test Using Sample Data

Add this temporary test button to one of your screens (e.g., `app/(tabs)/index.tsx`):

```typescript
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { addMeal } from '@/state/meals';
import { Pressable, Text, Alert } from 'react-native';

// Add this button somewhere in your component:
const { user } = useSupabaseAuth();

<Pressable
  onPress={async () => {
    if (!user) {
      Alert.alert('Not logged in');
      return;
    }

    try {
      await addMeal(user.id, {
        dayId: new Date().toISOString().split('T')[0],
        name: 'Test Meal',
        time: '12:00 PM',
        image: require('@/assets/images/icon.png'),
        foods: [
          {
            name: 'Test Food',
            quantity: '100g',
            calories: 200,
            protein: 20,
            carbs: 10,
            fat: 5,
          },
        ],
      });
      Alert.alert('Success!', 'Meal added to Supabase');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  }}
  style={{ padding: 20, backgroundColor: 'blue' }}
>
  <Text style={{ color: 'white' }}>Test Add Meal</Text>
</Pressable>
```

### Verify in Supabase:

1. Press the test button in your app
2. Go to [Table Editor > meals](https://supabase.com/dashboard/project/cjzsechbbzejfrscjtfy/editor)
3. You should see a new meal row with:
   - Your user_id
   - day_id (today's date)
   - name: "Test Meal"
   - time: "12:00 PM"

4. Go to [Table Editor > food_items](https://supabase.com/dashboard/project/cjzsechbbzejfrscjtfy/editor)
5. You should see a new food item row with:
   - meal_id (linked to your test meal)
   - name: "Test Food"
   - All nutritional data

### What This Tests:
- ✅ Meals service can insert data
- ✅ Food items are created automatically
- ✅ Foreign key relationships work
- ✅ RLS policies allow you to write your own data
- ✅ Data persists and can be loaded

---

## 🧪 Test 4: Data Persistence

### Steps:
1. **Add some data** (weight entry or meal)
2. **Log out** of your account
3. **Close the app** completely
4. **Open the app again**
5. **Log back in**

### Verify:
- [ ] All your data is still there
- [ ] Weight entries show up
- [ ] Meals show up
- [ ] No errors in console

---

## 🧪 Test 5: RLS (Row Level Security)

This ensures users can only see their own data.

### Steps:
1. **Create 2 test accounts**:
   - Account A: `test1@example.com`
   - Account B: `test2@example.com`

2. **Log in as Account A**:
   - Add a weight entry
   - Add a meal

3. **Log out and log in as Account B**:
   - Add different data

4. **Verify in Supabase**:
   - Go to Table Editor
   - Both users' data should be in the same tables
   - But when logged in as Account A, you only see Account A's data in the app

### What This Tests:
- ✅ RLS policies are working
- ✅ Users can't see each other's data
- ✅ Data is properly isolated

---

## 🐛 Common Issues & Solutions

### ❌ "Failed to load user data"
**Solution**: Check console for specific error. Usually means:
- Tables don't exist → Run the SQL schema
- RLS policies missing → Re-run the RLS policy section
- Network issue → Check internet connection

### ❌ "permission denied for table meals"
**Solution**: RLS policies not set correctly
1. Go to SQL Editor
2. Re-run the RLS policy section of the schema
3. Verify policies exist in Authentication > Policies

### ❌ "relation 'meals' does not exist"
**Solution**: Table wasn't created
1. Go to SQL Editor
2. Run the `CREATE TABLE` statements again
3. Check Table Editor to verify

### ❌ TypeScript errors about userId parameter
**Solution**: Function signatures changed
- Old: `addWeightEntry(weight, date)`
- New: `addWeightEntry(userId, weight, date)`
- Update your UI components to pass `user.id` first

---

## ✅ Success Checklist

Once everything is working, you should have:

- [x] 4 tables in Supabase (profiles, weight_entries, meals, food_items)
- [x] Can log in/out successfully
- [x] Profile data loads on login
- [x] Weight entries persist
- [x] Meals and food items can be created
- [x] Data loads after app restart
- [x] Different users see different data
- [x] No console errors

---

## 🎯 Next Steps

After testing:

1. **Remove test code** (any test buttons you added)
2. **Update UI components** to use new async function signatures
3. **Add error handling** in your UI for failed requests
4. **Add loading states** while data is being fetched/saved

## Need Help?

Check the logs:
- **Browser**: F12 → Console tab
- **Terminal**: Watch the Expo dev server output
- **Supabase**: Dashboard → Logs → Error logs
