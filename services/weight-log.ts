import { supabase } from '@/lib/supabase';
import { WeightEntry } from '@/state/weight-log';

type SupabaseWeightRow = {
  id: string;
  user_id: string;
  weight: number;
  date: string;
  note?: string | null;
  created_at?: string;
  updated_at?: string;
};

const toWeightEntry = (row: SupabaseWeightRow): WeightEntry => ({
  id: row.id,
  date: row.date,
  weight: Number(row.weight),
  note: row.note ?? undefined,
  timestamp: row.updated_at ? Date.parse(row.updated_at) : Date.parse(row.created_at ?? row.date),
});

export const fetchWeightEntriesForUser = async (userId: string): Promise<WeightEntry[]> => {
  const { data, error } = await supabase
    .from('weight_entries')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true })
    .order('updated_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(toWeightEntry);
};

export const insertWeightEntry = async (params: {
  userId: string;
  weight: number;
  date: string;
  note?: string;
}): Promise<WeightEntry> => {
  const { userId, weight, date, note } = params;

  console.log('📝 Inserting weight entry to Supabase:', { userId, weight, date, note });

  const { data, error } = await supabase
    .from('weight_entries')
    .insert([{ user_id: userId, weight, date, note }])
    .select()
    .single();

  if (error) {
    console.error('❌ Supabase insert error:', error);
    throw error;
  }

  console.log('✅ Weight entry inserted:', data);
  return toWeightEntry(data as SupabaseWeightRow);
};

export const updateWeightEntryById = async (params: {
  id: string;
  userId: string;
  updates: Partial<Pick<WeightEntry, 'date' | 'weight' | 'note'>>;
}): Promise<WeightEntry> => {
  const { id, userId, updates } = params;

  const payload: Record<string, unknown> = {};
  if (updates.date) payload.date = updates.date;
  if (typeof updates.weight === 'number') payload.weight = updates.weight;
  if (updates.note !== undefined) payload.note = updates.note;

  const { data, error } = await supabase
    .from('weight_entries')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return toWeightEntry(data as SupabaseWeightRow);
};

export const deleteWeightEntryById = async (params: { id: string; userId: string }): Promise<void> => {
  const { id, userId } = params;
  const { error } = await supabase.from('weight_entries').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
};
