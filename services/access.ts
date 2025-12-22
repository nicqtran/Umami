import { supabase } from '@/lib/supabase';
import { AccessStatus } from '@/types/access';

const unauthenticatedStatus: AccessStatus = {
  state: 'UNAUTHENTICATED',
  dailyLimit: 0,
  usedToday: 0,
  remainingToday: 0,
  canStartTrial: false,
  trialUsed: false,
};

const normalizeStatus = (raw: any): AccessStatus => ({
  state: raw?.state ?? 'FREE_USER',
  reason: raw?.reason ?? null,
  dailyLimit: Number(raw?.dailyLimit ?? 0),
  usedToday: Number(raw?.usedToday ?? 0),
  remainingToday: Number(raw?.remainingToday ?? 0),
  trialEndsAt: raw?.trialEndsAt ?? null,
  trialDaysLeft: raw?.trialDaysLeft ?? null,
  proRenewsAt: raw?.proRenewsAt ?? null,
  canStartTrial: Boolean(raw?.canStartTrial),
  timezone: raw?.timezone ?? null,
  trialUsed: Boolean(raw?.trialUsed),
  proStatus: raw?.proStatus ?? null,
});

export const getLocalTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export async function fetchAccessStatus(intent: 'status' | 'start_trial' = 'status'): Promise<AccessStatus> {
  const timezone = getLocalTimezone();

  const { data, error } = await supabase.functions.invoke('access-status', {
    body: { intent, timezone },
  });

  if (error) {
    const status = (error as any)?.context?.status ?? (error as any)?.status;
    if (status === 401) {
      return unauthenticatedStatus;
    }
    throw new Error(data?.error || error.message || 'Failed to fetch access status');
  }

  if (!data?.status) {
    return unauthenticatedStatus;
  }

  return normalizeStatus(data.status);
}
