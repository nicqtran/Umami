import { useState, useRef, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  Dimensions,
  Animated,
  Easing,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFonts, Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const background = '#F8F9FB';
const card = '#FFFFFF';
const border = '#E6E8EB';
const text = '#111418';
const muted = '#6A7178';
const accent = '#2C3E50';

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
type WeightUnit = 'kg' | 'lbs';

const activityLevels: Array<{ key: ActivityLevel; label: string; description: string }> = [
  { key: 'sedentary', label: 'Sedentary', description: 'Little to no exercise' },
  { key: 'light', label: 'Light', description: '1-3 days/week' },
  { key: 'moderate', label: 'Moderate', description: '3-5 days/week' },
  { key: 'active', label: 'Active', description: '6-7 days/week' },
  { key: 'veryActive', label: 'Very Active', description: 'Intense daily training' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [startWeight, setStartWeight] = useState(82.5);
  const [currentWeight, setCurrentWeight] = useState(78.3);
  const [goalWeight, setGoalWeight] = useState(75.0);
  const [goalTimeline, setGoalTimeline] = useState('12');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');

  const [editingWeight, setEditingWeight] = useState<'start' | 'current' | 'goal' | null>(null);
  const [weightDraft, setWeightDraft] = useState('');

  const kgToLbs = (kg: number) => kg * 2.20462;
  const lbsToKg = (lbs: number) => lbs / 2.20462;

  const formatWeight = (weight: number) => {
    if (weightUnit === 'lbs') {
      return kgToLbs(weight).toFixed(1);
    }
    return weight.toFixed(1);
  };

  const toggleWeightUnit = () => {
    setWeightUnit(weightUnit === 'kg' ? 'lbs' : 'kg');
  };

  const progressPercent = Math.round(((startWeight - currentWeight) / (startWeight - goalWeight)) * 100);
  const clampedProgress = Math.max(0, Math.min(100, progressPercent));

  const entrance = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef([...Array(6)].map(() => new Animated.Value(0))).current;

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

  const titleFont = fontsLoaded ? styles.titleLoaded : null;
  const semiFont = fontsLoaded ? styles.semiLoaded : null;
  const bodyFont = fontsLoaded ? styles.bodyLoaded : null;
  const lightFont = fontsLoaded ? styles.lightLoaded : null;

  const openWeightEditor = (type: 'start' | 'current' | 'goal', currentValue: number) => {
    setEditingWeight(type);
    setWeightDraft(currentValue.toString());
  };

  const saveWeightEdit = () => {
    const parsed = parseFloat(weightDraft);
    if (Number.isFinite(parsed) && parsed > 0) {
      if (editingWeight === 'start') setStartWeight(parsed);
      if (editingWeight === 'current') setCurrentWeight(parsed);
      if (editingWeight === 'goal') setGoalWeight(parsed);
    }
    setEditingWeight(null);
    setWeightDraft('');
  };

  const cancelWeightEdit = () => {
    setEditingWeight(null);
    setWeightDraft('');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View style={[styles.container, pageStyle]}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.heroSection, createCardStyle(cardAnims[0])]}>
            <Text style={[styles.heroName, titleFont]}>Nicolas Tran</Text>
            <Text style={[styles.heroSubtitle, lightFont]}>Personal dashboard for your wellness & goals</Text>
          </Animated.View>

          <Animated.View style={createCardStyle(cardAnims[1])}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, bodyFont]}>Weight Journey</Text>
              <Pressable style={styles.unitToggle} onPress={toggleWeightUnit}>
                <Text style={[styles.unitText, bodyFont, weightUnit === 'kg' && styles.unitTextActive]}>kg</Text>
                <Text style={[styles.unitSeparator, bodyFont]}>/</Text>
                <Text style={[styles.unitText, bodyFont, weightUnit === 'lbs' && styles.unitTextActive]}>lbs</Text>
              </Pressable>
            </View>
            <View style={styles.weightJourneyGrid}>
              <Pressable style={styles.metricCard} onPress={() => openWeightEditor('start', startWeight)}>
                <Text style={[styles.metricLabel, bodyFont]}>Starting</Text>
                <Text style={[styles.metricValue, titleFont, weightUnit === 'lbs' && styles.metricValueSmall]}>{formatWeight(startWeight)} {weightUnit}</Text>
              </Pressable>

              <Pressable style={styles.metricCard} onPress={() => openWeightEditor('goal', goalWeight)}>
                <Text style={[styles.metricLabel, bodyFont]}>Goal</Text>
                <Text style={[styles.metricValue, titleFont, weightUnit === 'lbs' && styles.metricValueSmall]}>{formatWeight(goalWeight)} {weightUnit}</Text>
              </Pressable>
            </View>
          </Animated.View>

          <Animated.View style={createCardStyle(cardAnims[2])}>
            <Pressable style={styles.currentWeightCard} onPress={() => openWeightEditor('current', currentWeight)}>
              <Text style={[styles.currentWeightLabel, bodyFont]}>Current Weight</Text>
              <Text style={[styles.currentWeightValue, titleFont, weightUnit === 'lbs' && styles.currentWeightValueSmall]}>{formatWeight(currentWeight)} {weightUnit}</Text>
              <View style={styles.progressWrapper}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${clampedProgress}%` }]} />
                </View>
                <Text style={[styles.progressLabel, bodyFont]}>{clampedProgress}% to goal</Text>
              </View>
            </Pressable>
          </Animated.View>

          <Animated.View style={[styles.metricCard, createCardStyle(cardAnims[3])]}>
            <Text style={[styles.metricLabel, bodyFont]}>Goal Timeline</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.timelineInput, titleFont]}
                value={goalTimeline}
                onChangeText={setGoalTimeline}
                keyboardType="numeric"
                placeholder="12"
                placeholderTextColor={muted}
              />
              <Text style={[styles.timelineUnit, bodyFont]}>weeks</Text>
            </View>
          </Animated.View>

          <Animated.View style={createCardStyle(cardAnims[4])}>
            <Text style={[styles.sectionTitle, semiFont]}>Activity Level</Text>
            <View style={styles.activitySelector}>
              {activityLevels.map((level) => (
                <Pressable
                  key={level.key}
                  style={[styles.activityOption, activityLevel === level.key && styles.activityOptionActive]}
                  onPress={() => setActivityLevel(level.key)}>
                  <View style={styles.activityContent}>
                    <Text style={[styles.activityLabel, semiFont, activityLevel === level.key && styles.activityLabelActive]}>
                      {level.label}
                    </Text>
                    <Text style={[styles.activityDescription, lightFont, activityLevel === level.key && styles.activityDescriptionActive]}>
                      {level.description}
                    </Text>
                  </View>
                  {activityLevel === level.key && (
                    <View style={styles.activityCheck}>
                      <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </Animated.View>
        </ScrollView>

        <Modal visible={editingWeight !== null} transparent animationType="fade" onRequestClose={cancelWeightEdit}>
          <Pressable style={styles.modalBackdrop} onPress={cancelWeightEdit}>
            <View style={styles.editCard}>
              <Text style={[styles.editTitle, semiFont]}>
                Edit {editingWeight === 'start' ? 'Starting' : editingWeight === 'current' ? 'Current' : 'Goal'} Weight
              </Text>
              <View style={styles.inputGroup}>
                <TextInput
                  style={[styles.inputField, bodyFont]}
                  value={weightDraft}
                  onChangeText={setWeightDraft}
                  keyboardType="decimal-pad"
                  placeholder="75.0"
                  placeholderTextColor={muted}
                  autoFocus
                />
              </View>
              <View style={styles.editActions}>
                <Pressable style={styles.pillButton} onPress={cancelWeightEdit}>
                  <Text style={[styles.pillButtonText, bodyFont]}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.pillButton, styles.pillPrimary]} onPress={saveWeightEdit}>
                  <Text style={[styles.pillButtonText, styles.pillPrimaryText, bodyFont]}>Save</Text>
                </Pressable>
              </View>
            </View>
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
    gap: 32,
  },
  heroSection: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 20,
    paddingBottom: 12,
  },
  heroName: {
    fontSize: 36,
    color: text,
    fontWeight: '700',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 15,
    color: muted,
    opacity: 0.75,
    textAlign: 'center',
    maxWidth: width * 0.75,
    lineHeight: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 14,
    color: muted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  unitToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: background,
  },
  unitText: {
    fontSize: 13,
    color: muted,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  unitTextActive: {
    color: accent,
    fontWeight: '600',
  },
  unitSeparator: {
    fontSize: 13,
    color: border,
    fontWeight: '400',
  },
  weightJourneyGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: border,
    padding: 20,
    gap: 10,
  },
  metricLabel: {
    fontSize: 13,
    color: muted,
    letterSpacing: 0.2,
    opacity: 0.8,
  },
  metricValue: {
    fontSize: 32,
    color: text,
    fontWeight: '700',
    letterSpacing: -0.6,
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  timelineInput: {
    fontSize: 36,
    color: text,
    fontWeight: '700',
    letterSpacing: -0.6,
    minWidth: 60,
    padding: 0,
  },
  timelineUnit: {
    fontSize: 18,
    color: muted,
    fontWeight: '400',
  },
  sectionTitle: {
    fontSize: 16,
    color: text,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 12,
  },
  activitySelector: {
    gap: 10,
  },
  activityOption: {
    backgroundColor: card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: border,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activityOptionActive: {
    backgroundColor: '#E8EDF2',
    borderColor: accent,
  },
  activityContent: {
    flex: 1,
    gap: 4,
  },
  activityLabel: {
    fontSize: 16,
    color: text,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  activityLabelActive: {
    color: text,
  },
  activityDescription: {
    fontSize: 13,
    color: muted,
    opacity: 0.8,
  },
  activityDescriptionActive: {
    color: muted,
    opacity: 0.8,
  },
  activityCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: accent,
    alignItems: 'center',
    justifyContent: 'center',
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
  metricValueSmall: {
    fontSize: 26,
  },
  currentWeightValueSmall: {
    fontSize: 38,
  },
});