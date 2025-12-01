import { supabase } from '@/lib/supabase';
import { ActivityLevel, updateGoals } from '@/state/goals';
import { BiologicalSex, updateUserProfile, UserProfile } from '@/state/user';

const AVATAR_BUCKET = 'avatars';

type ProfileRow = {
  user_id: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  age?: number | null;
  date_of_birth?: string | null;
  biological_sex?: BiologicalSex | null;
  current_weight?: number | null;
  goal_weight?: number | null;
  starting_weight?: number | null;
  timeline_weeks?: number | null;
  activity_level?: ActivityLevel | null;
  height_cm?: number | null;
  height_unit?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const isRemoteUrl = (url?: string | null) => {
  if (!url) return false;
  return /^https?:\/\//.test(url);
};

const uploadAvatarAndGetPublicUrl = async (userId: string, avatarUri: string) => {
  const response = await fetch(avatarUri);
  if (!response.ok) {
    throw new Error('Unable to read avatar file for upload');
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const extensionFromType = contentType.split('/').pop() || 'jpg';
  const extensionFromUri = avatarUri.split('.').pop();
  const extension = extensionFromUri && extensionFromUri.length <= 4 ? extensionFromUri : extensionFromType;

  const arrayBuffer = await response.arrayBuffer();
  const fileData = new Uint8Array(arrayBuffer); // Supabase accepts ArrayBuffer/Uint8Array

  const filePath = `${userId}/${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(filePath, fileData, { contentType, upsert: true });

  if (uploadError) throw uploadError;

  const { data: publicData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);
  return publicData.publicUrl;
};

const prepareAvatarUrlForUpsert = async (userId: string, avatarUrl?: string | null) => {
  if (avatarUrl === undefined) return undefined; // leave existing value untouched
  if (avatarUrl === null) return null; // explicit removal
  if (isRemoteUrl(avatarUrl)) return avatarUrl;

  return uploadAvatarAndGetPublicUrl(userId, avatarUrl);
};

const mapProfileRowToState = (row: ProfileRow) => {
  const profileUpdates: Partial<UserProfile> = {
    name: row.name ?? undefined,
    email: row.email ?? undefined,
    avatarUri: row.avatar_url ?? undefined,
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
    heightCm: row.height_cm ?? 175, // Default to 175cm if not set
    heightUnit: (row.height_unit as 'cm' | 'inches') ?? 'cm',
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
  avatarUrl?: string | null;
  age?: number;
  dateOfBirth?: string;
  biologicalSex?: BiologicalSex;
  currentWeight?: number;
  goalWeight?: number;
  startingWeight?: number;
  timelineWeeks?: number;
  activityLevel?: ActivityLevel;
  heightCm?: number;
  heightUnit?: 'cm' | 'inches';
}) => {
  const {
    userId,
    name,
    email,
    avatarUrl,
    age,
    dateOfBirth,
    biologicalSex,
    currentWeight,
    goalWeight,
    startingWeight,
    timelineWeeks,
    activityLevel,
    heightCm,
    heightUnit,
  } = params;

  const avatarUrlForStorage = await prepareAvatarUrlForUpsert(userId, avatarUrl);

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
    height_cm: heightCm ?? 175, // Default to 175cm
    height_unit: heightUnit ?? 'cm',
  };

  if (avatarUrlForStorage !== undefined) {
    payload.avatar_url = avatarUrlForStorage;
  }

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
