import { useFonts, Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { SafeAreaView, ScrollView, StyleSheet, Text, View, Pressable, Dimensions, FlatList, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { subscribeMeals, MealEntry, addMeal } from '@/state/meals';

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

export default function HomeScreen() {
  const { width } = Dimensions.get('window');
  const cardWidth = useMemo(() => width * 0.86, [width]);
  const cardSpacing = 10;
  const itemSize = cardWidth + cardSpacing * 2;
  const spacerSize = useMemo(() => Math.max(0, width / 2 - (cardWidth / 2 + cardSpacing)), [width, cardWidth, cardSpacing]);

  const placeholderGoal = 2100;
  const initialDayMeta: Array<{ id: string; label: string }> = useMemo(
    () => [
      { id: 'today', label: 'Today' },
      { id: 'yesterday', label: 'Yesterday' },
      { id: 'mon', label: 'Mon' },
      { id: 'sun', label: 'Sun' },
      { id: 'sat', label: 'Sat' },
      { id: 'fri', label: 'Fri' },
      { id: 'thu', label: 'Thu' },
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
      return { id: meta.id, label: meta.label, calories: Math.round(macrosTotal.calories), goal: placeholderGoal, macros };
    });
  }, [initialDayMeta, meals]);

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

  const handleSnapMeal = useCallback(async () => {
    try {
      const cameraAvailable = await ImagePicker.isAvailableAsync();
      if (cameraAvailable) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });
        if (result.canceled) return;
        const asset = result.assets?.[0];
        if (!asset?.uri) return;
        const newMealId = `${Date.now()}`;
        const now = new Date();
        const newMeal: MealEntry = {
          id: newMealId,
          dayId: 'today',
          name: 'New meal',
          time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          image: { uri: asset.uri },
          foods: [],
        };
        addMeal(newMeal);
        router.push({ pathname: '/meal-details', params: { dayId: 'today', mealId: newMealId } });
        return;
      }

      // Fallback for simulators: allow selecting from library so flow still works
      const libPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!libPermission.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to add a meal.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      const newMealId = `${Date.now()}`;
      const now = new Date();
      const newMeal: MealEntry = {
        id: newMealId,
        dayId: 'today',
        name: 'New meal',
        time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        image: { uri: asset.uri },
        foods: [],
      };
      addMeal(newMeal);
      router.push({ pathname: '/meal-details', params: { dayId: 'today', mealId: newMealId } });
    } catch (err: any) {
      Alert.alert('Camera unavailable', 'Camera is not available on this device. Please use a real device or pick a photo.');
    }
  }, [router]);

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
  const remainingCalories = Math.max((activeDay?.goal || placeholderGoal) - (activeDay?.calories || 0), 0);

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
          <Pressable style={styles.avatar} onPress={() => router.push('/profile')}>
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
              snapToInterval={itemSize}
              snapToAlignment="center"
              snapToOffsets={snapOffsets}
              decelerationRate="fast"
              pagingEnabled
              disableIntervalMomentum
              initialScrollIndex={initialIndex + 1}
              getItemLayout={getItemLayout}
              contentContainerStyle={styles.summaryCarousel}
              onMomentumScrollEnd={(event) => {
                const offsetX = event.nativeEvent.contentOffset.x;
                const closestIndex = daySnapOffsets.reduce(
                  (closest, offset, idx) => {
                    const currentDiff = Math.abs(offsetX - offset);
                    const closestDiff = Math.abs(offsetX - daySnapOffsets[closest]);
                    return currentDiff < closestDiff ? idx : closest;
                  },
                  0,
                );
                const targetOffset = daySnapOffsets[closestIndex] ?? 0;
                if (Math.abs(offsetX - targetOffset) > 0.5) {
                  listRef.current?.scrollToOffset({ offset: targetOffset, animated: false });
                }
                setActiveIndex(closestIndex);
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
              scrollEventThrottle={16}
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

          <View style={styles.mealsSection}>
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
                  style={styles.mealCard}
                  onPress={() =>
                    router.push({
                      pathname: '/meal-details',
                      params: { dayId: activeDay?.id, mealId: meal.id },
                    })
                  }>
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
          </View>
        </ScrollView>

        <View style={styles.snapContainer}>
          <Pressable style={({ pressed }) => [styles.snapButton, pressed && styles.snapPressed]} onPress={handleSnapMeal}>
            <MaterialCommunityIcons name="camera-outline" size={20} color="#ffffff" />
            <Text style={[styles.snapLabel, semiFont]}>Snap a meal</Text>
          </Pressable>
        </View>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  brand: {
    fontSize: 22,
    color: text,
    letterSpacing: 0.2,
    fontWeight: '700',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderColor: border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  avatarText: {
    color: text,
    fontSize: 14,
    fontWeight: '600',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    gap: 16,
  },
  summaryCard: {
    backgroundColor: card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: border,
    padding: 20,
    gap: 12,
  },
  summaryWrapper: {
    alignItems: 'center',
    gap: 10,
    marginHorizontal: -16,
    paddingHorizontal: 16,
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
    gap: 4,
  },
  calories: {
    fontSize: 30,
    color: text,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  caloriesSub: {
    fontSize: 14,
    color: muted,
    marginTop: 2,
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  macroItem: {
    flex: 1,
    gap: 4,
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
    gap: 6,
    alignSelf: 'center',
    marginTop: 8,
  },
  dotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C9CCD1',
  },
  dotIndicatorActive: {
    backgroundColor: '#111418',
  },
  mealsSection: {
    gap: 10,
  },
  mealsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    color: text,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  remainingPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#EAF3FF',
  },
  remainingText: {
    fontSize: 12.5,
    color: '#1B4F9C',
    fontWeight: '600',
  },
  mealsList: {
    gap: 12,
  },
  mealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: card,
    borderColor: border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    minHeight: 110,
  },
  mealThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F1F2F5',
  },
  mealContent: {
    flex: 1,
    gap: 6,
    justifyContent: 'center',
  },
  mealName: {
    fontSize: 17,
    color: text,
    fontWeight: '600',
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
    paddingHorizontal: 16,
    paddingBottom: 18,
    paddingTop: 10,
    backgroundColor: 'transparent',
  },
  snapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: accent,
    borderRadius: 16,
    paddingVertical: 16,
  },
  snapPressed: {
    opacity: 0.9,
  },
  snapLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
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
