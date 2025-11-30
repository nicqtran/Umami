// Weight Log State - Stores actual weight entries with timestamps

import {
  fetchWeightEntriesForUser,
  insertWeightEntry as insertWeightEntryDb,
  updateWeightEntryById,
  deleteWeightEntryById,
} from '@/services/weight-log';

export type WeightEntry = {
  id: string;
  date: string; // ISO date string (YYYY-MM-DD)
  weight: number; // in lbs
  timestamp: number; // Unix timestamp for when entry was created/updated
  note?: string; // Optional note for the entry
};

type Listener = (entries: WeightEntry[]) => void;

let weightEntries: WeightEntry[] = [];

const listeners: Set<Listener> = new Set();

const notify = () => {
  listeners.forEach((listener) => listener([...weightEntries]));
};


export const loadWeightEntriesFromDb = async (userId: string): Promise<void> => {
  try {
    const entries = await fetchWeightEntriesForUser(userId);
    weightEntries = entries;
    notify();
  } catch (error) {
    console.error('Failed to load weight entries:', error);
    throw error;
  }
};

// Get all weight entries sorted by date (newest first)
export const getWeightEntries = (): WeightEntry[] => {
  return [...weightEntries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

// Get weight entries sorted by date (oldest first) - useful for charts
export const getWeightEntriesChronological = (): WeightEntry[] => {
  return [...weightEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

// Get entry for a specific date
export const getWeightForDate = (date: string): WeightEntry | undefined => {
  return weightEntries.find((entry) => entry.date === date);
};

// Get the most recent weight entry
export const getLatestWeight = (): WeightEntry | undefined => {
  if (weightEntries.length === 0) return undefined;
  return getWeightEntries()[0];
};

// Get entries within a date range
export const getWeightEntriesInRange = (startDate: Date, endDate: Date): WeightEntry[] => {
  const start = startDate.toISOString().split('T')[0];
  const end = endDate.toISOString().split('T')[0];
  
  return weightEntries
    .filter((entry) => entry.date >= start && entry.date <= end)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

// Add a new weight entry (with Supabase sync)
export const addWeightEntry = async (
  userId: string,
  weight: number,
  date?: string,
  note?: string
): Promise<WeightEntry> => {
  const entryDate = date || new Date().toISOString().split('T')[0];

  try {
    const newEntry = await insertWeightEntryDb({
      userId,
      weight,
      date: entryDate,
      note,
    });

    const existingIndex = weightEntries.findIndex((e) => e.date === entryDate);
    if (existingIndex !== -1) {
      weightEntries[existingIndex] = newEntry;
    } else {
      weightEntries.push(newEntry);
    }

    notify();
    return newEntry;
  } catch (error) {
    console.error('Failed to add weight entry:', error);
    throw error;
  }
};

// Update an existing weight entry (with Supabase sync)
export const updateWeightEntry = async (
  userId: string,
  id: string,
  updates: Partial<Omit<WeightEntry, 'id'>>
): Promise<WeightEntry | null> => {
  const index = weightEntries.findIndex((e) => e.id === id);

  if (index === -1) return null;

  try {
    const updatedEntry = await updateWeightEntryById({
      id,
      userId,
      updates,
    });

    weightEntries[index] = updatedEntry;

    notify();
    return updatedEntry;
  } catch (error) {
    console.error('Failed to update weight entry:', error);
    throw error;
  }
};

// Delete a weight entry (with Supabase sync)
export const deleteWeightEntry = async (userId: string, id: string): Promise<boolean> => {
  const index = weightEntries.findIndex((e) => e.id === id);

  if (index === -1) return false;

  try {
    await deleteWeightEntryById({ id, userId });
    weightEntries.splice(index, 1);
    notify();
    return true;
  } catch (error) {
    console.error('Failed to delete weight entry:', error);
    throw error;
  }
};

// Delete entry by date (with Supabase sync)
export const deleteWeightEntryByDate = async (userId: string, date: string): Promise<boolean> => {
  const entry = weightEntries.find((e) => e.date === date);
  if (!entry) return false;
  return deleteWeightEntry(userId, entry.id);
};

// Clear all entries
export const clearAllWeightEntries = (): void => {
  weightEntries = [];
  notify();
};

// Subscribe to weight log changes
export const subscribeWeightLog = (listener: Listener): (() => void) => {
  listeners.add(listener);
  listener([...weightEntries]);
  return () => {
    listeners.delete(listener);
  };
};

// Get weight statistics
export const getWeightStats = () => {
  if (weightEntries.length === 0) {
    return {
      current: null,
      highest: null,
      lowest: null,
      average: null,
      totalChange: null,
      entriesCount: 0,
    };
  }
  
  const sorted = getWeightEntriesChronological();
  const weights = sorted.map((e) => e.weight);
  
  const current = sorted[sorted.length - 1].weight;
  const highest = Math.max(...weights);
  const lowest = Math.min(...weights);
  const average = weights.reduce((a, b) => a + b, 0) / weights.length;
  const totalChange = current - sorted[0].weight;
  
  return {
    current,
    highest,
    lowest,
    average: Math.round(average * 10) / 10,
    totalChange: Math.round(totalChange * 10) / 10,
    entriesCount: weightEntries.length,
  };
};

// Initialize with some sample data (for development - remove in production)
export const initializeSampleData = async (
  userId: string,
  startingWeight: number,
  currentWeight: number,
  weeks: number = 8
) => {
  clearAllWeightEntries();

  const today = new Date();
  const dailyChange = (startingWeight - currentWeight) / (weeks * 7);

  for (let i = weeks * 7; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Calculate expected weight with some natural variance
    const daysFromStart = weeks * 7 - i;
    const expectedWeight = startingWeight - dailyChange * daysFromStart;
    const noise = (Math.random() - 0.5) * 1.2; // Natural daily fluctuation
    const weight = Math.round((expectedWeight + noise) * 10) / 10;

    // Only add entries every few days to simulate realistic logging
    if (i === 0 || i === weeks * 7 || Math.random() > 0.6) {
      await addWeightEntry(userId, weight, date.toISOString().split('T')[0]);
    }
  }

  // Ensure current weight matches
  const todayStr = today.toISOString().split('T')[0];
  await addWeightEntry(userId, currentWeight, todayStr);
};
