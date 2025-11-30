import { supabase } from '@/lib/supabase';
import { ActivityLevel, updateGoals } from '@/state/goals';
import { BiologicalSex, updateUserProfile, UserProfile } from '@/state/user';

type ProfileRow = {
  user_id: string;
  name?: string | null;
  email?: string | null;
  age?: number | null;
  date_of_birth?: string | null;
  biological_sex?: BiologicalSex | null;
  current_weight?: number | null;
  goal_weight?: number | null;
  starting_weight?: number | null;
  timeline_weeks?: number | null;
  activity_level?: ActivityLevel | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const mapProfileRowToState = (row: ProfileRow) => {
  const profileUpdates: Partial<UserProfile> = {
    name: row.name ?? undefined,
    email: row.email ?? undefined,
    age: row.age ?? undefined,
    currentWeight: row.current_weight ?? undefined,
    goalWeight: row.goal_weight ?? undefined,
    dateOfBirth: row.date_of_birth ?? undefined,
    biologicalSex: row.biological_sex ?? undefined,
  };

  const goalsUpdates = {
    startingWeight: row.starting_weight ?? undefined,
    currentWeight: row.current_weight ?? undefined,
    goalWeight: row.goal_weight ?? undefined,
    timelineWeeks: row.timeline_weeks ?? undefined,
    activityLevel: row.activity_level ?? undefined,
    age: row.age ?? undefined,
    biologicalSex: row.biological_sex ?? undefined,
  };

  return { profileUpdates, goalsUpdates };
};

export const fetchProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return;
  const { profileUpdates, goalsUpdates } = mapProfileRowToState(data as ProfileRow);
  updateUserProfile(profileUpdates);
  updateGoals(goalsUpdates);
};

export const upsertProfile = async (params: {
  userId: string;
  name?: string;
  email?: string;
  age?: number;
  dateOfBirth?: string;
  biologicalSex?: BiologicalSex;
  currentWeight?: number;
  goalWeight?: number;
  startingWeight?: number;
  timelineWeeks?: number;
  activityLevel?: ActivityLevel;
}) => {
  const {
    userId,
    name,
    email,
    age,
    dateOfBirth,
    biologicalSex,
    currentWeight,
    goalWeight,
    startingWeight,
    timelineWeeks,
    activityLevel,
  } = params;

  const payload: ProfileRow = {
    user_id: userId,
    name: name ?? null,
    email: email ?? null,
    age: age ?? null,
    date_of_birth: dateOfBirth ?? null,
    biological_sex: biologicalSex ?? null,
    current_weight: currentWeight ?? null,
    goal_weight: goalWeight ?? null,
    starting_weight: startingWeight ?? null,
    timeline_weeks: timelineWeeks ?? null,
    activity_level: activityLevel ?? null,
  };

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload)
    .select()
    .single();

  if (error) throw error;

  const { profileUpdates, goalsUpdates } = mapProfileRowToState(data as ProfileRow);
  updateUserProfile(profileUpdates);
  updateGoals(goalsUpdates);
};
