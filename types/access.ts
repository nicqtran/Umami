export type AccessState =
  | 'UNAUTHENTICATED'
  | 'FREE_USER'
  | 'FREE_LIMIT'
  | 'TRIAL_USER'
  | 'TRIAL_USER_LIMIT'
  | 'TRIAL_EXPIRED'
  | 'PRO_USER'
  | 'PRO_USER_LIMIT'
  | 'PRO_EXPIRED';

export type AccessStatus = {
  state: AccessState;
  reason?: string | null;
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  trialEndsAt?: string | null;
  trialDaysLeft?: number | null;
  proRenewsAt?: string | null;
  canStartTrial: boolean;
  timezone?: string | null;
  trialUsed?: boolean;
  proStatus?: string | null;
};
