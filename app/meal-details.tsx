import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    Keyboard,
    Modal,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableWithoutFeedback,
    View,
} from 'react-native';

import { deleteMeal as deleteMealFromStore, FoodItem, getMeals, updateMealFoods, updateMealMeta } from '@/state/meals';
import { Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { DeviceEventEmitter } from 'react-native';

type BreakdownItem = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  quantity: string;
};

const background = '#F8F9FB';
const card = '#FFFFFF';
const border = '#E6E8EB';
const text = '#111418';
const muted = '#6A7178';
const accent = '#2C3E50';

export default function MealDetailsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { dayId, mealId } = useLocalSearchParams<{ dayId?: string; mealId?: string }>();

  const [fontsLoaded] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const initialMeal = getMeals().find((meal) => meal.id === mealId);
  const initialFoods =
    initialMeal?.foods ?? [{ id: 'fallback', name: 'Sample food', calories: 120, protein: 8, carbs: 10, fat: 4, quantity: '100g' }];
  const mealImageSource = initialMeal?.image ?? require('@/assets/images/image-trimmed.png');

  // Calculate daily totals for contribution percentage
  const allDayMeals = getMeals().filter((meal) => meal.dayId === dayId);
  const dailyTotalCalories = allDayMeals.reduce((sum, meal) => {
    const mealCalories = meal.foods.reduce((acc, food) => acc + food.calories, 0);
    return sum + mealCalories;
  }, 0);

  const computeTotals = (items: BreakdownItem[]) => {
    const caloriesTotal = items.reduce((sum, item) => sum + (item.calories || 0), 0);
    const protein = items.reduce((sum, item) => sum + (item.protein || 0), 0);
    const carbs = items.reduce((sum, item) => sum + (item.carbs || 0), 0);
    const fat = items.reduce((sum, item) => sum + (item.fat || 0), 0);
    return { caloriesTotal, protein, carbs, fat };
  };

  const initialTotals = computeTotals(initialFoods);

  const [calories, setCalories] = useState(`${initialTotals.caloriesTotal}`);
  const [mealName, setMealName] = useState(initialMeal?.name ?? 'Meal');
  const [showImageModal, setShowImageModal] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [mealNameDraft, setMealNameDraft] = useState(mealName);
  const [editingCalories, setEditingCalories] = useState(false);
  const [caloriesDraft, setCaloriesDraft] = useState(`${initialTotals.caloriesTotal}`);
  const [editingProtein, setEditingProtein] = useState(false);
  const [proteinDraft, setProteinDraft] = useState(`${initialTotals.protein}`);
  const [editingCarbs, setEditingCarbs] = useState(false);
  const [carbsDraft, setCarbsDraft] = useState(`${initialTotals.carbs}`);
  const [editingFat, setEditingFat] = useState(false);
  const [fatDraft, setFatDraft] = useState(`${initialTotals.fat}`);
  const [editingFood, setEditingFood] = useState<BreakdownItem | null>(null);
  const foodEditAnim = useRef(new Animated.Value(0)).current;
  const [foodDraft, setFoodDraft] = useState<{
    id: string;
    name: string;
    quantity: string;
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
  } | null>(null);

  const entrance = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef([...Array(4)].map(() => new Animated.Value(0))).current;

  const [breakdownItems, setBreakdownItems] = useState<BreakdownItem[]>(initialFoods);

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    Animated.stagger(
      80,
      cardAnims.map((anim) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [entrance, cardAnims]);

  const createCardStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
        }),
      },
    ],
  });

  useEffect(() => {
    Animated.timing(foodEditAnim, {
      toValue: editingFood ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [editingFood, foodEditAnim]);

  const totals = useMemo(() => computeTotals(breakdownItems), [breakdownItems]);

  useEffect(() => {
    setCalories(`${totals.caloriesTotal}`);
  }, [totals.caloriesTotal]);

  const latestDataRef = useRef<{ breakdown: BreakdownItem[]; totals: ReturnType<typeof computeTotals>; mealName: string }>({
    breakdown: breakdownItems,
    totals,
    mealName,
  });

  useEffect(() => {
    latestDataRef.current = { breakdown: breakdownItems, totals, mealName };
  }, [breakdownItems, totals, mealName]);

  const pushSnapshot = useCallback(
    (items: BreakdownItem[], snapshotTotals: ReturnType<typeof computeTotals>, nameValue: string) => {
      latestDataRef.current = { breakdown: items, totals: snapshotTotals, mealName: nameValue };
      if (dayId && mealId) {
        const payload = {
          dayId,
          mealId,
          calories: snapshotTotals.caloriesTotal,
          protein: snapshotTotals.protein,
          carbs: snapshotTotals.carbs,
          fat: snapshotTotals.fat,
        };
        DeviceEventEmitter.emit('mealUpdated', payload);
        updateMealMeta(mealId, { name: nameValue });
        updateMealFoods(mealId, items as FoodItem[]);
      }
    },
    [dayId, mealId],
  );

  const applySnapshot = useCallback(
    (items: BreakdownItem[], snapshotTotals: ReturnType<typeof computeTotals>, nameValue: string, withHaptics = false) => {
      setBreakdownItems(items);
      setCalories(`${Math.round(snapshotTotals.caloriesTotal)}`);
      setMealName(nameValue);
      pushSnapshot(items, snapshotTotals, nameValue);
      if (withHaptics) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
    },
    [pushSnapshot],
  );

  const addFood = () => {
    const newItem: BreakdownItem = {
      id: `${Date.now()}`,
      name: 'New food',
      calories: 120,
      protein: 8,
      carbs: 10,
      fat: 4,
      quantity: '100g',
    };
    const nextItems = [...breakdownItems, newItem];
    const nextTotals = computeTotals(nextItems);
    applySnapshot(nextItems, nextTotals, mealName, true);
    setShowActions(false);
  };

  const deleteMeal = () => {
    setBreakdownItems([]);
    setCalories('0');
    setShowActions(false);
    if (dayId && mealId) {
      DeviceEventEmitter.emit('mealDeleted', { dayId, mealId });
      deleteMealFromStore(mealId);
    }
    router.replace('/(tabs)');
  };

  const scaleItemsToCalories = (items: BreakdownItem[], targetCalories: number) => {
    const base = computeTotals(items).caloriesTotal;
    if (base <= 0 || !Number.isFinite(base)) {
      if (!items.length) return items;
      const [first, ...rest] = items;
      return [{ ...first, calories: Math.max(0, Math.round(targetCalories)) }, ...rest];
    }
    const ratio = targetCalories / base;
    
    // Scale all items with floating point precision first
    const scaledItems = items.map((item) => ({
      ...item,
      calories: Math.max(0, item.calories * ratio),
      protein: Math.max(0, item.protein * ratio),
      carbs: Math.max(0, item.carbs * ratio),
      fat: Math.max(0, item.fat * ratio),
    }));
    
    // Round all items except the last one
    const roundedItems = scaledItems.map((item, index) => {
      if (index === scaledItems.length - 1) return item; // Keep last item unrounded for now
      return {
        ...item,
        calories: Math.round(item.calories),
        protein: Math.round(item.protein),
        carbs: Math.round(item.carbs),
        fat: Math.round(item.fat),
      };
    });
    
    // Adjust the last item to ensure the total matches exactly
    if (roundedItems.length > 0) {
      const sumWithoutLast = roundedItems.slice(0, -1).reduce((sum, item) => sum + item.calories, 0);
      const lastItem = roundedItems[roundedItems.length - 1];
      roundedItems[roundedItems.length - 1] = {
        ...lastItem,
        calories: Math.max(0, Math.round(targetCalories - sumWithoutLast)),
        protein: Math.round(lastItem.protein),
        carbs: Math.round(lastItem.carbs),
        fat: Math.round(lastItem.fat),
      };
    }
    
    return roundedItems;
  };

  const startEditingCalories = () => {
    setCaloriesDraft(`${Math.round(totals.caloriesTotal)}`);
    setEditingCalories(true);
  };

  const submitCaloriesEdit = () => {
    const parsedCalories = Math.round(parseFloat(caloriesDraft) || 0);
    const targetCalories = Number.isFinite(parsedCalories) ? Math.max(0, parsedCalories) : totals.caloriesTotal;
    const nextItems = scaleItemsToCalories(breakdownItems, targetCalories);
    const nextTotals = computeTotals(nextItems);
    applySnapshot(nextItems, nextTotals, mealName, true);
    setEditingCalories(false);
  };

  const cancelCaloriesEdit = () => {
    setEditingCalories(false);
    setCaloriesDraft(`${Math.round(totals.caloriesTotal)}`);
  };

  const startRenaming = () => {
    setMealNameDraft(mealName);
    setRenaming(true);
  };

  const submitRenaming = () => {
    const trimmedName = mealNameDraft.trim() || mealName;
    applySnapshot(breakdownItems, totals, trimmedName, true);
    setRenaming(false);
  };

  const cancelRenaming = () => {
    setRenaming(false);
    setMealNameDraft(mealName);
  };

  const openFoodEditor = (item: BreakdownItem) => {
    setEditingFood(item);
    setFoodDraft({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      calories: `${item.calories}`,
      protein: `${item.protein}`,
      carbs: `${item.carbs}`,
      fat: `${item.fat}`,
    });
  };

  const saveFoodEdit = () => {
    if (!foodDraft) return;
    const nextItems = breakdownItems.map((item) =>
      item.id === foodDraft.id
        ? {
            ...item,
            name: foodDraft.name.trim() || item.name,
            quantity: foodDraft.quantity || item.quantity,
            calories: Math.max(0, Math.round(parseFloat(foodDraft.calories) || 0)),
            protein: Math.max(0, Math.round(parseFloat(foodDraft.protein) || 0)),
            carbs: Math.max(0, Math.round(parseFloat(foodDraft.carbs) || 0)),
            fat: Math.max(0, Math.round(parseFloat(foodDraft.fat) || 0)),
          }
        : item,
    );
    const nextTotals = computeTotals(nextItems);
    applySnapshot(nextItems, nextTotals, mealName, true);
    setEditingFood(null);
    setFoodDraft(null);
  };

  const cancelFoodEdit = () => {
    setEditingFood(null);
    setFoodDraft(null);
  };

  const scaleItemsToMacros = (items: BreakdownItem[], targetProtein: number, targetCarbs: number, targetFat: number) => {
    const currentTotals = computeTotals(items);
    if (items.length === 0) return items;

    const proteinRatio = currentTotals.protein > 0 ? targetProtein / currentTotals.protein : 1;
    const carbsRatio = currentTotals.carbs > 0 ? targetCarbs / currentTotals.carbs : 1;
    const fatRatio = currentTotals.fat > 0 ? targetFat / currentTotals.fat : 1;

    // Scale all items with floating point precision first
    const scaledItems = items.map((item) => ({
      ...item,
      protein: Math.max(0, item.protein * proteinRatio),
      carbs: Math.max(0, item.carbs * carbsRatio),
      fat: Math.max(0, item.fat * fatRatio),
    }));

    // Round all items except the last one
    const roundedItems = scaledItems.map((item, index) => {
      if (index === scaledItems.length - 1) return item; // Keep last item unrounded for now
      const newProtein = Math.round(item.protein);
      const newCarbs = Math.round(item.carbs);
      const newFat = Math.round(item.fat);
      const newCalories = Math.round(newProtein * 4 + newCarbs * 4 + newFat * 9);
      return {
        ...item,
        protein: newProtein,
        carbs: newCarbs,
        fat: newFat,
        calories: newCalories,
      };
    });

    // Adjust the last item to ensure totals match exactly
    if (roundedItems.length > 0) {
      const sumsWithoutLast = roundedItems.slice(0, -1).reduce(
        (acc, item) => ({
          protein: acc.protein + item.protein,
          carbs: acc.carbs + item.carbs,
          fat: acc.fat + item.fat,
        }),
        { protein: 0, carbs: 0, fat: 0 }
      );
      
      const lastProtein = Math.max(0, Math.round(targetProtein - sumsWithoutLast.protein));
      const lastCarbs = Math.max(0, Math.round(targetCarbs - sumsWithoutLast.carbs));
      const lastFat = Math.max(0, Math.round(targetFat - sumsWithoutLast.fat));
      const lastCalories = Math.round(lastProtein * 4 + lastCarbs * 4 + lastFat * 9);
      
      roundedItems[roundedItems.length - 1] = {
        ...roundedItems[roundedItems.length - 1],
        protein: lastProtein,
        carbs: lastCarbs,
        fat: lastFat,
        calories: lastCalories,
      };
    }

    return roundedItems;
  };

  const startEditingProtein = () => {
    setProteinDraft(`${Math.round(totals.protein)}`);
    setEditingProtein(true);
  };

  const submitProteinEdit = () => {
    const targetProtein = Math.max(0, parseFloat(proteinDraft) || 0);
    const nextItems = scaleItemsToMacros(breakdownItems, targetProtein, totals.carbs, totals.fat);
    const nextTotals = computeTotals(nextItems);
    applySnapshot(nextItems, nextTotals, mealName, true);
    setEditingProtein(false);
  };

  const cancelProteinEdit = () => {
    setEditingProtein(false);
    setProteinDraft(`${Math.round(totals.protein)}`);
  };

  const startEditingCarbs = () => {
    setCarbsDraft(`${Math.round(totals.carbs)}`);
    setEditingCarbs(true);
  };

  const submitCarbsEdit = () => {
    const targetCarbs = Math.max(0, parseFloat(carbsDraft) || 0);
    const nextItems = scaleItemsToMacros(breakdownItems, totals.protein, targetCarbs, totals.fat);
    const nextTotals = computeTotals(nextItems);
    applySnapshot(nextItems, nextTotals, mealName, true);
    setEditingCarbs(false);
  };

  const cancelCarbsEdit = () => {
    setEditingCarbs(false);
    setCarbsDraft(`${Math.round(totals.carbs)}`);
  };

  const startEditingFat = () => {
    setFatDraft(`${Math.round(totals.fat)}`);
    setEditingFat(true);
  };

  const submitFatEdit = () => {
    const targetFat = Math.max(0, parseFloat(fatDraft) || 0);
    const nextItems = scaleItemsToMacros(breakdownItems, totals.protein, totals.carbs, targetFat);
    const nextTotals = computeTotals(nextItems);
    applySnapshot(nextItems, nextTotals, mealName, true);
    setEditingFat(false);
  };

  const cancelFatEdit = () => {
    setEditingFat(false);
    setFatDraft(`${Math.round(totals.fat)}`);
  };

  const syncUpdates = useCallback(() => {
    const current = latestDataRef.current;
    pushSnapshot(current.breakdown, current.totals, current.mealName);
  }, [pushSnapshot]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', syncUpdates);
    return unsubscribe;
  }, [navigation, syncUpdates]);

  const handleExit = useCallback(() => {
    syncUpdates();
    router.back();
  }, [router, syncUpdates]);

  const foodEditStyle = {
    opacity: foodEditAnim,
    transform: [
      {
        translateY: foodEditAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        }),
      },
    ],
  };

  const pageStyle = {
    opacity: entrance,
    transform: [
      {
        scale: entrance.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1],
        }),
      },
    ],
  };

  const titleFont = fontsLoaded ? styles.titleLoaded : null;
  const semiFont = fontsLoaded ? styles.semiLoaded : null;
  const bodyFont = fontsLoaded ? styles.bodyLoaded : null;
  const lightFont = fontsLoaded ? styles.lightLoaded : null;

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View style={[styles.container, pageStyle]}>
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={handleExit}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={text} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
          <Animated.View style={[styles.heroSection, createCardStyle(cardAnims[0])]}>
            <Pressable onPress={() => setShowImageModal(true)}>
              <Image source={mealImageSource} style={styles.heroImage} contentFit="cover" />
            </Pressable>
            {renaming ? (
              <TextInput
                style={[styles.heroNameInput, titleFont]}
                value={mealNameDraft}
                onChangeText={setMealNameDraft}
                onSubmitEditing={submitRenaming}
                onBlur={cancelRenaming}
                returnKeyType="done"
                autoFocus
                placeholder="Meal name"
                placeholderTextColor={muted}
              />
            ) : (
              <Pressable onPress={startRenaming}>
                <Text style={[styles.heroName, titleFont]}>{mealName}</Text>
              </Pressable>
            )}
          </Animated.View>

          <Animated.View style={createCardStyle(cardAnims[1])}>
            <View style={styles.currentWeightCard}>
              <Text style={[styles.currentWeightLabel, bodyFont]}>Total Calories</Text>
              {editingCalories ? (
                <TextInput
                  style={[styles.currentWeightValue, titleFont, styles.caloriesInput]}
                  value={caloriesDraft}
                  onChangeText={setCaloriesDraft}
                  onSubmitEditing={submitCaloriesEdit}
                  onBlur={cancelCaloriesEdit}
                  returnKeyType="done"
                  autoFocus
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={muted}
                />
              ) : (
                <Pressable onPress={startEditingCalories}>
                  <Text style={[styles.currentWeightValue, titleFont]}>{Math.round(totals.caloriesTotal)}</Text>
                </Pressable>
              )}
              {dailyTotalCalories > 0 && (
                <View style={styles.progressWrapper}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.min(100, Math.round((totals.caloriesTotal / dailyTotalCalories) * 100))}%` },
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressLabel, bodyFont]}>
                    {Math.round((totals.caloriesTotal / dailyTotalCalories) * 100)}% of today's calories
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>

          <Animated.View style={[styles.metricCard, createCardStyle(cardAnims[2])]}>
            <Text style={[styles.sectionTitle, semiFont]}>Macro Breakdown</Text>
            <View style={styles.macroSummary}>
              {[
                {
                  label: 'Protein',
                  value: Math.round(totals.protein),
                  color: '#D8A648',
                  editing: editingProtein,
                  draft: proteinDraft,
                  setDraft: setProteinDraft,
                  onPress: startEditingProtein,
                  onSubmit: submitProteinEdit,
                  onCancel: cancelProteinEdit,
                },
                {
                  label: 'Carbs',
                  value: Math.round(totals.carbs),
                  color: '#6AB7A8',
                  editing: editingCarbs,
                  draft: carbsDraft,
                  setDraft: setCarbsDraft,
                  onPress: startEditingCarbs,
                  onSubmit: submitCarbsEdit,
                  onCancel: cancelCarbsEdit,
                },
                {
                  label: 'Fat',
                  value: Math.round(totals.fat),
                  color: '#9B7BD1',
                  editing: editingFat,
                  draft: fatDraft,
                  setDraft: setFatDraft,
                  onPress: startEditingFat,
                  onSubmit: submitFatEdit,
                  onCancel: cancelFatEdit,
                },
              ].map((item) => (
                <View key={item.label} style={styles.macroChip}>
                  <View style={[styles.dot, { backgroundColor: item.color }]} />
                  <View style={styles.macroTextStack}>
                    <Text style={[styles.macroLabel, lightFont]} numberOfLines={1}>
                      {item.label}
                    </Text>
                    {item.editing ? (
                      <TextInput
                        style={[styles.macroValue, semiFont, styles.macroInput]}
                        value={item.draft}
                        onChangeText={item.setDraft}
                        onSubmitEditing={item.onSubmit}
                        onBlur={item.onCancel}
                        autoFocus
                        returnKeyType="done"
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={muted}
                      />
                    ) : (
                      <Pressable onPress={item.onPress}>
                        <Text style={[styles.macroValue, semiFont]} numberOfLines={1}>
                          {item.value}g
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>

          <Animated.View style={createCardStyle(cardAnims[3])}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, semiFont]}>Food Items</Text>
              <Pressable style={styles.fab} onPress={() => setShowActions(true)}>
                <MaterialCommunityIcons name="pencil-outline" size={18} color={text} />
              </Pressable>
            </View>
            <View style={styles.activitySelector}>
              {breakdownItems.map((item) => (
                <Pressable key={item.id} style={styles.activityOption} onPress={() => openFoodEditor(item)}>
                  <View style={styles.activityContent}>
                    <Text style={[styles.activityLabel, semiFont]}>{item.name}</Text>
                    <Text style={[styles.activityDescription, lightFont]}>
                      {item.quantity} • {item.calories} kcal
                    </Text>
                  </View>
                  <View>
                    <Text style={[styles.foodMacros, lightFont]}>
                      P {item.protein}g • C {item.carbs}g • F {item.fat}g
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        </ScrollView>

        <Modal visible={!!editingFood} transparent animationType="fade" onRequestClose={cancelFoodEdit}>
          <Pressable style={styles.modalBackdrop} onPress={cancelFoodEdit}>
            <Animated.View style={[styles.editCard, foodEditStyle]}>
              <Text style={[styles.editTitle, semiFont]}>Edit food</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                  style={[styles.inputField, bodyFont]}
                  value={foodDraft?.name || ''}
                  onChangeText={(text) => setFoodDraft((prev) => (prev ? { ...prev, name: text } : prev))}
                  placeholder="Food name"
                  placeholderTextColor={muted}
                  returnKeyType="next"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Serving size</Text>
                <TextInput
                  style={[styles.inputField, bodyFont]}
                  value={foodDraft?.quantity || ''}
                  onChangeText={(text) => setFoodDraft((prev) => (prev ? { ...prev, quantity: text } : prev))}
                  placeholder="e.g. 120g"
                  placeholderTextColor={muted}
                  returnKeyType="next"
                />
              </View>
              <View style={styles.inputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Calories</Text>
                  <TextInput
                    style={[styles.inputField, bodyFont]}
                    value={foodDraft?.calories || ''}
                    onChangeText={(text) => setFoodDraft((prev) => (prev ? { ...prev, calories: text } : prev))}
                    keyboardType="numeric"
                    placeholder="120"
                    placeholderTextColor={muted}
                    returnKeyType="next"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Protein (g)</Text>
                  <TextInput
                    style={[styles.inputField, bodyFont]}
                    value={foodDraft?.protein || ''}
                    onChangeText={(text) => setFoodDraft((prev) => (prev ? { ...prev, protein: text } : prev))}
                    keyboardType="numeric"
                    placeholder="8"
                    placeholderTextColor={muted}
                    returnKeyType="next"
                  />
                </View>
              </View>
              <View style={styles.inputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Carbs (g)</Text>
                  <TextInput
                    style={[styles.inputField, bodyFont]}
                    value={foodDraft?.carbs || ''}
                    onChangeText={(text) => setFoodDraft((prev) => (prev ? { ...prev, carbs: text } : prev))}
                    keyboardType="numeric"
                    placeholder="10"
                    placeholderTextColor={muted}
                    returnKeyType="next"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Fat (g)</Text>
                  <TextInput
                    style={[styles.inputField, bodyFont]}
                    value={foodDraft?.fat || ''}
                    onChangeText={(text) => setFoodDraft((prev) => (prev ? { ...prev, fat: text } : prev))}
                    keyboardType="numeric"
                    placeholder="4"
                    placeholderTextColor={muted}
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />
                </View>
              </View>
              <View style={styles.editActions}>
                <Pressable style={styles.pillButton} onPress={cancelFoodEdit}>
                  <Text style={[styles.pillButtonText, bodyFont]}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.pillButton, styles.pillPrimary]} onPress={saveFoodEdit}>
                  <Text style={[styles.pillButtonText, styles.pillPrimaryText, bodyFont]}>Save</Text>
                </Pressable>
              </View>
            </Animated.View>
          </Pressable>
        </Modal>

        <Modal visible={showActions} transparent animationType="fade" onRequestClose={() => setShowActions(false)}>
          <Pressable style={styles.actionsBackdrop} onPress={() => setShowActions(false)}>
            <Pressable style={styles.actionsSheet}>
              <View style={styles.actionsHandle} />
              <Pressable style={styles.actionItem} onPress={addFood}>
                <Text style={[styles.actionText, semiFont]}>Add food</Text>
              </Pressable>
              <Pressable style={styles.actionItem} onPress={() => setShowImageModal(true)}>
                <Text style={[styles.actionText, semiFont]}>View photo</Text>
              </Pressable>
              <Pressable style={[styles.actionItem, styles.actionDanger]} onPress={deleteMeal}>
                <Text style={[styles.actionText, styles.actionDangerText, semiFont]}>Delete meal</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={showImageModal} transparent animationType="fade" onRequestClose={() => setShowImageModal(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowImageModal(false)}>
            <Image source={mealImageSource} style={styles.modalImage} contentFit="contain" />
          </Pressable>
        </Modal>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: background,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: border,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 60,
    gap: 24,
  },
  heroSection: {
    gap: 16,
  },
  heroImage: {
    height: 320,
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: border,
  },
  heroName: {
    fontSize: 32,
    color: text,
    fontWeight: '700',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  heroNameInput: {
    fontSize: 32,
    color: text,
    fontWeight: '700',
    letterSpacing: -0.6,
    textAlign: 'center',
    paddingVertical: 0,
  },
  currentWeightCard: {
    backgroundColor: card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: border,
    padding: 24,
    gap: 12,
  },
  currentWeightLabel: {
    fontSize: 14,
    color: muted,
    letterSpacing: 0.2,
    opacity: 0.8,
  },
  currentWeightValue: {
    fontSize: 48,
    color: text,
    fontWeight: '700',
    letterSpacing: -1,
  },
  progressWrapper: {
    gap: 10,
    marginTop: 8,
  },
  progressBar: {
    height: 10,
    backgroundColor: '#EFF0F3',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: accent,
    borderRadius: 5,
  },
  progressLabel: {
    fontSize: 13,
    color: muted,
    opacity: 0.8,
  },
  metricCard: {
    backgroundColor: card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: border,
    padding: 20,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    color: text,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  macroSummary: {
    flexDirection: 'row',
    gap: 12,
  },
  macroChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F7F8FB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  macroTextStack: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  macroLabel: {
    fontSize: 13,
    color: muted,
    flexShrink: 1,
  },
  macroValue: {
    fontSize: 14,
    color: text,
    fontWeight: '600',
    flexShrink: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  fab: {
    height: 36,
    width: 36,
    borderRadius: 18,
    backgroundColor: '#E8EDF2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activitySelector: {
    gap: 10,
  },
  activityOption: {
    backgroundColor: card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: border,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activityContent: {
    flex: 1,
    gap: 4,
  },
  activityLabel: {
    fontSize: 15,
    color: text,
    fontWeight: '600',
  },
  activityDescription: {
    fontSize: 13,
    color: muted,
    opacity: 0.8,
  },
  foodMacros: {
    fontSize: 13,
    color: muted,
    opacity: 0.8,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 20,
  },
  editCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: card,
    borderRadius: 18,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: border,
  },
  editTitle: {
    fontSize: 18,
    color: text,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    color: muted,
    letterSpacing: 0.2,
  },
  inputField: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: background,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: text,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  pillButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F0F2F7',
  },
  pillPrimary: {
    backgroundColor: accent,
  },
  pillButtonText: {
    fontSize: 15,
    color: text,
    fontWeight: '600',
  },
  pillPrimaryText: {
    color: '#FFFFFF',
  },
  actionsBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  actionsSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 28,
    paddingTop: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  actionsHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D8DBE3',
    marginBottom: 6,
  },
  actionItem: {
    paddingVertical: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F4F6FA',
  },
  actionText: {
    fontSize: 15,
    color: text,
    fontWeight: '600',
  },
  actionDanger: {
    backgroundColor: '#FFF3F3',
  },
  actionDangerText: {
    color: '#D34040',
  },
  modalImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  titleLoaded: {
    fontFamily: 'Inter_700Bold',
  },
  semiLoaded: {
    fontFamily: 'Inter_600SemiBold',
  },
  bodyLoaded: {
    fontFamily: 'Inter_400Regular',
  },
  lightLoaded: {
    fontFamily: 'Inter_300Light',
  },
  caloriesInput: {
    paddingVertical: 0,
  },
  macroInput: {
    paddingVertical: 0,
    minWidth: 0,
  },
});
