import { fetchAccessStatus } from '@/services/access';
import { AccessStatus } from '@/types/access';

type Listener = (status: AccessStatus | null) => void;

let accessStatus: AccessStatus | null = null;
const listeners: Set<Listener> = new Set();

const notify = () => {
  listeners.forEach((listener) => listener(accessStatus));
};

export const subscribeAccessStatus = (listener: Listener) => {
  listeners.add(listener);
  listener(accessStatus);
  return () => listeners.delete(listener);
};

export const getAccessStatusState = () => accessStatus;

export const setAccessStatusState = (status: AccessStatus | null) => {
  accessStatus = status;
  notify();
};

export const refreshAccessStatusState = async (intent: 'status' | 'start_trial' = 'status') => {
  try {
    const latest = await fetchAccessStatus(intent);
    setAccessStatusState(latest);
    return latest;
  } catch (error) {
    console.warn('Failed to refresh access status', error);
    return accessStatus;
  }
};

export const clearAccessStatusState = () => {
  accessStatus = null;
  notify();
};

export const hasScanQuota = (status: AccessStatus | null) => {
  if (!status) return false;
  if (status.state === 'UNAUTHENTICATED') return false;
  return status.remainingToday > 0;
};
