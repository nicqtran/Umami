import { GoalsState, subscribeGoals } from '@/state/goals';
import { MealEntry, addMeal, getDaysAgoId, subscribeMeals } from '@/state/meals';
import { subscribeUserProfile, UserProfile } from '@/state/user';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Easing, FlatList, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

type Macro = { label: string; value: string; color: string; current: number; goal: number; percentage: number };
type Meal = { id: string; name: string; time: string; calories: string; macros: string; image: number | { uri: string } };
type DaySummary = { id: string; label: string; calories: number; goal: number; macros: Macro[]; percentage: number };

const background = '#F8F9FB';
const card = '#FFFFFF';
const border = '#E6E8EB';
const text = '#111418';
const muted = '#6A7178';
const accent = '#2C3E50';
const contentGutter = 20;

const macroAccents: Record<'carbs' | 'protein' | 'fat', string> = {
  carbs: '#6AB7A8',
  protein: '#D8A648',
  fat: '#9B7BD1',
};

const formatKcal = (value: number) => value.toLocaleString('en-US');

// Helper to get day label from days ago
const getDayLabel = (daysAgo: number): string => {
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
};

export default function HomeScreen() {
  const { width: screenWidth } = Dimensions.get('window');
  const availableWidth = useMemo(() => screenWidth - contentGutter * 2, [screenWidth]);
  const { user } = useSupabaseAuth();
  const cardWidth = useMemo(() => Math.round(availableWidth * 0.94), [availableWidth]);
  const cardSpacing = 10;
  const itemSize = cardWidth + cardSpacing * 2;
  // Perfect centering: spacer positions first card center at available width center
  const spacerSize = useMemo(
    () => Math.max(Math.round((availableWidth - cardWidth) / 2 - cardSpacing), 0),
    [availableWidth, cardWidth, cardSpacing],
  );

  // Subscribe to goals state for daily calorie goal
  const [goals, setGoals] = useState<GoalsState | null>(null);
  
  useEffect(() => {
    const unsubscribe = subscribeGoals(setGoals);
    return () => unsubscribe();
  }, []);

  // Use calorie goal from goals state, fallback to default
  const dailyCalorieGoal = goals?.dailyCalorieGoal ?? 2100;
  
  // Generate day metadata with ISO date IDs
  const initialDayMeta: Array<{ id: string; label: string }> = useMemo(
    () => [
      { id: getDaysAgoId(0), label: 'Today' },
      { id: getDaysAgoId(1), label: 'Yesterday' },
      { id: getDaysAgoId(2), label: getDayLabel(2) },
      { id: getDaysAgoId(3), label: getDayLabel(3) },
      { id: getDaysAgoId(4), label: getDayLabel(4) },
      { id: getDaysAgoId(5), label: getDayLabel(5) },
      { id: getDaysAgoId(6), label: getDayLabel(6) },
    ],
    [],
  );
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const days = useMemo<DaySummary[]>(() => {
    return initialDayMeta.map((meta) => {
      const dayMeals = meals.filter((meal) => meal.dayId === meta.id);
      const macrosTotal = dayMeals.reduce(
        (sum, meal) => {
          const totals = meal.foods.reduce(
            (acc, food) => ({
              calories: acc.calories + food.calories,
              protein: acc.protein + food.protein,
              carbs: acc.carbs + food.carbs,
              fat: acc.fat + food.fat,
            }),
            { calories: 0, protein: 0, carbs: 0, fat: 0 },
          );
          return {
            calories: sum.calories + totals.calories,
            protein: sum.protein + totals.protein,
            carbs: sum.carbs + totals.carbs,
            fat: sum.fat + totals.fat,
          };
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );
      // Calculate macro goals based on calorie goal and standard distribution
      // Protein: 30% of calories (4 cal/g), Carbs: 40% (4 cal/g), Fat: 30% (9 cal/g)
      const proteinGoal = Math.round((dailyCalorieGoal * 0.30) / 4);
      const carbsGoal = Math.round((dailyCalorieGoal * 0.40) / 4);
      const fatGoal = Math.round((dailyCalorieGoal * 0.30) / 9);

      const macros: Macro[] = [
        {
          label: 'Carbs',
          value: `${Math.round(macrosTotal.carbs)}g`,
          color: macroAccents.carbs,
          current: Math.round(macrosTotal.carbs),
          goal: carbsGoal,
          percentage: Math.min((macrosTotal.carbs / carbsGoal) * 100, 100)
        },
        {
          label: 'Protein',
          value: `${Math.round(macrosTotal.protein)}g`,
          color: macroAccents.protein,
          current: Math.round(macrosTotal.protein),
          goal: proteinGoal,
          percentage: Math.min((macrosTotal.protein / proteinGoal) * 100, 100)
        },
        {
          label: 'Fat',
          value: `${Math.round(macrosTotal.fat)}g`,
          color: macroAccents.fat,
          current: Math.round(macrosTotal.fat),
          goal: fatGoal,
          percentage: Math.min((macrosTotal.fat / fatGoal) * 100, 100)
        },
      ];
      // Use goal from goals state
      const caloriePercentage = Math.min((macrosTotal.calories / dailyCalorieGoal) * 100, 100);
      return {
        id: meta.id,
        label: meta.label,
        calories: Math.round(macrosTotal.calories),
        goal: dailyCalorieGoal,
        macros,
        percentage: caloriePercentage
      };
    });
  }, [initialDayMeta, meals, dailyCalorieGoal]);

  const reversedDays = useMemo(() => [...days].reverse(), [days]);
  const initialIndex = reversedDays.length - 1;
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  const carouselData = useMemo(
    () => [{ id: 'spacer-left', spacer: true }, ...reversedDays, { id: 'spacer-right', spacer: true }],
    [reversedDays],
  );

  // Calculate snap offsets for each day card to be centered
  const snapOffsets = useMemo(() => {
    const offsets: number[] = [];
    for (let i = 0; i < reversedDays.length; i++) {
      // Each card starts at: spacerSize + (cardIndex * itemSize)
      offsets.push(spacerSize + i * itemSize);
    }
    return offsets;
  }, [reversedDays.length, spacerSize, itemSize]);

  const listRef = useRef<FlatList<any>>(null);
  const router = useRouter();
  const scrollX = useRef(new Animated.Value(0)).current;
  const isAnimatingRef = useRef(false);
  const lastActiveIndexRef = useRef(initialIndex);

  // Animation refs for calorie card entrance
  const cardEntranceAnim = useRef(new Animated.Value(0)).current;
  const macroBarAnims = useRef<Record<string, Animated.Value>>({}).current;

  useEffect(() => {
    const unsubscribe = subscribeUserProfile(setUserProfile);
    return () => unsubscribe();
  }, []);

  // Camera action sheet and scanning state
  const [showCameraSheet, setShowCameraSheet] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanningMessage, setScanningMessage] = useState('');
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [isPickerActive, setIsPickerActive] = useState(false);
  const scanPulse = useRef(new Animated.Value(1)).current;
  const scanProgress = useRef(new Animated.Value(0)).current;
  const sheetSlideAnim = useRef(new Animated.Value(0)).current;
  const mealsFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(cardEntranceAnim, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [cardEntranceAnim]);

  // Scanning messages that rotate during analysis
  const scanningMessages = [
    'Analyzing your meal...',
    'Detecting ingredients...',
    'Calculating nutrition...',
    'Identifying food items...',
    'Processing image...',
    'Scanning for nutrients...',
    'Recognizing portions...',
    'Almost there...',
  ];

  // Start scanning animation
  const startScanAnimation = useCallback(() => {
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanPulse, {
          toValue: 1.1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanPulse, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Progress animation
    Animated.timing(scanProgress, {
      toValue: 1,
      duration: 2500,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [scanPulse, scanProgress]);

  // Rotate scanning messages
  useEffect(() => {
    if (!isScanning) return;
    
    let messageIndex = 0;
    setScanningMessage(scanningMessages[0]);
    
    const interval = setInterval(() => {
      messageIndex = (messageIndex + 1) % scanningMessages.length;
      setScanningMessage(scanningMessages[messageIndex]);
    }, 800);

    return () => clearInterval(interval);
  }, [isScanning]);

  // Process the captured image and create meal
  const processImage = useCallback(async (imageUri: string) => {
    setCapturedImageUri(imageUri);
    setIsScanning(true);
    scanProgress.setValue(0);
    startScanAnimation();

    // Simulate AI processing delay (2.5 seconds)
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Get active day from current state
    const currentActiveDay = reversedDays[activeIndex] || reversedDays[reversedDays.length - 1];
    const dayId = currentActiveDay?.id || getDaysAgoId(0);

    // Create the meal - need user to be logged in
    if (!user?.id) {
      setIsScanning(false);
      setCapturedImageUri(null);
      scanPulse.setValue(1);
      scanProgress.setValue(0);
      Alert.alert('Not logged in', 'Please log in to add meals.');
      return;
    }

    const now = new Date();
    const newMealData = {
      dayId,
      name: 'Scanned meal',
      time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      image: { uri: imageUri },
      foods: [],
    };
    const newMeal = await addMeal(user.id, newMealData);

    // Reset scanning state
    setIsScanning(false);
    setCapturedImageUri(null);
    scanPulse.setValue(1);
    scanProgress.setValue(0);

    // Navigate to meal details
    router.push({ pathname: '/meal-details', params: { dayId, mealId: newMeal.id } });
  }, [reversedDays, activeIndex, router, startScanAnimation, scanProgress, scanPulse, user]);

  // Smooth sheet close animation
  const closeSheetWithAnimation = useCallback(() => {
    return new Promise<void>((resolve) => {
      Animated.timing(sheetSlideAnim, {
        toValue: 0,
        duration: 250,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }).start(() => {
        setShowCameraSheet(false);
        resolve();
      });
    });
  }, [sheetSlideAnim]);

  // Handle taking a photo with camera
  const handleTakePhoto = useCallback(async () => {
    if (isPickerActive) return;
    setIsPickerActive(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Smooth close animation
    await closeSheetWithAnimation();

    // Brief delay for modal to fully dismiss
    await new Promise(resolve => setTimeout(resolve, 200));

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        setIsPickerActive(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('Permission needed', 'Allow camera access to snap a meal.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });

      setIsPickerActive(false);

      if (!result.canceled && result.assets?.[0]?.uri) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Smooth transition to loading state
        await new Promise(resolve => setTimeout(resolve, 100));
        await processImage(result.assets[0].uri);
      }
    } catch (err: any) {
      setIsPickerActive(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Camera Error', 'Could not access camera. Please try again.');
    }
  }, [processImage, isPickerActive, closeSheetWithAnimation]);

  // Handle choosing from library
  const handleChooseFromLibrary = useCallback(async () => {
    if (isPickerActive) return;
    setIsPickerActive(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Smooth close animation
    await closeSheetWithAnimation();

    // Brief delay for modal to fully dismiss
    await new Promise(resolve => setTimeout(resolve, 200));

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setIsPickerActive(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('Permission needed', 'Allow photo library access to add a meal.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });

      setIsPickerActive(false);

      if (!result.canceled && result.assets?.[0]?.uri) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Smooth transition to loading state
        await new Promise(resolve => setTimeout(resolve, 100));
        await processImage(result.assets[0].uri);
      }
    } catch (err: any) {
      setIsPickerActive(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Library Error', 'Could not access photo library. Please try again.');
    }
  }, [processImage, isPickerActive, closeSheetWithAnimation]);

  // Open camera action sheet with animation
  const handleSnapMeal = useCallback(() => {
    if (isPickerActive || showCameraSheet) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowCameraSheet(true);
    sheetSlideAnim.setValue(0);
    Animated.spring(sheetSlideAnim, {
      toValue: 1,
      damping: 20,
      mass: 0.8,
      stiffness: 100,
      useNativeDriver: true,
    }).start();
  }, [isPickerActive, showCameraSheet, sheetSlideAnim]);

  // Reset sheet animation when closed
  useEffect(() => {
    if (!showCameraSheet) {
      sheetSlideAnim.setValue(0);
    }
  }, [showCameraSheet, sheetSlideAnim]);

  const getItemLayout = (_: unknown, index: number) => {
    // First item is spacer-left
    if (index === 0) {
      return { length: spacerSize, offset: 0, index };
    }
    // Last item is spacer-right  
    if (index === carouselData.length - 1) {
      return { length: spacerSize, offset: spacerSize + (reversedDays.length) * itemSize, index };
    }
    // Cards in between
    const cardIndex = index - 1;
    return { length: itemSize, offset: spacerSize + cardIndex * itemSize, index };
  };

  useEffect(() => {
    const unsubscribe = subscribeMeals(setMeals);
    return () => unsubscribe();
  }, []);

  // Animate meals list when active day changes
  useEffect(() => {
    mealsFadeAnim.setValue(0);
    Animated.timing(mealsFadeAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeIndex, mealsFadeAnim]);

  const activeDay = reversedDays[activeIndex] || reversedDays[reversedDays.length - 1];

  // Smoothly animate macro fills when the active day changes
  useEffect(() => {
    if (!activeDay) return;

    activeDay.macros.forEach((macro) => {
      if (!macroBarAnims[macro.label]) {
        macroBarAnims[macro.label] = new Animated.Value(0);
      }

      Animated.timing(macroBarAnims[macro.label], {
        toValue: macro.percentage,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });
  }, [activeDay, macroBarAnims]);

  const currentMeals = meals
    .filter((meal) => meal.dayId === activeDay?.id)
    .map((meal) => {
      const totals = meal.foods.reduce(
        (sum, food) => ({
          calories: sum.calories + food.calories,
          protein: sum.protein + food.protein,
          carbs: sum.carbs + food.carbs,
          fat: sum.fat + food.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );
      return {
        id: meal.id,
        name: meal.name,
        time: meal.time,
        calories: `${Math.round(totals.calories)} kcal`,
        macros: `P ${Math.round(totals.protein)}g  •  C ${Math.round(totals.carbs)}g  •  F ${Math.round(totals.fat)}g`,
        image: meal.image,
      };
    });
  const remainingCalories = Math.max((activeDay?.goal || dailyCalorieGoal) - (activeDay?.calories || 0), 0);

  const [fontsLoaded] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const titleFont = fontsLoaded ? styles.titleLoaded : null;
  const semiFont = fontsLoaded ? styles.semiLoaded : null;
  const bodyFont = fontsLoaded ? styles.bodyLoaded : null;
  const lightFont = fontsLoaded ? styles.lightLoaded : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" backgroundColor={background} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.brand, titleFont]}>Umami</Text>
          <Pressable
            style={({ pressed }) => [
              styles.avatar,
              pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/profile');
            }}>
            {userProfile?.avatarUri ? (
              <Image source={{ uri: userProfile.avatarUri }} style={styles.avatarImage} />
            ) : (
              <Text style={[styles.avatarText, semiFont]}>
                {(userProfile?.name || 'U').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryWrapper}>
            <Animated.View
              style={[
                styles.summaryCarouselWrapper,
                {
                  opacity: cardEntranceAnim,
                  transform: [
                    {
                      translateY: cardEntranceAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [12, 0],
                      }),
                    },
                    {
                      scale: cardEntranceAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.98, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <FlatList
                ref={listRef}
                data={carouselData}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate={0.95}
                initialScrollIndex={initialIndex + 1}
                getItemLayout={getItemLayout}
                contentContainerStyle={styles.summaryCarousel}
                bounces={false}
                scrollEventThrottle={16}
                snapToOffsets={snapOffsets}
                snapToAlignment="start"
                removeClippedSubviews={false}
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                  { useNativeDriver: false }
                )}
                onMomentumScrollEnd={(event) => {
                  if (isAnimatingRef.current) return;
                  const offsetX = event.nativeEvent.contentOffset.x;

                  // Find closest snap point
                  let closestIndex = 0;
                  let minDiff = Math.abs(offsetX - snapOffsets[0]);
                  for (let i = 1; i < snapOffsets.length; i++) {
                    const diff = Math.abs(offsetX - snapOffsets[i]);
                    if (diff < minDiff) {
                      minDiff = diff;
                      closestIndex = i;
                    }
                  }

                  if (closestIndex !== lastActiveIndexRef.current) {
                    lastActiveIndexRef.current = closestIndex;
                    setActiveIndex(closestIndex);
                  }
                }}
                renderItem={({ item: day, index }) => {
                  if ('spacer' in day && day.spacer) {
                    return <View style={{ width: spacerSize }} />;
                  }

                  // Adjust index for spacer offset (index 0 is spacer-left)
                  const cardIndex = index - 1;
                  
                  // Calculate animation based on scroll position
                  const cardOffset = spacerSize + cardIndex * itemSize;
                  const inputRange = [
                    cardOffset - itemSize,
                    cardOffset,
                    cardOffset + itemSize,
                  ];

                  const scale = scrollX.interpolate({
                    inputRange,
                    outputRange: [0.92, 1, 0.92],
                    extrapolate: 'clamp',
                  });

                  const opacity = scrollX.interpolate({
                    inputRange,
                    outputRange: [0.5, 1, 0.5],
                    extrapolate: 'clamp',
                  });

                  const translateY = scrollX.interpolate({
                    inputRange,
                    outputRange: [8, 0, 8],
                    extrapolate: 'clamp',
                  });

                  const glowOpacity = scrollX.interpolate({
                    inputRange,
                    outputRange: [0, 0.28, 0],
                    extrapolate: 'clamp',
                  });

                  const daySummary = day as DaySummary;
                  const isActiveCard = daySummary.id === activeDay?.id;

                  return (
                    <Animated.View
                      style={[
                        styles.summaryCard,
                        {
                          width: cardWidth,
                          marginHorizontal: cardSpacing,
                          transform: [{ scale }, { translateY }],
                          opacity,
                        },
                      ]}>
                      <Animated.View pointerEvents="none" style={[styles.cardGlow, { opacity: glowOpacity }]} />
                      <View style={styles.summaryTop}>
                        <Text style={[styles.summaryLabel, semiFont]}>{daySummary.label.toUpperCase()}</Text>
                        <Image
                          source={require('@/assets/images/image-trimmed.png')}
                          style={styles.summaryThumb}
                          contentFit="cover"
                        />
                      </View>
                      <View style={styles.caloriesBlock}>
                        <Text style={[styles.calories, titleFont]}>
                          {formatKcal(daySummary.calories)} / {formatKcal(daySummary.goal)} kcal
                        </Text>
                        <Text style={[styles.caloriesSub, bodyFont]}>
                          Remaining {formatKcal(Math.max(daySummary.goal - daySummary.calories, 0))} kcal
                        </Text>
                      </View>
                      <View style={styles.macrosRow}>
                        {daySummary.macros.map((item: Macro) => (
                          <View key={item.label} style={styles.macroItem}>
                            <View style={styles.macroHeader}>
                              <View style={styles.macroLabelRow}>
                                <View style={[styles.macroDot, { backgroundColor: item.color }]} />
                                <Text style={[styles.macroLabel, bodyFont]}>{item.label}</Text>
                              </View>
                              <Text style={[styles.macroValue, semiFont]}>
                                {item.current}/{item.goal}g
                              </Text>
                            </View>
                            <View style={styles.macroBarBackground}>
                              <Animated.View
                                style={[
                                  styles.macroBarFill,
                                  {
                                    backgroundColor: item.color,
                                    width: isActiveCard
                                      ? macroBarAnims[item.label]?.interpolate({
                                          inputRange: [0, 100],
                                          outputRange: ['0%', '100%'],
                                        }) || '0%'
                                      : `${item.percentage}%`,
                                  },
                                ]}
                              />
                            </View>
                          </View>
                        ))}
                      </View>
                    </Animated.View>
                  );
                }}
              />
            </Animated.View>
            <View style={styles.pagination}>
              {reversedDays.map((day, index) => (
                <View
                  key={day.id}
                  style={[
                    styles.dotIndicator,
                    index === activeIndex && styles.dotIndicatorActive,
                  ]}
                />
              ))}
            </View>
          </View>

          <Animated.View style={[styles.mealsSection, { opacity: mealsFadeAnim }]}>
            <View style={styles.mealsHeader}>
              <Text style={[styles.sectionTitle, semiFont]}>{`${activeDay?.label || 'Today'}'s meals`}</Text>
              <View style={styles.remainingPill}>
                <Text style={styles.remainingText}>{formatKcal(remainingCalories)} kcal left</Text>
              </View>
            </View>
            <View style={styles.mealsList}>
              {currentMeals.map((meal) => (
                <Pressable
                  key={meal.id}
                  style={({ pressed }) => [
                    styles.mealCard,
                    pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({
                      pathname: '/meal-details',
                      params: { dayId: activeDay?.id, mealId: meal.id },
                    });
                  }}>
                  <Image source={meal.image} style={styles.mealThumb} contentFit="cover" />
                  <View style={styles.mealContent}>
                    <Text style={[styles.mealName, semiFont]} numberOfLines={1}>
                      {meal.name}
                    </Text>
                    <View style={styles.mealMeta}>
                      <Text style={[styles.mealMetaText, bodyFont]}>{meal.time}</Text>
                      <View style={styles.dot} />
                      <Text style={[styles.mealMetaText, bodyFont]}>{meal.calories}</Text>
                    </View>
                    <Text style={[styles.mealMacros, lightFont]} numberOfLines={1}>
                      {meal.macros}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        </ScrollView>

        <View style={styles.snapContainer}>
          <Pressable style={({ pressed }) => [styles.snapButton, pressed && styles.snapPressed]} onPress={handleSnapMeal}>
            <MaterialCommunityIcons name="camera-outline" size={20} color="#ffffff" />
            <Text style={[styles.snapLabel, semiFont]}>Snap a meal</Text>
          </Pressable>
        </View>

        {/* Camera Action Sheet Modal */}
        <Modal
          visible={showCameraSheet}
          transparent
          animationType="none"
          onRequestClose={async () => {
            await closeSheetWithAnimation();
          }}
        >
          <Animated.View
            style={[
              styles.sheetBackdrop,
              {
                opacity: sheetSlideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
              }
            ]}
          >
            <Pressable
              style={styles.sheetBackdropTouchable}
              onPress={async () => {
                if (!isPickerActive) {
                  await closeSheetWithAnimation();
                }
              }}
            />
            <Animated.View
              style={[
                styles.sheetContainer,
                {
                  transform: [{
                    translateY: sheetSlideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [400, 0],
                    }),
                  }],
                }
              ]}
            >
              <View style={styles.sheetHandle} />
              <Text style={[styles.sheetTitle, semiFont]}>Add a meal</Text>

              <Pressable
                style={({ pressed }) => [
                  styles.sheetOption,
                  pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
                  isPickerActive && { opacity: 0.5 }
                ]}
                onPress={handleTakePhoto}
                disabled={isPickerActive}
              >
                <View style={styles.sheetIconContainer}>
                  <MaterialCommunityIcons name="camera" size={24} color={accent} />
                </View>
                <View style={styles.sheetOptionContent}>
                  <Text style={[styles.sheetOptionTitle, semiFont]}>Take Photo</Text>
                  <Text style={[styles.sheetOptionSubtitle, bodyFont]}>Use your camera to snap a meal</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={muted} />
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.sheetOption,
                  pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
                  isPickerActive && { opacity: 0.5 }
                ]}
                onPress={handleChooseFromLibrary}
                disabled={isPickerActive}
              >
                <View style={styles.sheetIconContainer}>
                  <MaterialCommunityIcons name="image-multiple" size={24} color={accent} />
                </View>
                <View style={styles.sheetOptionContent}>
                  <Text style={[styles.sheetOptionTitle, semiFont]}>Choose from Library</Text>
                  <Text style={[styles.sheetOptionSubtitle, bodyFont]}>Select a photo from your gallery</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={muted} />
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.sheetCancelButton,
                  pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
                  isPickerActive && { opacity: 0.5 }
                ]}
                onPress={async () => {
                  if (!isPickerActive) {
                    await closeSheetWithAnimation();
                  }
                }}
                disabled={isPickerActive}
              >
                <Text style={[styles.sheetCancelText, semiFont]}>Cancel</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
        </Modal>

        {/* Scanning Overlay Modal */}
        <Modal
          visible={isScanning}
          transparent
          animationType="fade"
          onRequestClose={() => {}}
        >
          <View style={styles.scanningOverlay}>
            <View style={styles.scanningCard}>
              {/* Preview Image */}
              {capturedImageUri && (
                <Animated.View style={[styles.scanningImageContainer, { transform: [{ scale: scanPulse }] }]}>
                  <Image source={{ uri: capturedImageUri }} style={styles.scanningImage} contentFit="cover" />
                  <View style={styles.scanningImageOverlay} />
                </Animated.View>
              )}
              
              {/* Scanning Animation */}
              <View style={styles.scanningContent}>
                <ActivityIndicator size="large" color={accent} style={styles.scanningSpinner} />
                <Text style={[styles.scanningTitle, semiFont]}>Analyzing Your Meal</Text>
                <Text style={[styles.scanningMessage, bodyFont]}>{scanningMessage}</Text>
                
                {/* Progress Bar */}
                <View style={styles.progressBarContainer}>
                  <Animated.View 
                    style={[
                      styles.progressBar, 
                      { 
                        width: scanProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        })
                      }
                    ]} 
                  />
                </View>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: background,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 16,
  },
  brand: {
    fontSize: 22,
    color: text,
    letterSpacing: 0.2,
    fontWeight: '700',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderColor: border,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  avatarText: {
    color: text,
    fontSize: 14,
    fontWeight: '600',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  scroll: {
    paddingHorizontal: contentGutter,
    paddingBottom: 120,
    gap: 28,
  },
  summaryCard: {
    backgroundColor: card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: border,
    padding: 28,
    gap: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  cardGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    backgroundColor: 'rgba(44, 62, 80, 0.08)',
  },
  summaryWrapper: {
    width: '100%',
    alignItems: 'center',
    gap: 14,
  },
  summaryCarouselWrapper: {
    width: '100%',
  },
  summaryCarousel: {
    alignItems: 'center',
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 12,
    letterSpacing: 1,
    color: muted,
    fontWeight: '600',
  },
  summaryThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  caloriesBlock: {
    gap: 6,
    paddingVertical: 4,
  },
  calories: {
    fontSize: 36,
    color: text,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 42,
  },
  caloriesSub: {
    fontSize: 15,
    color: muted,
    marginTop: 2,
    letterSpacing: 0.1,
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingTop: 8,
  },
  macroItem: {
    flex: 1,
    gap: 9,
  },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  macroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  macroLabel: {
    fontSize: 12,
    color: muted,
    fontWeight: '500',
  },
  macroValue: {
    fontSize: 13,
    color: text,
    fontWeight: '600',
  },
  macroBarBackground: {
    height: 10,
    borderRadius: 6,
    backgroundColor: '#EEF1F5',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E3E7ED',
  },
  macroBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'center',
    marginTop: 10,
    paddingVertical: 4,
  },
  dotIndicator: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#D1D4D8',
    opacity: 0.6,
  },
  dotIndicatorActive: {
    backgroundColor: '#111418',
    width: 20,
    borderRadius: 3.5,
    opacity: 1,
  },
  mealsSection: {
    gap: 16,
  },
  mealsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    color: text,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  remainingPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#EAF3FF',
    shadowColor: '#1B4F9C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  remainingText: {
    fontSize: 12.5,
    color: '#1B4F9C',
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  mealsList: {
    gap: 14,
  },
  mealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    backgroundColor: card,
    borderColor: border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
    minHeight: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  mealThumb: {
    width: 70,
    height: 70,
    borderRadius: 16,
    backgroundColor: '#F1F2F5',
  },
  mealContent: {
    flex: 1,
    gap: 7,
    justifyContent: 'center',
  },
  mealName: {
    fontSize: 18,
    color: text,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  mealMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mealMetaText: {
    fontSize: 13.5,
    color: muted,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C0C4C9',
  },
  mealMacros: {
    fontSize: 12.5,
    color: muted,
    letterSpacing: 0.1,
  },
  snapContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: contentGutter,
    paddingBottom: 24,
    paddingTop: 16,
    backgroundColor: 'transparent',
  },
  snapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: accent,
    borderRadius: 18,
    paddingVertical: 18,
    shadowColor: accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  snapPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  snapLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Camera Action Sheet Styles
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetBackdropTouchable: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    color: text,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: background,
    borderRadius: 16,
    marginBottom: 12,
    gap: 16,
  },
  sheetIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(44, 62, 80, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionContent: {
    flex: 1,
    gap: 4,
  },
  sheetOptionTitle: {
    fontSize: 16,
    color: text,
    fontWeight: '600',
  },
  sheetOptionSubtitle: {
    fontSize: 13,
    color: muted,
  },
  sheetCancelButton: {
    backgroundColor: background,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  sheetCancelText: {
    fontSize: 16,
    color: muted,
    fontWeight: '600',
  },

  // Scanning Overlay Styles
  scanningOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  scanningCard: {
    backgroundColor: card,
    borderRadius: 28,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  scanningImageContainer: {
    width: 180,
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  scanningImage: {
    width: '100%',
    height: '100%',
  },
  scanningImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(44, 62, 80, 0.1)',
  },
  scanningContent: {
    alignItems: 'center',
    width: '100%',
  },
  scanningSpinner: {
    marginBottom: 16,
  },
  scanningTitle: {
    fontSize: 20,
    color: text,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  scanningMessage: {
    fontSize: 14,
    color: muted,
    textAlign: 'center',
    marginBottom: 20,
    minHeight: 20,
  },
  progressBarContainer: {
    width: '100%',
    height: 4,
    backgroundColor: border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: accent,
    borderRadius: 2,
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
});
