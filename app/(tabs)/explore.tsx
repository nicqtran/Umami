import { GoalsState, subscribeGoals, updateGoals } from '@/state/goals';
import { MealEntry, subscribeMeals } from '@/state/meals';
import { subscribeUserProfile, UserProfile } from '@/state/user';
import {
  addWeightEntry,
  deleteWeightEntry,
  getLatestWeight,
  getWeightStats,
  initializeSampleData,
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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

// Get weight data from actual weight log entries
const getWeightDataForRange = (days: number, weightEntries: WeightEntry[]): { date: Date; weight: number }[] => {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - days + 1);
  
  // Filter entries within the range
  const entriesInRange = weightEntries.filter((entry) => {
    const entryDate = new Date(entry.date);
    return entryDate >= startDate && entryDate <= today;
  });
  
  // Sort by date (oldest first)
  entriesInRange.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Convert to chart format
  return entriesInRange.map((entry) => ({
    date: new Date(entry.date),
    weight: entry.weight,
  }));
};

const RANGE_DAYS: Record<TimeRange, number> = {
  '5D': 5,
  '2W': 14,
  '1M': 30,
  '1Y': 365,
  'YTD': Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24)) || 1,
  'ALL': 730,
};

export default function LogScreen() {
  const router = useRouter();
  const [selectedRange, setSelectedRange] = useState<TimeRange>('1M');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [userProfile, setUserProfile] = useState<UserProfile>({ name: 'there' });
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [goals, setGoals] = useState<GoalsState | null>(null);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  
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

  // Initialize sample data if no entries exist
  useEffect(() => {
    if (weightEntries.length === 0 && goals) {
      initializeSampleData(goals.startingWeight, goals.currentWeight, 8);
    }
  }, [goals]);

  // Sync latest weight with goals
  useEffect(() => {
    const latest = getLatestWeight();
    if (latest && goals && latest.weight !== goals.currentWeight) {
      updateGoals({ currentWeight: latest.weight });
    }
  }, [weightEntries]);
  
  const weightData = useMemo(
    () => getWeightDataForRange(RANGE_DAYS[selectedRange], weightEntries),
    [selectedRange, weightEntries]
  );

  const weightStats = useMemo(() => getWeightStats(), [weightEntries]);

  // Weight entry handlers
  const openAddWeight = () => {
    setEditingEntry(null);
    setWeightDraft(goals?.currentWeight?.toString() ?? '175');
    const today = new Date().toISOString().split('T')[0];
    setDateDraft(today);
    setCalendarMonth(new Date());
    setShowWeightModal(true);
  };

  const openEditWeight = (entry: WeightEntry) => {
    setEditingEntry(entry);
    setWeightDraft(entry.weight.toString());
    setDateDraft(entry.date);
    setCalendarMonth(new Date(entry.date));
    setShowWeightModal(true);
  };

  const saveWeight = () => {
    const weight = parseFloat(weightDraft);
    if (!Number.isFinite(weight) || weight <= 0) return;

    if (editingEntry) {
      updateWeightEntry(editingEntry.id, { weight, date: dateDraft });
    } else {
      addWeightEntry(weight, dateDraft);
    }
    setShowWeightModal(false);
  };

  const handleDeleteWeight = () => {
    if (editingEntry) {
      deleteWeightEntry(editingEntry.id);
      setShowWeightModal(false);
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
        <WeightGraph data={weightData} onPointPress={openEditWeight} entries={weightEntries} />

        {/* Segmented Range Selector */}
        <SegmentedControl
          selectedRange={selectedRange}
          onSelect={setSelectedRange}
        />

        {/* Calendar Month View */}
        <CalendarView currentMonth={currentMonth} onMonthChange={setCurrentMonth} meals={meals} />
        
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
        <Pressable style={styles.modalBackdrop} onPress={() => setShowWeightModal(false)}>
          <Pressable style={styles.weightModalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingEntry ? 'Edit Weight Entry' : 'Log Weight'}
              </Text>
              <Pressable onPress={() => setShowWeightModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.textMuted} />
              </Pressable>
            </View>

            <View style={styles.modalContent}>
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
                      const todayStr = today.toISOString().split('T')[0];
                      
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
            </View>

            <View style={styles.modalActions}>
              {editingEntry && (
                <Pressable style={styles.deleteButton} onPress={handleDeleteWeight}>
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color="#E74C3C" />
                </Pressable>
              )}
              <View style={{ flex: 1 }} />
              <Pressable style={styles.cancelButton} onPress={() => setShowWeightModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={saveWeight}>
                <Text style={styles.saveButtonText}>Save</Text>
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
  const graphPadding = { top: 20, bottom: 20, left: 0, right: 0 };
  const innerWidth = graphWidth - graphPadding.left - graphPadding.right;
  const innerHeight = graphHeight - graphPadding.top - graphPadding.bottom;

  useEffect(() => {
    animatedProgress.setValue(0);
    Animated.spring(animatedProgress, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [data]);

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

  // Create SVG path with padding
  const points = data.map((d, i) => {
    const x = graphPadding.left + (i / Math.max(data.length - 1, 1)) * innerWidth;
    const y = graphPadding.top + (1 - ((d.weight - minWeight) / weightRange)) * innerHeight;
    return { x, y };
  });

  const pathData = points.reduce((acc, point, i) => {
    if (i === 0) return `M ${point.x} ${point.y}`;
    return `${acc} L ${point.x} ${point.y}`;
  }, '');

  // Area path for gradient fill
  const areaPathData = `${pathData} L ${graphPadding.left + innerWidth} ${graphHeight} L ${graphPadding.left} ${graphHeight} Z`;

  // Compare first entry in period to latest entry in period
  const firstWeightInPeriod = weights[0];
  const latestWeightInPeriod = weights[weights.length - 1];
  const weightChange = latestWeightInPeriod - firstWeightInPeriod;
  const percentChange = (weightChange / firstWeightInPeriod) * 100;
  const hasMultipleEntries = data.length > 1;

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
            {latestWeightInPeriod.toFixed(1)} lbs
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
}: {
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  meals: MealEntry[];
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
          <CalendarGrid currentMonth={currentMonth} meals={meals} />
        </Animated.View>
      </View>
    </View>
  );
}

function CalendarGrid({ currentMonth, meals }: { currentMonth: Date; meals: MealEntry[] }) {
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
    return calendarDate.toISOString().split('T')[0];
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

          return (
            <DayCell 
              key={`${monthKey}-${day}`}
              day={day} 
              month={month}
              year={year}
              isToday={isToday} 
              hasLog={hasLog} 
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
  hasLog 
}: { 
  day: number; 
  month: number;
  year: number;
  isToday: boolean; 
  hasLog: boolean;
}) {
  const router = useRouter();

  const handlePress = () => {
    const selectedDate = new Date(year, month, day);
    selectedDate.setHours(0, 0, 0, 0);

    const dayId = selectedDate.toISOString().split('T')[0];

    router.push({
      pathname: '/day-details',
      params: { date: selectedDate.toISOString(), dayId }
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
          {/* Log dot inside the circle for today, or below for other days */}
          {hasLog && isToday && <View style={styles.logDotInside} />}
        </View>
        {hasLog && !isToday && <View style={styles.logDot} />}
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
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: 240,
    paddingBottom: SPACING.lg,
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
});
