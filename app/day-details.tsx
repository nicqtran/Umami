import { deleteMeal, MealEntry, subscribeMeals } from '@/state/meals';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Easing,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

const { width } = Dimensions.get('window');

// Design tokens
const COLORS = {
  background: '#F8F9FB',
  card: '#FFFFFF',
  text: '#111418',
  textMuted: '#6A7178',
  accent: '#2C3E50',
  accentLight: 'rgba(44, 62, 80, 0.08)',
  border: '#E6E8EB',
  danger: '#E74C3C',
  protein: '#D8A648',
  carbs: '#6AB7A8',
  fat: '#9B7BD1',
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export default function DayDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date: string; dayId?: string }>();
  const [meals, setMeals] = useState<MealEntry[]>([]);
  
  // Parse the date from params
  const selectedDate = useMemo(() => {
    if (params.date) {
      return new Date(params.date);
    }
    return new Date();
  }, [params.date]);

  // Use dayId from params if provided, otherwise generate from date
  const dayId = useMemo(() => {
    // If dayId was passed directly, use it
    if (params.dayId) {
      return params.dayId;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);
    
    const diffTime = today.getTime() - selected.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    
    // For older dates, use the abbreviated day name (matching home screen format)
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    return dayNames[selected.getDay()];
  }, [selectedDate, params.dayId]);

  // Subscribe to meals
  useEffect(() => {
    const unsubscribe = subscribeMeals(setMeals);
    return () => unsubscribe();
  }, []);

  // Filter meals for the selected day
  const dayMeals = useMemo(() => {
    return meals.filter((meal) => meal.dayId === dayId);
  }, [meals, dayId]);

  // Calculate daily totals
  const dailyTotals = useMemo(() => {
    return dayMeals.reduce(
      (totals, meal) => {
        const mealTotals = meal.foods.reduce(
          (acc, food) => ({
            calories: acc.calories + food.calories,
            protein: acc.protein + food.protein,
            carbs: acc.carbs + food.carbs,
            fat: acc.fat + food.fat,
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );
        return {
          calories: totals.calories + mealTotals.calories,
          protein: totals.protein + mealTotals.protein,
          carbs: totals.carbs + mealTotals.carbs,
          fat: totals.fat + mealTotals.fat,
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [dayMeals]);

  // Format date for display
  const formattedDate = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Entrance animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const totalsAnim = useRef(new Animated.Value(0)).current;
  const cardsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(totalsAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardsAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleDeleteMeal = (mealId: string) => {
    deleteMeal(mealId);
  };

  const handleEditMeal = (mealId: string) => {
    router.push({ pathname: '/meal-details', params: { dayId, mealId } });
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: headerAnim,
              transform: [
                {
                  translateY: headerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
          </Pressable>
          <View style={styles.headerContent}>
            <Text style={styles.dateTitle}>{formattedDate}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </Animated.View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Daily Totals Card */}
          <Animated.View
            style={[
              styles.totalsCard,
              {
                opacity: totalsAnim,
                transform: [
                  {
                    translateY: totalsAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.totalsTitle}>Daily Summary</Text>
            <View style={styles.caloriesRow}>
              <Text style={styles.caloriesValue}>{Math.round(dailyTotals.calories)}</Text>
              <Text style={styles.caloriesLabel}>calories</Text>
            </View>
            <View style={styles.macrosRow}>
              <View style={styles.macroItem}>
                <View style={[styles.macroDot, { backgroundColor: COLORS.protein }]} />
                <Text style={styles.macroValue}>{Math.round(dailyTotals.protein)}g</Text>
                <Text style={styles.macroLabel}>Protein</Text>
              </View>
              <View style={styles.macroItem}>
                <View style={[styles.macroDot, { backgroundColor: COLORS.carbs }]} />
                <Text style={styles.macroValue}>{Math.round(dailyTotals.carbs)}g</Text>
                <Text style={styles.macroLabel}>Carbs</Text>
              </View>
              <View style={styles.macroItem}>
                <View style={[styles.macroDot, { backgroundColor: COLORS.fat }]} />
                <Text style={styles.macroValue}>{Math.round(dailyTotals.fat)}g</Text>
                <Text style={styles.macroLabel}>Fat</Text>
              </View>
            </View>
          </Animated.View>

          {/* Meals Section */}
          <Animated.View
            style={{
              opacity: cardsAnim,
              transform: [
                {
                  translateY: cardsAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                },
              ],
            }}
          >
            <Text style={styles.sectionTitle}>Meals</Text>
            
            {dayMeals.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="food-off" size={48} color={COLORS.border} />
                <Text style={styles.emptyTitle}>No meals logged</Text>
                <Text style={styles.emptySubtitle}>
                  Snap a photo of your meal to start tracking
                </Text>
              </View>
            ) : (
              <View style={styles.mealsList}>
                {dayMeals.map((meal, index) => (
                  <MealCard
                    key={meal.id}
                    meal={meal}
                    index={index}
                    onDelete={() => handleDeleteMeal(meal.id)}
                    onEdit={() => handleEditMeal(meal.id)}
                  />
                ))}
              </View>
            )}
          </Animated.View>

          {/* Bottom spacer */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// ===========================
// Meal Card Component
// ===========================
function MealCard({
  meal,
  index,
  onDelete,
  onEdit,
}: {
  meal: MealEntry;
  index: number;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const deleteThreshold = -80;

  // Calculate meal totals
  const mealTotals = useMemo(() => {
    return meal.foods.reduce(
      (acc, food) => ({
        calories: acc.calories + food.calories,
        protein: acc.protein + food.protein,
        carbs: acc.carbs + food.carbs,
        fat: acc.fat + food.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [meal.foods]);

  // Entrance animation
  useEffect(() => {
    Animated.timing(cardAnim, {
      toValue: 1,
      duration: 400,
      delay: index * 80,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [index]);

  // Swipe gesture
  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      if (event.translationX < 0) {
        translateX.setValue(Math.max(event.translationX, -120));
      }
    })
    .onEnd((event) => {
      if (event.translationX < deleteThreshold) {
        // Show delete button
        Animated.spring(translateX, {
          toValue: -80,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }).start();
      } else {
        // Snap back
        Animated.spring(translateX, {
          toValue: 0,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }).start();
      }
    });

  const handleDelete = () => {
    Animated.timing(translateX, {
      toValue: -width,
      duration: 250,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      onDelete();
    });
  };

  return (
    <Animated.View
      style={[
        styles.mealCardContainer,
        {
          opacity: cardAnim,
          transform: [
            {
              translateY: cardAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        },
      ]}
    >
      {/* Delete action behind card */}
      <View style={styles.deleteAction}>
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <MaterialCommunityIcons name="trash-can-outline" size={24} color="#FFFFFF" />
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      </View>

      {/* Swipeable card */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.mealCard, { transform: [{ translateX }] }]}>
          {/* Meal image */}
          <View style={styles.mealImageContainer}>
            <Image
              source={meal.image}
              style={styles.mealImage}
              contentFit="cover"
              transition={200}
            />
          </View>

          {/* Meal info */}
          <View style={styles.mealInfo}>
            <View style={styles.mealHeader}>
              <Text style={styles.mealName} numberOfLines={1}>
                {meal.name}
              </Text>
              <Pressable style={styles.editButton} onPress={onEdit}>
                <Text style={styles.editButtonText}>Edit</Text>
              </Pressable>
            </View>

            <Text style={styles.mealTime}>{meal.time}</Text>

            <View style={styles.mealStats}>
              <Text style={styles.mealCalories}>
                {Math.round(mealTotals.calories)} kcal
              </Text>
              <View style={styles.mealMacros}>
                <Text style={[styles.mealMacro, { color: COLORS.protein }]}>
                  P {Math.round(mealTotals.protein)}g
                </Text>
                <Text style={[styles.mealMacro, { color: COLORS.carbs }]}>
                  C {Math.round(mealTotals.carbs)}g
                </Text>
                <Text style={[styles.mealMacro, { color: COLORS.fat }]}>
                  F {Math.round(mealTotals.fat)}g
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  dateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  totalsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  totalsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textMuted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: SPACING.md,
  },
  caloriesRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: SPACING.lg,
  },
  caloriesValue: {
    fontSize: 48,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -1,
  },
  caloriesLabel: {
    fontSize: 18,
    fontWeight: '400',
    color: COLORS.textMuted,
    marginLeft: SPACING.sm,
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroItem: {
    flex: 1,
    alignItems: 'center',
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: SPACING.xs,
  },
  macroValue: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  macroLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.textMuted,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textMuted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: SPACING.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
    paddingHorizontal: SPACING.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: 15,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.xs,
    lineHeight: 22,
  },
  mealsList: {
    gap: SPACING.md,
  },
  mealCardContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
  },
  deleteAction: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 100,
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  deleteButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  deleteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 4,
  },
  mealCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  mealImageContainer: {
    width: 100,
    height: 100,
  },
  mealImage: {
    width: '100%',
    height: '100%',
  },
  mealInfo: {
    flex: 1,
    padding: SPACING.md,
    justifyContent: 'space-between',
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  mealName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    marginRight: SPACING.sm,
  },
  editButton: {
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.xs + 2,
    backgroundColor: COLORS.accentLight,
    borderRadius: 8,
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.accent,
  },
  mealTime: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  mealStats: {
    marginTop: SPACING.sm,
  },
  mealCalories: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  mealMacros: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  mealMacro: {
    fontSize: 12,
    fontWeight: '500',
  },
});
