import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { upsertProfile } from '@/services/profile';
import { getGoals, GoalsState, subscribeGoals, updateGoals } from '@/state/goals';
import { MealEntry, subscribeMeals } from '@/state/meals';
import { getUserProfile, subscribeUserProfile, UserProfile } from '@/state/user';
import {
  addWeightEntry,
  deleteWeightEntry,
  loadWeightEntriesFromDb,
  subscribeWeightLog,
  updateWeightEntry,
  WeightEntry
} from '@/state/weight-log';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Keyboard,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

// Design tokens
const COLORS = {
  background: '#F8F9FB',
  card: '#FFFFFF',
  text: '#111418',
  textMuted: '#6A7178',
  accent: '#2C3E50',
  accentLight: 'rgba(44, 62, 80, 0.1)',
  border: '#E6E8EB',
  graphGradientStart: 'rgba(44, 62, 80, 0.08)',
  graphGradientEnd: 'rgba(44, 62, 80, 0.01)',
  todayBadge: '#2C3E50',
  logIndicator: '#6AB7A8',
};

const TYPOGRAPHY = {
  hero: { fontSize: 34, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '500' as const },
  tiny: { fontSize: 11, fontWeight: '400' as const },
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

type TimeRange = '5D' | '2W' | '1M' | '1Y' | 'YTD' | 'ALL';

// Format a Date as YYYY-MM-DD in local time to avoid timezone drift
const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get weight data from actual weight log entries
const getWeightDataForRange = (days: number, weightEntries: WeightEntry[], isAllTime: boolean = false): { date: Date; weight: number }[] => {
  // Get today's date at midnight (00:00:00) for accurate comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const millisecondsPerDay = 1000 * 60 * 60 * 24;

  // For "ALL" range, use the first entry date as start instead of calculating back 100 years
  let startDate: Date;
  if (isAllTime && weightEntries.length > 0) {
    // Sort entries to find the earliest one - use T00:00:00 to parse as local time
    const sorted = [...weightEntries].sort((a, b) => new Date(a.date + 'T00:00:00').getTime() - new Date(b.date + 'T00:00:00').getTime());
    startDate = new Date(sorted[0].date + 'T00:00:00');
  } else {
    // Calculate start date: for "5D", we want entries from 5 days ago to today (inclusive)
    // So if today is Nov 30, "5D" should show Nov 26-30 (5 days)
    // Use milliseconds calculation to properly handle large day ranges
    startDate = new Date(today.getTime() - ((days - 1) * millisecondsPerDay));
    startDate.setHours(0, 0, 0, 0); // Ensure midnight
  }

  console.log('📅 Filtering weight data for range:', {
    days: isAllTime ? 'ALL' : days,
    totalEntries: weightEntries.length,
    startDate: formatDateLocal(startDate),
    endDate: formatDateLocal(today)
  });

  // Filter entries within the range (inclusive of both start and end dates)
  const entriesInRange = weightEntries.filter((entry) => {
    // Parse entry date at midnight for consistent comparison
    const entryDate = new Date(entry.date + 'T00:00:00');
    return entryDate >= startDate && entryDate <= today;
  });

  console.log('✅ Actual entries in range:', entriesInRange.length);

  // Sort by date (oldest first) - use T00:00:00 to parse as local time
  entriesInRange.sort((a, b) => new Date(a.date + 'T00:00:00').getTime() - new Date(b.date + 'T00:00:00').getTime());

  // Fill in all days for every range so indicators line up with each calendar day
  console.log('📊 Filling all days between entries for selected range');

  // Create a map of date -> weight for quick lookup
  const weightByDate = new Map<string, number>();
  entriesInRange.forEach((entry) => {
    weightByDate.set(entry.date, entry.weight);
  });

  // Fill in all dates in the range
  const chartData: { date: Date; weight: number }[] = [];
  let lastKnownWeight: number | null = null;
  let hasStarted = false; // Track if we've encountered the first logged entry

  // Calculate actual number of days to iterate (start → today, inclusive)
  const actualDays = Math.floor((today.getTime() - startDate.getTime()) / millisecondsPerDay) + 1;

  // Iterate through each day in the range
  for (let i = 0; i < actualDays; i++) {
    // Create a new date by adding i days to the start date using milliseconds for accuracy
    const currentDate = new Date(startDate.getTime() + i * millisecondsPerDay);
    const dateStr = formatDateLocal(currentDate);

    // Check if we have an actual weight entry for this date
    if (weightByDate.has(dateStr)) {
      const weight = weightByDate.get(dateStr)!;
      lastKnownWeight = weight;
      hasStarted = true; // Mark that we've started tracking
      chartData.push({ date: new Date(currentDate.getTime()), weight });
    } else if (hasStarted && lastKnownWeight !== null) {
      // Only carry forward if we've already started (after first logged entry)
      chartData.push({ date: new Date(currentDate.getTime()), weight: lastKnownWeight });
    }
    // Skip days before the first logged entry
  }

  console.log(`Chart data points: ${chartData.length} (${entriesInRange.length} actual entries)`);

  return chartData;
};

const RANGE_DAYS: Record<TimeRange, number> = {
  '5D': 5,
  '2W': 14,
  '1M': 31,
  '1Y': 365,
  'YTD': Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24)) + 1,
  'ALL': 36500, // 100 years - effectively unlimited
};

