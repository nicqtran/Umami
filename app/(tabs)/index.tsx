import { GoalsState, subscribeGoals } from '@/state/goals';
import { MealEntry, addMeal, getDaysAgoId, subscribeMeals } from '@/state/meals';
import { Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Easing, FlatList, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

type Macro = { label: string; value: string; color: string };
type Meal = { id: string; name: string; time: string; calories: string; macros: string; image: number | { uri: string } };
type DaySummary = { id: string; label: string; calories: number; goal: number; macros: Macro[] };

const background = '#F8F9FB';
const card = '#FFFFFF';
const border = '#E6E8EB';
const text = '#111418';
const muted = '#6A7178';
const accent = '#2C3E50';

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
  const { width } = Dimensions.get('window');
  const cardWidth = useMemo(() => width * 0.86, [width]);
  const cardSpacing = 10;
  const itemSize = cardWidth + cardSpacing * 2;
  const spacerSize = useMemo(() => Math.max(0, width / 2 - (cardWidth / 2 + cardSpacing)), [width, cardWidth, cardSpacing]);

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
      const macros: Macro[] = [
        { label: 'Carbs', value: `${Math.round(macrosTotal.carbs)}g`, color: macroAccents.carbs },
        { label: 'Protein', value: `${Math.round(macrosTotal.protein)}g`, color: macroAccents.protein },
        { label: 'Fat', value: `${Math.round(macrosTotal.fat)}g`, color: macroAccents.fat },
      ];
      // Use goal from goals state
      return { id: meta.id, label: meta.label, calories: Math.round(macrosTotal.calories), goal: dailyCalorieGoal, macros };
    });
  }, [initialDayMeta, meals, dailyCalorieGoal]);

  const reversedDays = useMemo(() => [...days].reverse(), [days]);
  const initialIndex = reversedDays.length - 1;
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  const carouselData = useMemo(
    () => [{ id: 'spacer-left', spacer: true }, ...reversedDays, { id: 'spacer-right', spacer: true }],
    [reversedDays],
  );

  const snapOffsets = useMemo(() => {
    let offset = 0;
    const offsets: number[] = [];
    carouselData.forEach((item) => {
      offsets.push(offset);
      offset += item.spacer ? spacerSize : itemSize;
    });
    return offsets;
  }, [carouselData, spacerSize, itemSize]);

  const daySnapOffsets = useMemo(() => snapOffsets.slice(1, snapOffsets.length - 1), [snapOffsets]);

  const listRef = useRef<FlatList<any>>(null);
  const router = useRouter();
  const scrollXRef = useRef(0);
  const isScrollingRef = useRef(false);

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

    // Create the meal
    const newMealId = `${Date.now()}`;
    const now = new Date();
    const newMeal: MealEntry = {
      id: newMealId,
      dayId,
      name: 'Scanned meal',
      time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      image: { uri: imageUri },
      foods: [],
    };
    addMeal(newMeal);

    // Reset scanning state
    setIsScanning(false);
    setCapturedImageUri(null);
    scanPulse.setValue(1);
    scanProgress.setValue(0);

    // Navigate to meal details
    router.push({ pathname: '/meal-details', params: { dayId, mealId: newMealId } });
  }, [reversedDays, activeIndex, router, startScanAnimation, scanProgress, scanPulse]);

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
    const item = carouselData[index];
    const length = item?.spacer ? spacerSize : itemSize;
    const offset = snapOffsets[index] ?? 0;
    return { length, offset, index };
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
            <Text style={[styles.avatarText, semiFont]}>U</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryWrapper}>
            <FlatList
              ref={listRef}
              data={carouselData}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              disableIntervalMomentum={true}
              initialScrollIndex={initialIndex + 1}
              getItemLayout={getItemLayout}
              contentContainerStyle={styles.summaryCarousel}
              bounces={false}
              scrollEventThrottle={16}
              onScrollBeginDrag={() => {
                isScrollingRef.current = true;
              }}
              onScroll={(event) => {
                scrollXRef.current = event.nativeEvent.contentOffset.x;
              }}
              onScrollEndDrag={(event) => {
                const offsetX = event.nativeEvent.contentOffset.x;
                const velocity = event.nativeEvent.velocity?.x || 0;

                // Find closest snap point
                let targetIndex = daySnapOffsets.reduce(
                  (closest, offset, idx) => {
                    const currentDiff = Math.abs(offsetX - offset);
                    const closestDiff = Math.abs(offsetX - daySnapOffsets[closest]);
                    return currentDiff < closestDiff ? idx : closest;
                  },
                  0,
                );

                // Adjust for velocity - if fast swipe, go to next/prev
                if (Math.abs(velocity) > 0.5) {
                  if (velocity < 0 && targetIndex < daySnapOffsets.length - 1) {
                    targetIndex = targetIndex + 1;
                  } else if (velocity > 0 && targetIndex > 0) {
                    targetIndex = targetIndex - 1;
                  }
                }

                const targetOffset = daySnapOffsets[targetIndex] ?? 0;
                listRef.current?.scrollToOffset({ offset: targetOffset, animated: true });
                setActiveIndex(targetIndex);
              }}
              onMomentumScrollEnd={(event) => {
                const offsetX = event.nativeEvent.contentOffset.x;

                // Find closest snap point
                const closestIndex = daySnapOffsets.reduce(
                  (closest, offset, idx) => {
                    const currentDiff = Math.abs(offsetX - offset);
                    const closestDiff = Math.abs(offsetX - daySnapOffsets[closest]);
                    return currentDiff < closestDiff ? idx : closest;
                  },
                  0,
                );

                const targetOffset = daySnapOffsets[closestIndex] ?? 0;

                // Only force snap if we're off by more than 1 pixel
                if (Math.abs(offsetX - targetOffset) > 1) {
                  listRef.current?.scrollToOffset({ offset: targetOffset, animated: false });
                }

                setActiveIndex(closestIndex);
                isScrollingRef.current = false;
              }}
              renderItem={({ item: day }) => {
                if (day.spacer) {
                  return <View style={{ width: spacerSize }} />;
                }
                return (
                  <View
                    style={[
                      styles.summaryCard,
                      { width: cardWidth, marginHorizontal: cardSpacing },
                    ]}>
                    <View style={styles.summaryTop}>
                      <Text style={[styles.summaryLabel, semiFont]}>{day.label.toUpperCase()}</Text>
                      <Image
                        source={require('@/assets/images/image-trimmed.png')}
                        style={styles.summaryThumb}
                        contentFit="cover"
                      />
                    </View>
                    <View style={styles.caloriesBlock}>
                    <Text style={[styles.calories, titleFont]}>
                      {formatKcal(day.calories)} / {formatKcal(day.goal)} kcal
                    </Text>
                    <Text style={[styles.caloriesSub, bodyFont]}>
                      Remaining {formatKcal(Math.max(day.goal - day.calories, 0))} kcal
                    </Text>
                    </View>
                    <View style={styles.macrosRow}>
                      {day.macros.map((item) => (
                        <View key={item.label} style={styles.macroItem}>
                          <View style={[styles.macroDot, { backgroundColor: item.color }]} />
                          <Text style={[styles.macroLabel, bodyFont]}>{item.label}</Text>
                          <Text style={[styles.macroValue, semiFont]}>{item.value}</Text>
                          <View style={styles.macroBarBackground}>
                            <View style={[styles.macroBarFill, { backgroundColor: item.color }]} />
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              }}
            />
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
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    gap: 28,
  },
  summaryCard: {
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: border,
    padding: 24,
    gap: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  summaryWrapper: {
    alignItems: 'center',
    gap: 14,
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  summaryCarousel: {
    paddingHorizontal: 0,
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
    fontSize: 32,
    color: text,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  caloriesSub: {
    fontSize: 14,
    color: muted,
    marginTop: 2,
    letterSpacing: 0.1,
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    paddingTop: 6,
  },
  macroItem: {
    flex: 1,
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
  },
  macroValue: {
    fontSize: 14,
    color: text,
    fontWeight: '600',
  },
  macroBarBackground: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EFF0F3',
    overflow: 'hidden',
  },
  macroBarFill: {
    width: '62%',
    height: '100%',
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
    gap: 16,
    backgroundColor: card,
    borderColor: border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    minHeight: 110,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  mealThumb: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#F1F2F5',
  },
  mealContent: {
    flex: 1,
    gap: 7,
    justifyContent: 'center',
  },
  mealName: {
    fontSize: 17,
    color: text,
    fontWeight: '600',
    letterSpacing: -0.2,
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
    paddingHorizontal: 20,
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
