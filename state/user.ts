export type BiologicalSex = 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';

export type UserProfile = {
  name: string;
  email?: string;
  age?: number;
  height?: number; // in inches
  currentWeight?: number; // in lbs
  goalWeight?: number; // in lbs
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very-active';
  goalType?: 'lose' | 'maintain' | 'gain';
  avatarUri?: string; // Local URI of the user's profile photo
  dateOfBirth?: string; // ISO date string (YYYY-MM-DD)
  biologicalSex?: BiologicalSex;
};

type Listener = (profile: UserProfile) => void;

let userProfile: UserProfile = {
  name: 'Nicolas',
  email: undefined,
  age: undefined,
  height: undefined,
  currentWeight: undefined,
  goalWeight: undefined,
  activityLevel: undefined,
  goalType: undefined,
  avatarUri: undefined,
  dateOfBirth: undefined,
  biologicalSex: undefined,
};

const listeners: Set<Listener> = new Set();

export function getUserProfile(): UserProfile {
  return userProfile;
}

export function updateUserProfile(updates: Partial<UserProfile>): void {
  userProfile = { ...userProfile, ...updates };
  listeners.forEach((listener) => listener(userProfile));
}

export function subscribeUserProfile(listener: Listener): () => void {
  listeners.add(listener);
  listener(userProfile);
  return () => {
    listeners.delete(listener);
  };
}