export default function LogScreen() {
  const router = useRouter();
  const { user } = useSupabaseAuth();
  const insets = useSafeAreaInsets();
  const [selectedRange, setSelectedRange] = useState<TimeRange>('1M');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [userProfile, setUserProfile] = useState<UserProfile>({ name: 'there' });
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [goals, setGoals] = useState<GoalsState | null>(null);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [savingWeight, setSavingWeight] = useState(false);
  
  // Weight log modal state
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WeightEntry | null>(null);
  const [weightDraft, setWeightDraft] = useState('');
  const [dateDraft, setDateDraft] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  useEffect(() => {
    const unsubscribe = subscribeUserProfile(setUserProfile);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeMeals(setMeals);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeGoals(setGoals);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeWeightLog(setWeightEntries);
    return () => unsubscribe();
  }, []);

  // Load weight entries from Supabase when user is available
  useEffect(() => {
    if (user?.id) {
      console.log('🔄 Loading weight entries for user:', user.id);
      loadWeightEntriesFromDb(user.id)
        .then((entries) => {
          console.log('✅ Weight entries loaded from Supabase:', entries.length);
        })
        .catch((error) => {
          console.error('❌ Failed to load weight entries:', error);
        });
    }
  }, [user?.id]);

  const sortedEntries = useMemo(() => {
    // Use T00:00:00 suffix to parse dates as local time, not UTC
    const sorted = [...weightEntries].sort((a, b) => new Date(a.date + 'T00:00:00').getTime() - new Date(b.date + 'T00:00:00').getTime());
    console.log('📈 Log Screen - Total weight entries:', sorted.length);
    return sorted;
  }, [weightEntries]);

  // Get the most recent weight entry (latest date, most recent timestamp for that date)
  const latestEntryByDate = useMemo(() => {
    if (weightEntries.length === 0) return null;
    
    // Get today's date - filter out entries that are in the "future" due to timezone issues
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const todayMs = today.getTime();
    
    const validEntries = weightEntries.filter(e => {
      const entryMs = new Date(e.date + 'T00:00:00').getTime();
      return entryMs <= todayMs;
    });
    
    if (validEntries.length === 0) return null;
    
    // Group by date
    const entriesByDate = new Map<string, WeightEntry[]>();
    validEntries.forEach(entry => {
      const existing = entriesByDate.get(entry.date) || [];
      existing.push(entry);
      entriesByDate.set(entry.date, existing);
    });
    
    // Find the latest date
    const sortedDates = Array.from(entriesByDate.keys()).sort((a, b) => 
      new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()
    );
    const latestDate = sortedDates[0];
    
    // Get the most recent entry for the latest date (by timestamp)
    const latestDateEntries = entriesByDate.get(latestDate) || [];
    const sorted = latestDateEntries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    return sorted[0] || null;
  }, [weightEntries]);

  // Get valid entries only (filter out future dates)
  const validSortedEntries = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const todayMs = today.getTime();
    
    return sortedEntries.filter(e => {
      const entryMs = new Date(e.date + 'T00:00:00').getTime();
      return entryMs <= todayMs;
    });
  }, [sortedEntries]);

  const latestEntry = validSortedEntries[validSortedEntries.length - 1];

  // Sync latest weight with goals
  useEffect(() => {
    if (latestEntry && goals && latestEntry.weight !== goals.currentWeight) {
      updateGoals({ currentWeight: latestEntry.weight });
    }
  }, [latestEntry, goals]);

  const weightData = useMemo(
    () => getWeightDataForRange(RANGE_DAYS[selectedRange], validSortedEntries, selectedRange === 'ALL'),
    [selectedRange, validSortedEntries]
  );

  const weightStats = useMemo(() => {
    if (validSortedEntries.length === 0) {
      return {
        current: null,
        highest: null,
        lowest: null,
        average: null,
        totalChange: null,
        entriesCount: 0,
      };
    }

    const weights = validSortedEntries.map((e) => e.weight);
    const current = latestEntryByDate?.weight ?? weights[weights.length - 1];
    const highest = Math.max(...weights);
    const lowest = Math.min(...weights);
    const average = weights.reduce((a, b) => a + b, 0) / weights.length;
    const startingWeightForChange = goals?.startingWeight ?? weights[0];
    const totalChange = current - startingWeightForChange;

    return {
      current,
      highest,
      lowest,
      average: Math.round(average * 10) / 10,
      totalChange: Math.round(totalChange * 10) / 10,
      entriesCount: validSortedEntries.length,
    };
  }, [validSortedEntries, goals?.startingWeight, latestEntryByDate]);

  // Weight entry handlers
  const openAddWeight = () => {
    const today = new Date();
    const todayLocal = formatDateLocal(today);
    console.log('📅 Opening add weight modal:', {
      rawDate: today.toString(),
      localDate: todayLocal,
      utcDate: today.toISOString(),
    });
    setEditingEntry(null);
    setWeightDraft(goals?.currentWeight?.toString() ?? '175');
    setDateDraft(todayLocal);
    setCalendarMonth(today);
    setShowWeightModal(true);
  };

  const openEditWeight = (entry: WeightEntry) => {
    setEditingEntry(entry);
    setWeightDraft(entry.weight.toString());
    setDateDraft(entry.date);
    // Add T00:00:00 to parse as local time, not UTC
    setCalendarMonth(new Date(entry.date + 'T00:00:00'));
    setShowWeightModal(true);
  };

  const syncCurrentWeightToProfile = async (weight: number) => {
    if (!user?.id) return;
    console.log('🔄 Syncing weight to profile:', weight);
    
    // Update local goals state immediately
    updateGoals({ currentWeight: weight });
    
    // Get latest state for sync
    const latestGoals = getGoals();
    const latestProfile = getUserProfile();
    
    // Sync to Supabase profiles table
    await upsertProfile({
      userId: user.id,
      name: latestProfile.name,
      email: latestProfile.email,
      avatarUrl: latestProfile.avatarUri,
      age: latestGoals.age,
      dateOfBirth: latestProfile.dateOfBirth,
      biologicalSex: latestGoals.biologicalSex,
      currentWeight: weight,
      goalWeight: latestGoals.goalWeight,
      startingWeight: latestGoals.startingWeight,
      timelineWeeks: latestGoals.timelineWeeks,
      activityLevel: latestGoals.activityLevel,
      heightCm: latestGoals.heightCm,
      heightUnit: latestGoals.heightUnit,
    });
    
    console.log('✅ Profile synced with current weight:', weight);
  };

  const saveWeight = async () => {
    if (!user?.id || savingWeight) {
      console.log('Save blocked:', { hasUser: !!user?.id, savingWeight });
      return;
    }

    const weight = parseFloat(weightDraft);
    console.log('Attempting to save weight:', { weight, weightDraft, dateToUse: dateDraft });

    if (!Number.isFinite(weight) || weight <= 0) {
      console.error('Invalid weight value:', weight);
      return;
    }

    const dateToUse = dateDraft || formatDateLocal(new Date());

    try {
      setSavingWeight(true);
      console.log('Starting save process...', { userId: user.id, weight, date: dateToUse, isEdit: !!editingEntry });

      // Save to Supabase weight_entries table
      let savedEntry: WeightEntry;
      if (editingEntry) {
        console.log('Updating existing entry:', editingEntry.id);
        const updated = await updateWeightEntry(user.id, editingEntry.id, { weight, date: dateToUse });
        if (!updated) {
          throw new Error('Failed to update weight entry - entry not found');
        }
        savedEntry = updated;
      } else {
        console.log('Adding new entry...');
        savedEntry = await addWeightEntry(user.id, weight, dateToUse);
        console.log('Entry added successfully:', savedEntry);
      }

      // Reload all weight entries from Supabase to ensure we have the latest data
      console.log('Reloading weight entries from database...');
      const refreshed = await loadWeightEntriesFromDb(user.id);
      console.log('Loaded entries:', refreshed.length);

      // Get today's date in local time for comparison
      const todayLocal = formatDateLocal(new Date());
      
      // Find the most recent weight entry by date AND timestamp (not just date)
      // Sort by date DESC, then by timestamp DESC to get the truly latest entry
      // Use T00:00:00 suffix to parse dates as local time, not UTC
      const sortedByDate = [...refreshed].sort((a, b) => {
        const dateCompare = new Date(b.date + 'T00:00:00').getTime() - new Date(a.date + 'T00:00:00').getTime();
        if (dateCompare !== 0) return dateCompare;
        // If same date, use timestamp to get the most recently created/updated
        return (b.timestamp || 0) - (a.timestamp || 0);
      });
      
      const latest = sortedByDate[0];

      console.log('📊 Today (local):', todayLocal);
      console.log('📊 All entries dates:', refreshed.map(e => e.date));
      console.log('📊 Latest entry after sort:', latest?.date, latest?.weight);
      console.log('📊 Entry we just saved:', savedEntry.date, savedEntry.weight);

      // Determine which weight to use for profile:
      // 1. If we saved for today, use today's weight
      // 2. Otherwise, find the entry for today or the most recent entry that's not in the future
      let entryToUse = savedEntry;
      
      if (savedEntry.date !== todayLocal) {
        // We saved for a different day, check if there's an entry for today
        const todayEntry = refreshed.find(e => e.date === todayLocal);
        if (todayEntry) {
          entryToUse = todayEntry;
        } else {
          // Use the most recent entry that is today or earlier (skip future dates from timezone bugs)
          const todayMs = new Date(todayLocal + 'T00:00:00').getTime();
          const validEntries = sortedByDate.filter(e => new Date(e.date + 'T00:00:00').getTime() <= todayMs);
          entryToUse = validEntries[0] || savedEntry;
        }
      }
      
      console.log('🔄 Using entry for profile sync:', entryToUse.date, entryToUse.weight);
      await syncCurrentWeightToProfile(entryToUse.weight);
      console.log('✅ Profile synced successfully');

      setShowWeightModal(false);
      console.log('Save complete!');
    } catch (err: any) {
      console.error('❌ Failed to save weight entry:', err);
      console.error('Error details:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
      });
      alert(`Failed to save weight: ${err?.message || 'Unknown error'}`);
    } finally {
      setSavingWeight(false);
    }
  };

  const handleDeleteWeight = async () => {
    if (!user?.id || !editingEntry) return;

    try {
      setSavingWeight(true);

      // Delete from Supabase weight_entries table
      await deleteWeightEntry(user.id, editingEntry.id);

      // Reload all weight entries from Supabase
      const refreshed = await loadWeightEntriesFromDb(user.id);

      // Find the most recent weight entry by date
      // Use T00:00:00 suffix to parse dates as local time, not UTC
      const refreshedLatest = refreshed.sort(
        (a, b) => new Date(b.date + 'T00:00:00').getTime() - new Date(a.date + 'T00:00:00').getTime()
      )[0];

      // Update profile's current_weight with the new latest entry (or leave as is if no entries)
      if (refreshedLatest) {
        await syncCurrentWeightToProfile(refreshedLatest.weight);
      }

      setShowWeightModal(false);
    } catch (err) {
      console.error('Failed to delete weight entry', err);
    } finally {
      setSavingWeight(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[TYPOGRAPHY.hero, { color: COLORS.text }]}>
            Hello, {userProfile.name}
          </Text>
          <Pressable style={styles.addWeightButton} onPress={openAddWeight}>
            <MaterialCommunityIcons name="plus" size={20} color={COLORS.accent} />
            <Text style={styles.addWeightText}>Log Weight</Text>
          </Pressable>
        </View>

        {/* Weight Stats Summary */}
        {weightStats.entriesCount > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Current</Text>
              <Text style={styles.statValue}>{weightStats.current} lbs</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Change</Text>
              <Text style={[styles.statValue, { color: (weightStats.totalChange ?? 0) < 0 ? '#6AB7A8' : COLORS.text }]}>
                {(weightStats.totalChange ?? 0) > 0 ? '+' : ''}{weightStats.totalChange} lbs
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Entries</Text>
              <Text style={styles.statValue}>{weightStats.entriesCount}</Text>
            </View>
          </View>
        )}

        {/* Weight Trend Graph */}
        <WeightGraph data={weightData} onPointPress={openEditWeight} entries={validSortedEntries} />

        {/* Segmented Range Selector */}
        <SegmentedControl
          selectedRange={selectedRange}
          onSelect={setSelectedRange}
        />

        {/* Calendar Month View */}
        <CalendarView currentMonth={currentMonth} onMonthChange={setCurrentMonth} meals={meals} weightEntries={weightEntries} />
        
        {/* Spacer for bottom tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Weight Entry Modal */}
      <Modal
        visible={showWeightModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWeightModal(false)}
      >
        <Pressable
          style={[
            styles.modalBackdrop,
            { paddingTop: insets.top + SPACING.lg, paddingBottom: insets.bottom + SPACING.lg },
          ]}
          onPress={() => setShowWeightModal(false)}
        >
          <Pressable style={styles.weightModalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingEntry ? 'Edit Weight Entry' : 'Log Weight'}
              </Text>
              <Pressable onPress={() => setShowWeightModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* Weight Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Weight (lbs)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={weightDraft}
                  onChangeText={setWeightDraft}
                  keyboardType="decimal-pad"
                  placeholder="175.0"
                  placeholderTextColor={COLORS.textMuted}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
              </View>

              {/* Calendar Date Picker */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Date</Text>
                <View style={styles.miniCalendarContainer}>
                  {/* Calendar Header */}
                  <View style={styles.miniCalendarHeader}>
                    <Pressable 
                      style={styles.miniCalendarNav}
                      onPress={() => {
                        const newMonth = new Date(calendarMonth);
                        newMonth.setMonth(newMonth.getMonth() - 1);
                        setCalendarMonth(newMonth);
                      }}
                    >
                      <MaterialCommunityIcons name="chevron-left" size={20} color={COLORS.accent} />
                    </Pressable>
                    <Text style={styles.miniCalendarTitle}>
                      {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </Text>
                    <Pressable 
                      style={styles.miniCalendarNav}
                      onPress={() => {
                        const newMonth = new Date(calendarMonth);
                        newMonth.setMonth(newMonth.getMonth() + 1);
                        if (newMonth <= new Date()) {
                          setCalendarMonth(newMonth);
                        }
                      }}
                    >
                      <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.accent} />
                    </Pressable>
                  </View>

                  {/* Week Day Headers */}
                  <View style={styles.miniWeekRow}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                      <View key={i} style={styles.miniWeekDay}>
                        <Text style={styles.miniWeekDayText}>{day}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Calendar Days */}
                  <View style={styles.miniDaysGrid}>
                    {(() => {
                      const year = calendarMonth.getFullYear();
                      const month = calendarMonth.getMonth();
                      const firstDay = new Date(year, month, 1).getDay();
                      const daysInMonth = new Date(year, month + 1, 0).getDate();
                      const today = new Date();
                      const todayStr = formatDateLocal(today);
                      
                      const days: React.ReactNode[] = [];
                      
                      // Empty cells for days before first of month
                      for (let i = 0; i < firstDay; i++) {
                        days.push(<View key={`empty-${i}`} style={styles.miniDayCell} />);
                      }
                      
                      // Days of the month
                      for (let day = 1; day <= daysInMonth; day++) {
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const isSelected = dateStr === dateDraft;
                        const isToday = dateStr === todayStr;
                        const isFuture = new Date(dateStr) > today;
                        
                        days.push(
                          <Pressable
                            key={day}
                            style={styles.miniDayCell}
                            onPress={() => !isFuture && setDateDraft(dateStr)}
                            disabled={isFuture}
                          >
                            <View style={[
                              styles.miniDayContent,
                              isSelected && styles.miniDaySelected,
                              isToday && !isSelected && styles.miniDayToday,
                            ]}>
                              <Text style={[
                                styles.miniDayText,
                                isSelected && styles.miniDayTextSelected,
                                isToday && !isSelected && styles.miniDayTextToday,
                                isFuture && styles.miniDayTextDisabled,
                              ]}>
                                {day}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      }
                      
                      return days;
                    })()}
                  </View>

                  {/* Selected Date Display */}
                  <View style={styles.selectedDateDisplay}>
                    <MaterialCommunityIcons name="calendar-check" size={16} color={COLORS.accent} />
                    <Text style={styles.selectedDateText}>
                      {new Date(dateDraft + 'T12:00:00').toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'long', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              {editingEntry && (
                <Pressable style={styles.deleteButton} onPress={handleDeleteWeight}>
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color="#E74C3C" />
                </Pressable>
              )}
              <View style={{ flex: 1 }} />
              <Pressable style={styles.cancelButton} onPress={() => {
                Keyboard.dismiss();
                setShowWeightModal(false);
              }}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={[styles.saveButton, savingWeight && { opacity: 0.6 }]} 
                onPress={() => {
                  Keyboard.dismiss();
                  saveWeight();
                }}
                disabled={savingWeight}
              >
                <Text style={styles.saveButtonText}>{savingWeight ? 'Saving...' : 'Save'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ===========================
// Weight Graph Component
// ===========================
function WeightGraph({ 
  data,
  onPointPress,
  entries,
}: { 
  data: { date: Date; weight: number }[];
  onPointPress?: (entry: WeightEntry) => void;
  entries?: WeightEntry[];
}) {
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const { width } = Dimensions.get('window');
  const graphWidth = width - SPACING.lg * 2;
  const graphHeight = 200;
  // Generous padding to ensure edge points are fully visible even with extreme weight changes
  const graphPadding = { top: 24, bottom: 24, left: 16, right: 16 };
  const innerWidth = graphWidth - graphPadding.left - graphPadding.right;
  const innerHeight = graphHeight - graphPadding.top - graphPadding.bottom;

  useEffect(() => {
    console.log('📊 WeightGraph received data:', data.length, 'entries');
    if (data.length > 0) {
      console.log('First entry:', data[0]);
      console.log('Last entry:', data[data.length - 1]);
    }
    animatedProgress.setValue(0);
    Animated.spring(animatedProgress, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [data]);

  // Get the actual current weight (most recent entry by date, then by timestamp) - used for "Current Weight" display
  const actualCurrentWeight = useMemo(() => {
    if (!entries || entries.length === 0) return null;
    
    // Get today's date - filter out any "future" entries
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const todayMs = today.getTime();
    
    const validEntries = entries.filter(e => {
      const entryMs = new Date(e.date + 'T00:00:00').getTime();
      return entryMs <= todayMs;
    });
    
    if (validEntries.length === 0) return null;
    
    // Group by date and get most recent entry for each date
    const entriesByDate = new Map<string, WeightEntry[]>();
    validEntries.forEach(entry => {
      const existing = entriesByDate.get(entry.date) || [];
      existing.push(entry);
      entriesByDate.set(entry.date, existing);
    });
    
    // Find the latest date
    const sortedDates = Array.from(entriesByDate.keys()).sort((a, b) => 
      new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()
    );
    const latestDate = sortedDates[0];
    
    // Get the most recent entry for the latest date (by timestamp)
    const latestDateEntries = entriesByDate.get(latestDate) || [];
    const sorted = latestDateEntries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    return sorted[0]?.weight ?? null;
  }, [entries]);

  // Calculate weight change using actual entries in the displayed range
  // For each unique date, get the most recent entry (by timestamp)
  const { firstWeight, lastWeight, uniqueDatesCount } = useMemo(() => {
    if (!entries || entries.length === 0 || data.length === 0) {
      return { firstWeight: null, lastWeight: null, uniqueDatesCount: 0 };
    }
    
    const minDisplayDate = Math.min(...data.map(d => d.date.getTime()));
    const maxDisplayDate = Math.max(...data.map(d => d.date.getTime()));
    
    // Filter entries within the display range
    const entriesInRange = entries.filter(entry => {
      const entryTime = new Date(entry.date + 'T00:00:00').getTime();
      return entryTime >= minDisplayDate && entryTime <= maxDisplayDate;
    });
    
    if (entriesInRange.length === 0) {
      return { firstWeight: null, lastWeight: null, uniqueDatesCount: 0 };
    }
    
    // Group entries by date and get the most recent entry for each date
    const entriesByDate = new Map<string, WeightEntry[]>();
    entriesInRange.forEach(entry => {
      const existing = entriesByDate.get(entry.date) || [];
      existing.push(entry);
      entriesByDate.set(entry.date, existing);
    });
    
    // For each date, get the most recent entry by timestamp
    const mostRecentByDate = new Map<string, WeightEntry>();
    entriesByDate.forEach((dateEntries, date) => {
      const sorted = dateEntries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      mostRecentByDate.set(date, sorted[0]);
    });
    
    // Get unique dates sorted chronologically
    const sortedDates = Array.from(mostRecentByDate.keys()).sort((a, b) => 
      new Date(a + 'T00:00:00').getTime() - new Date(b + 'T00:00:00').getTime()
    );
    
    const firstDate = sortedDates[0];
    const lastDate = sortedDates[sortedDates.length - 1];
    
    const firstEntry = mostRecentByDate.get(firstDate);
    const lastEntry = mostRecentByDate.get(lastDate);
    
    console.log('📊 Weight change calculation:', {
      firstDate,
      firstWeight: firstEntry?.weight,
      lastDate,
      lastWeight: lastEntry?.weight,
      uniqueDates: sortedDates.length
    });
    
    return {
      firstWeight: firstEntry?.weight ?? null,
      lastWeight: lastEntry?.weight ?? null,
      uniqueDatesCount: sortedDates.length
    };
  }, [entries, data]);

  if (data.length === 0) {
    return (
      <View style={styles.graphCard}>
        <View style={styles.graphHeader}>
          <View>
            <Text style={[TYPOGRAPHY.caption, { color: COLORS.textMuted }]}>
              No weight data
            </Text>
            <Text style={[TYPOGRAPHY.body, { color: COLORS.textMuted }]}>
              Log your first weight entry to see trends
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const weights = data.map((d) => d.weight);
  const minWeight = Math.min(...weights) - 1;
  const maxWeight = Math.max(...weights) + 1;
  const weightRange = maxWeight - minWeight;

  // Get date range for proper x-axis positioning
  const dates = data.map((d) => d.date.getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const dateRange = maxDate - minDate;

  // Create SVG path with padding - use date-based x positioning for accurate representation
  const points = data.map((d) => {
    // Use date-based positioning so rightmost point is always at the edge
    const x = dateRange > 0
      ? graphPadding.left + ((d.date.getTime() - minDate) / dateRange) * innerWidth
      : graphPadding.left + innerWidth / 2; // Single point centered
    const y = graphPadding.top + (1 - ((d.weight - minWeight) / weightRange)) * innerHeight;
    return { x, y };
  });

  // Debug: Log first and last points to verify they reach the edges
  if (points.length > 0) {
    console.log('📍 Graph points - First:', { x: points[0].x, y: points[0].y, expectedLeftEdge: graphPadding.left });
    console.log('📍 Graph points - Last:', { x: points[points.length - 1].x, y: points[points.length - 1].y, expectedRightEdge: graphPadding.left + innerWidth });
    console.log('📍 Weight range:', { min: minWeight, max: maxWeight, range: weightRange });
  }

  const pathData = points.reduce((acc, point, i) => {
    if (i === 0) return `M ${point.x} ${point.y}`;
    return `${acc} L ${point.x} ${point.y}`;
  }, '');

  // Area path for gradient fill - use actual first and last point x coordinates
  const firstX = points[0].x;
  const lastX = points[points.length - 1].x;
  const areaPathData = `${pathData} L ${lastX} ${graphHeight} L ${firstX} ${graphHeight} Z`;

  // Current weight = actual most recent weight (displayed in header)
  const currentWeight = actualCurrentWeight ?? weights[weights.length - 1];
  
  // Change calculation = first date vs last date in the SELECTED range
  const firstRangeWeight = firstWeight ?? weights[0];
  const lastRangeWeight = lastWeight ?? weights[weights.length - 1];
  const weightChange = lastRangeWeight - firstRangeWeight;
  const percentChange = firstRangeWeight > 0 ? (weightChange / firstRangeWeight) * 100 : 0;
  const hasMultipleEntries = uniqueDatesCount > 1;

  return (
    <Animated.View
      style={[
        styles.graphCard,
        {
          opacity: animatedProgress,
          transform: [
            {
              scale: animatedProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.95, 1],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.graphHeader}>
        <View>
          <Text style={[TYPOGRAPHY.caption, { color: COLORS.textMuted }]}>
            Current Weight
          </Text>
          <Text style={[TYPOGRAPHY.hero, { color: COLORS.text, fontSize: 28 }]}>
            {currentWeight.toFixed(1)} lbs
          </Text>
        </View>
        <View style={styles.changeContainer}>
          {hasMultipleEntries ? (
            <>
              <Text
                style={[
                  TYPOGRAPHY.body,
                  {
                    color: weightChange < 0 ? '#34C759' : weightChange > 0 ? '#FF3B30' : COLORS.textMuted,
                    fontWeight: '600',
                  },
                ]}
              >
                {weightChange >= 0 ? '+' : ''}
                {weightChange.toFixed(1)} lbs
              </Text>
              <Text style={[TYPOGRAPHY.caption, { color: COLORS.textMuted }]}>
                {percentChange >= 0 ? '+' : ''}
                {percentChange.toFixed(1)}%
              </Text>
            </>
          ) : (
            <Text style={[TYPOGRAPHY.caption, { color: COLORS.textMuted }]}>
              1 entry in period
            </Text>
          )}
        </View>
      </View>

      <View style={styles.graphContainer}>
        <Svg width={graphWidth} height={graphHeight}>
          <Defs>
            <LinearGradient id="graphGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={COLORS.graphGradientStart} stopOpacity="1" />
              <Stop offset="1" stopColor={COLORS.graphGradientEnd} stopOpacity="0.3" />
            </LinearGradient>
          </Defs>
          {/* Translucent gradient fill */}
          <Path d={areaPathData} fill="url(#graphGradient)" />
          {/* Opaque stroke line on top */}
          <Path
            d={pathData}
            stroke={COLORS.accent}
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={1}
          />
        </Svg>
      </View>
    </Animated.View>
  );
}

// ===========================
// Segmented Control Component
// ===========================
function SegmentedControl({
  selectedRange,
  onSelect,
}: {
  selectedRange: TimeRange;
  onSelect: (range: TimeRange) => void;
}) {
  const ranges: TimeRange[] = ['5D', '2W', '1M', '1Y', 'YTD', 'ALL'];

  return (
    <View style={styles.segmentedContainer}>
      {ranges.map((range) => (
        <SegmentButton
          key={range}
          label={range}
          isActive={selectedRange === range}
          onPress={() => onSelect(range)}
        />
      ))}
    </View>
  );
}

function SegmentButton({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(isActive ? 1 : 0.6)).current;

  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: isActive ? 1 : 0.6,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isActive]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      friction: 6,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      style={styles.segmentPressable}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.segmentButton,
          isActive && styles.segmentButtonActive,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: isActive ? '600' : '500',
            color: isActive ? '#1A1A1A' : '#6B7280',
            letterSpacing: 0.1,
          }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ===========================
// Calendar View Component
// ===========================
function CalendarView({
  currentMonth,
  onMonthChange,
  meals,
  weightEntries,
}: {
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  meals: MealEntry[];
  weightEntries: WeightEntry[];
}) {
  const screenWidth = Dimensions.get('window').width;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const isAnimating = useRef(false);
  const currentMonthRef = useRef(currentMonth);
  
  // Keep ref in sync with prop
  useEffect(() => {
    currentMonthRef.current = currentMonth;
  }, [currentMonth]);

  const navigateMonth = (direction: number) => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    
    // Animate out
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: direction * -40,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Update the month
      const newMonth = new Date(currentMonthRef.current);
      newMonth.setMonth(newMonth.getMonth() + direction);
      onMonthChange(newMonth);
      
      // Reset position for entrance from opposite side
      translateX.setValue(direction * 40);
      
      // Animate in
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          friction: 10,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(() => {
        isAnimating.current = false;
      });
    });
  };

  const panResponder = useMemo(() => 
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 30;
      },
      onPanResponderGrant: () => {
        // Nothing needed on grant
      },
      onPanResponderMove: (_, gestureState) => {
        if (isAnimating.current) return;
        // Dampen the movement for smoother feel
        translateX.setValue(gestureState.dx * 0.4);
        // Subtle opacity fade based on drag distance
        const dragProgress = Math.min(Math.abs(gestureState.dx) / 100, 0.3);
        opacity.setValue(1 - dragProgress);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isAnimating.current) {
          // Reset if already animating
          Animated.spring(translateX, {
            toValue: 0,
            friction: 10,
            tension: 80,
            useNativeDriver: true,
          }).start();
          opacity.setValue(1);
          return;
        }
        
        const velocity = gestureState.vx;
        const dx = gestureState.dx;
        
        // Threshold: either enough distance or enough velocity
        const shouldNavigate = Math.abs(dx) > 50 || Math.abs(velocity) > 0.5;
        
        if (shouldNavigate) {
          // Determine direction: swipe right = previous month (-1), swipe left = next month (1)
          const direction = dx > 0 ? -1 : 1;
          navigateMonth(direction);
        } else {
          // Snap back
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 0,
              friction: 10,
              tension: 100,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 1,
              duration: 100,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
      onPanResponderTerminate: () => {
        // Reset on terminate
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: 0,
            friction: 10,
            tension: 80,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
        ]).start();
      },
    }), 
  []);

  const monthYear = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Generate a unique key for the grid to force clean re-render
  const gridKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth()}`;

  return (
    <View style={styles.calendarCard}>
      <View style={styles.calendarHeader}>
        <Pressable 
          style={styles.calendarNavButton} 
          onPress={() => navigateMonth(-1)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="chevron-left" size={24} color={COLORS.textMuted} />
        </Pressable>
        <Text style={[TYPOGRAPHY.title, { color: COLORS.text }]}>{monthYear}</Text>
        <Pressable 
          style={styles.calendarNavButton} 
          onPress={() => navigateMonth(1)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.textMuted} />
        </Pressable>
      </View>

      <View style={styles.calendarGridContainer} {...panResponder.panHandlers}>
        <Animated.View
          key={gridKey}
          style={{
            opacity: opacity,
            transform: [{ translateX }],
          }}
        >
          <CalendarGrid currentMonth={currentMonth} meals={meals} weightEntries={weightEntries} />
        </Animated.View>
      </View>
    </View>
  );
}

function CalendarGrid({ currentMonth, meals, weightEntries }: { currentMonth: Date; meals: MealEntry[]; weightEntries: WeightEntry[] }) {
  const today = new Date();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  // Create a unique key for the current month to force re-render
  const monthKey = `${year}-${month}`;

  const days: (number | null)[] = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Helper to get dayId for a specific calendar date in ISO format
  const getDayIdForDate = (dayNum: number): string => {
    const calendarDate = new Date(year, month, dayNum);
    calendarDate.setHours(0, 0, 0, 0);
    return formatDateLocal(calendarDate);
  };

  // Compute which days have meal logs based on real meal data
  const daysWithLogs = useMemo(() => {
    const logs = new Set<number>();

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dayId = getDayIdForDate(dayNum);
      const hasMeals = meals.some(meal => meal.dayId === dayId);
      if (hasMeals) {
        logs.add(dayNum);
      }
    }

    return logs;
  }, [meals, month, year, daysInMonth]);

  // Compute which days have weight entries
  const daysWithWeight = useMemo(() => {
    const weights = new Set<number>();

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateStr = getDayIdForDate(dayNum);
      const hasWeight = weightEntries.some(entry => entry.date === dateStr);
      if (hasWeight) {
        weights.add(dayNum);
      }
    }

    return weights;
  }, [weightEntries, month, year, daysInMonth]);

  return (
    <View style={styles.calendarGrid} key={monthKey}>
      {/* Week day headers */}
      <View style={styles.weekRow}>
        {weekDays.map((day, i) => (
          <View key={i} style={styles.weekDayCell}>
            <Text style={styles.weekDayText}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Day grid - 7 columns */}
      <View style={styles.dayGrid}>
        {days.map((day, index) => {
          if (day === null) {
            return <View key={`empty-${index}`} style={styles.dayCellWrapper} />;
          }

          const isToday =
            day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear();

          const hasLog = daysWithLogs.has(day);
          const hasWeight = daysWithWeight.has(day);

          return (
            <DayCell
              key={`${monthKey}-${day}`}
              day={day}
              month={month}
              year={year}
              isToday={isToday}
              hasLog={hasLog}
              hasWeight={hasWeight}
            />
          );
        })}
      </View>
    </View>
  );
}

function DayCell({
  day,
  month,
  year,
  isToday,
  hasLog,
  hasWeight
}: {
  day: number;
  month: number;
  year: number;
  isToday: boolean;
  hasLog: boolean;
  hasWeight: boolean;
}) {
  const router = useRouter();

  const handlePress = () => {
    const selectedDate = new Date(year, month, day);
    selectedDate.setHours(0, 0, 0, 0);

    const dayId = formatDateLocal(selectedDate);
    
    console.log('📅 Calendar tap - navigating to:', dayId);

    // Pass the date string directly to avoid timezone issues
    router.push({
      pathname: '/day-details',
      params: { date: dayId, dayId }
    });
  };

  return (
    <View style={styles.dayCellWrapper}>
      <Pressable onPress={handlePress} style={styles.dayCellPressable}>
        <View style={[styles.dayContent, isToday && styles.todayBadge]}>
          <Text
            style={[
              styles.dayNumber,
              {
                color: isToday ? '#FFFFFF' : COLORS.text,
                fontWeight: isToday ? '500' : '400',
              },
            ]}
          >
            {day}
          </Text>
          {/* Log dot inside the circle for today */}
          {hasLog && isToday && <View style={styles.logDotInside} />}
          {/* Weight indicator inside the circle for today */}
          {hasWeight && isToday && !hasLog && <View style={styles.weightDotInside} />}
        </View>
        {/* Log dot below for other days */}
        {hasLog && !isToday && <View style={styles.logDot} />}
        {/* Weight indicator below for other days */}
        {hasWeight && !isToday && (
          <View style={[styles.weightDot, hasLog && styles.weightDotWithLog]} />
        )}
      </Pressable>
    </View>
  );
}

// ===========================
// Styles
// ===========================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  addWeightButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  addWeightText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.accent,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 8,
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.background,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  saveButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Weight Modal with Calendar
  weightModalCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    width: '100%',
    maxWidth: 380,
    maxHeight: '85%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  // Mini Calendar Styles
  miniCalendarContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  miniCalendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  miniCalendarNav: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  miniCalendarTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  miniWeekRow: {
    flexDirection: 'row',
    marginBottom: SPACING.xs,
  },
  miniWeekDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  miniWeekDayText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  miniDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  miniDayCell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  miniDayContent: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniDaySelected: {
    backgroundColor: COLORS.accent,
  },
  miniDayToday: {
    backgroundColor: 'rgba(44, 62, 80, 0.1)',
  },
  miniDayText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  miniDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  miniDayTextToday: {
    color: COLORS.accent,
    fontWeight: '600',
  },
  miniDayTextDisabled: {
    color: COLORS.border,
  },
  selectedDateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  selectedDateText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.accent,
  },
  graphCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  graphHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  changeContainer: {
    alignItems: 'flex-end',
  },
  graphContainer: {
    marginTop: SPACING.sm,
    overflow: 'hidden',
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#F4F4F5',
    borderRadius: 12,
    padding: 4,
    marginBottom: SPACING.lg,
  },
  segmentPressable: {
    flex: 1,
  },
  segmentButton: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  calendarCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  calendarGridContainer: {
    overflow: 'hidden',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  calendarNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarGrid: {
    paddingHorizontal: SPACING.xs,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellWrapper: {
    width: '14.2857%', // Exactly 1/7 of container width
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellPressable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCell: {
    width: '14.2857%', // Exactly 1/7 = 14.2857%
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  dayContent: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  todayBadge: {
    backgroundColor: COLORS.todayBadge,
  },
  logDot: {
    position: 'absolute',
    bottom: 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.logIndicator,
  },
  logDotInside: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  weightDot: {
    position: 'absolute',
    bottom: 4,
    right: 8,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.accent,
  },
  weightDotWithLog: {
    right: 16,
  },
  weightDotInside: {
    position: 'absolute',
    bottom: 4,
    right: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
});
