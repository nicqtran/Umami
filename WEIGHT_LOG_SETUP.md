# Weight Log Feature Setup Guide

This guide will help you set up the weight logging feature in your Umami app with Supabase.

## Overview

The weight logging feature allows users to:
- Log their weight with a specific date
- View weight history on a graph
- Track weight changes over time
- Edit or delete past weight entries
- Automatically sync their current weight to their profile

## Database Setup

### Step 1: Create the `weight_entries` table

You need to run the SQL migration to create the `weight_entries` table in your Supabase database.

**Option A: Using the separate migration file**

1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `weight-entries-schema.sql`
4. Click "Run" to execute

**Option B: Using the complete schema**

The `weight_entries` table definition has already been added to `supabase-schema.sql`. If you're setting up a new database, just run the entire `supabase-schema.sql` file.

### Step 2: Verify the table was created

Run this query in the Supabase SQL Editor:

```sql
SELECT * FROM weight_entries LIMIT 1;
```

You should see the table structure (even if there are no rows yet).

### Step 3: Verify RLS (Row Level Security) policies

Run this query to check that RLS is enabled and policies are set:

```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename = 'weight_entries';
```

You should see 4 policies:
- Users can view their own weight entries
- Users can insert their own weight entries
- Users can update their own weight entries
- Users can delete their own weight entries

## How It Works

### When a user logs weight in the app:

1. **User enters weight** in the "Log Weight" modal (from the Log tab)
2. **Saves to Supabase**:
   - Creates a new row in `weight_entries` table with:
     - `user_id`: The authenticated user's ID
     - `weight`: The weight value in lbs
     - `date`: The selected date (defaults to today)
     - `note`: Optional note (currently null)
     - `created_at`, `updated_at`: Auto-generated timestamps

3. **Reloads from database**:
   - Fetches all weight entries for the user from Supabase
   - Updates local state with the fresh data

4. **Syncs to profile**:
   - Finds the most recent weight entry by date
   - Updates the `current_weight` column in the `profiles` table
   - This keeps the profile in sync with the latest weight

### When a user updates their weight from the profile screen:

1. **User edits current weight** in the profile screen
2. **Creates weight log entry**:
   - Automatically creates a new entry in `weight_entries` with today's date
   - This ensures the weight is logged in history

3. **Updates profile**:
   - Saves the new `current_weight` to the `profiles` table

### Data persistence:

- All weight data is stored in Supabase
- On app load, weight entries are fetched from the database
- The Log tab displays the real data from Supabase
- After logout/login or app refresh, the data persists

## Testing the Feature

### Test 1: Log a new weight entry

1. Open the app and go to the **Log** tab
2. Tap **"+ Log Weight"** button
3. Enter a weight value (e.g., 175.0)
4. Select today's date (or any date)
5. Tap **Save**
6. **Expected result**:
   - The modal closes
   - The graph updates with the new entry
   - The "Current" stat shows the new weight
   - The "Entries" count increases by 1

### Test 2: Verify data persistence

1. After adding a weight entry, close the app completely
2. Reopen the app and go to the Log tab
3. **Expected result**:
   - The weight entry you added is still there
   - The graph shows the same data
   - The stats are unchanged

### Test 3: Update weight from profile

1. Go to the **Profile** tab (tap your avatar on Home)
2. Tap on the **Current Weight** card
3. Enter a new weight value
4. Tap outside to save (or press Done on keyboard)
5. Go back to the **Log** tab
6. **Expected result**:
   - A new weight entry appears for today
   - The graph updates to show the new entry
   - The "Current" stat reflects the new weight

### Test 4: Edit a weight entry

1. In the Log tab, tap on any point on the graph (or a date in the calendar with a log)
2. The edit modal opens with the existing weight
3. Change the weight value
4. Tap **Save**
5. **Expected result**:
   - The entry is updated in the graph
   - If it was the most recent entry, the "Current" stat updates
   - The change is persisted to Supabase

### Test 5: Delete a weight entry

1. In the Log tab, tap on any point on the graph
2. In the edit modal, tap the **trash icon**
3. **Expected result**:
   - The entry is removed from the graph
   - If it was the most recent entry, the "Current" stat updates to the next most recent entry
   - The deletion is persisted to Supabase

## Troubleshooting

### Issue: "Failed to save weight entry" error

**Possible causes:**
- The `weight_entries` table doesn't exist
- RLS policies are not set correctly
- User is not authenticated

**Solution:**
1. Check Supabase logs for the specific error
2. Verify the table exists: `SELECT * FROM weight_entries;`
3. Check RLS policies are active
4. Ensure the user is logged in

### Issue: Weight entries disappear after refresh

**Possible causes:**
- Data is not being saved to Supabase
- `loadWeightEntriesFromDb` is not being called on app load

**Solution:**
1. Check the app's `_layout.tsx` to ensure `loadWeightEntriesFromDb` is called when user logs in
2. Check browser/app console for errors during data fetch
3. Verify data exists in Supabase:
   ```sql
   SELECT * FROM weight_entries WHERE user_id = 'YOUR_USER_ID';
   ```

### Issue: Current weight in profile doesn't match latest entry

**Possible causes:**
- Profile sync failed
- Multiple weight entries on the same date

**Solution:**
1. Check the `profiles` table `current_weight` column
2. Check the most recent entry in `weight_entries` by date
3. Manually sync by editing the current weight in the profile or logging a new entry

## Database Schema Reference

### `weight_entries` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key (auto-generated) |
| `user_id` | uuid | Foreign key to auth.users (user who owns this entry) |
| `weight` | numeric | Weight value in lbs |
| `date` | date | Date of the weight entry (YYYY-MM-DD) |
| `note` | text | Optional note about the entry |
| `created_at` | timestamptz | When the entry was created |
| `updated_at` | timestamptz | When the entry was last updated |

### Indexes

- `weight_entries_user_id_idx` - Index on user_id for fast lookups
- `weight_entries_date_idx` - Index on date for chronological queries
- `weight_entries_user_date_idx` - Composite index for user+date queries

### RLS Policies

All policies ensure users can only access their own weight entries using `auth.uid() = user_id`.

## Code References

- Weight entry service: [services/weight-log.ts](services/weight-log.ts)
- Weight entry state: [state/weight-log.ts](state/weight-log.ts)
- Log screen (UI): [app/(tabs)/explore.tsx](app/(tabs)/explore.tsx)
- Profile screen: [app/profile.tsx](app/profile.tsx)
- App layout (data loading): [app/_layout.tsx](app/_layout.tsx)

## Next Steps

After setting up the database:

1. ✅ Run the SQL migration in Supabase
2. ✅ Verify the table and policies are created
3. ✅ Test adding a weight entry in the app
4. ✅ Test data persistence after app reload
5. ✅ Test editing and deleting entries
6. ✅ Test weight updates from the profile screen

That's it! Your weight logging feature should now be fully functional and persistent.
