import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { refreshAccessStatusState, subscribeAccessStatus } from '@/state/access';
import { subscribeMeals, MealEntry } from '@/state/meals';
import { AccessStatus } from '@/types/access';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type PricingPlan = 'monthly' | 'yearly';

const background = '#f5f6fa';
const card = '#ffffff';
const border = '#e4e6eb';
const accent = '#2C3E50';
const navy = '#1A2F4A';
const navyLight = '#243B55';
const muted = '#6A7178';
const highlight = '#D8A648';
const gold = '#D8A648';
const goldLight = '#E8C57A';
const goldDark = '#B8860B';

export default function UpgradeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ reason?: string }>();
  const { user } = useSupabaseAuth();
  const [access, setAccess] = useState<AccessStatus | null>(null);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [loadingTrial, setLoadingTrial] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan>('yearly');

  useEffect(() => {
    const unsubscribe = subscribeAccessStatus(setAccess);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeMeals(setMeals);
    return () => unsubscribe();
  }, []);

  const isPro = access?.state?.startsWith('PRO');
  const isTrial = access?.state?.startsWith('TRIAL') && access?.state !== 'TRIAL_EXPIRED';

  // Calculate usage stats from meals
  const usageStats = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const mealsThisMonth = meals.filter((meal) => {
      const [year, month] = meal.dayId.split('-').map(Number);
      return year === thisYear && month === thisMonth + 1;
    });

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const mealsThisWeek = meals.filter((meal) => {
      const mealDate = new Date(meal.dayId);
      return mealDate >= weekAgo;
    });

    const daysInMonth = now.getDate();
    const avgPerDay = daysInMonth > 0 ? (mealsThisMonth.length / daysInMonth).toFixed(1) : '0';

    return {
      totalThisMonth: mealsThisMonth.length,
      totalThisWeek: mealsThisWeek.length,
      avgPerDay,
      totalAllTime: meals.length,
    };
  }, [meals]);

  const reasonText = useMemo(() => {
    if (params?.reason === 'limit') return "You hit today's free limit. Upgrade to keep scanning with priority AI.";
    if (params?.reason === 'expired') return 'Your trial ended. Stay on Pro for unlimited scans and fastest results.';
    return 'Pro gives you the fastest, most accurate scans with priority AI and premium nutrition detail.';
  }, [params?.reason]);

  const trialCtaLabel = useMemo(() => {
    if (access?.state?.startsWith('PRO')) return "You're on Pro";
    if (access?.state?.startsWith('TRIAL')) return 'Trial active';
    return 'Start 14-day free trial';
  }, [access]);

  const trialUnavailable = useMemo(() => {
    if (access?.state?.startsWith('PRO')) return true;
    if (access?.state?.startsWith('TRIAL')) return true;
    if (access?.state === 'TRIAL_EXPIRED') return true;
    if (access?.canStartTrial === false) return true;
    return false;
  }, [access]);

  const handleStartTrial = async () => {
    if (!user) {
      Alert.alert('Create an account', 'You need an account to start your free trial.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign up', onPress: () => router.push('/signup') },
      ]);
      return;
    }

    if (access?.state?.startsWith('PRO') || access?.state?.startsWith('TRIAL')) {
      return;
    }

    try {
      setLoadingTrial(true);
      const status = await refreshAccessStatusState('start_trial');
      if (status?.state?.startsWith('TRIAL')) {
        Alert.alert('Trial started', 'Enjoy Pro for the next 14 days. Cancel anytime in subscriptions.');
        router.replace('/(tabs)');
        return;
      }
      if (status?.reason === 'trial_already_used') {
        Alert.alert('Trial already used', "You've already redeemed your free trial on this account.");
        return;
      }
      Alert.alert('Unable to start trial', 'Please try again in a moment.');
    } catch (err: any) {
      Alert.alert('Unable to start trial', err?.message || 'Please try again in a moment.');
    } finally {
      setLoadingTrial(false);
    }
  };

  const handleUpgrade = (plan: PricingPlan = selectedPlan) => {
    const priceText = plan === 'monthly' ? '$6.99/month' : '$59.99/year';
    Alert.alert('Upgrade to Pro', `You selected the ${plan} plan (${priceText}). In-app purchase flow goes here. Connect your store receipt validation to activate Pro.`);
  };

  const handleRestore = () => {
    Alert.alert('Restore purchases', 'Receipt validation is handled server-side. Please try again after the billing integration is configured.');
  };

  const alreadyOnPro = access?.state?.startsWith('PRO');

  // Bar color based on status
  const barColor = isPro ? highlight : isTrial ? '#6AB7A8' : '#9CA3AF';
  const usedPercent = Math.min(((access?.usedToday ?? 0) / (access?.dailyLimit ?? 1)) * 100, 100);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" backgroundColor={background} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.close, pressed && { opacity: 0.7 }]}>
            <MaterialCommunityIcons name="chevron-left" size={22} color={accent} />
          </Pressable>
          <Text style={styles.title}>Umami Pro</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Status Badge */}
        <View style={styles.statusBadgeContainer}>
          <View style={[
            styles.statusBadge,
            isPro && styles.statusBadgePro,
            isTrial && styles.statusBadgeTrial,
          ]}>
            <MaterialCommunityIcons
              name={isPro ? 'crown' : isTrial ? 'clock-outline' : 'account'}
              size={18}
              color={isPro ? highlight : isTrial ? accent : muted}
            />
            <Text style={[
              styles.statusBadgeText,
              isPro && styles.statusBadgeTextPro,
            ]}>
              {isPro ? 'Pro Member' : isTrial ? `Trial • ${access?.trialDaysLeft ?? 0} days left` : 'Free Plan'}
            </Text>
          </View>
        </View>

        {/* Daily Scans Card - Always show at top */}
        <View style={[styles.card, isPro && styles.cardPro]}>
          <View style={styles.scansHeader}>
            <MaterialCommunityIcons name="camera" size={22} color={isPro ? highlight : accent} />
            <Text style={styles.scansTitle}>Daily Scans</Text>
          </View>
          <View style={styles.scansProgress}>
            <View style={[styles.scansBarBg, isPro && styles.scansBarBgPro]}>
              <View
                style={[
                  styles.scansBarFill,
                  { width: `${usedPercent}%`, backgroundColor: barColor }
                ]}
              />
            </View>
            <View style={styles.scansNumbers}>
              <Text style={[styles.scansRemaining, isPro && { color: highlight }]}>
                {access?.remainingToday ?? 0}
              </Text>
              <Text style={styles.scansTotal}>
                of {access?.dailyLimit ?? 0} scans remaining
              </Text>
            </View>
          </View>
          <Text style={styles.scansReset}>Resets at midnight</Text>
        </View>

        {/* Stats Card - Show for Pro users at top, others after upgrade section */}
        {isPro && (
          <View style={[styles.card, styles.statsCard]}>
            <Text style={styles.statsTitle}>YOUR ACTIVITY</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: highlight }]}>{usageStats.totalThisMonth}</Text>
                <Text style={styles.statLabel}>This month</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: highlight }]}>{usageStats.totalThisWeek}</Text>
                <Text style={styles.statLabel}>This week</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: highlight }]}>{usageStats.avgPerDay}</Text>
                <Text style={styles.statLabel}>Avg/day</Text>
              </View>
            </View>
          </View>
        )}

        {/* Upgrade Section - Only show for non-Pro */}
        {!isPro && (
          <>
            {/* Premium Hero Card */}
            <LinearGradient
              colors={[navy, navyLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.premiumHero}
            >
              <View style={styles.premiumHeroContent}>
                <View style={styles.crownBadge}>
                  <MaterialCommunityIcons name="crown" size={24} color={gold} />
                </View>
                <Text style={styles.premiumHeroLabel}>UMAMI PRO</Text>
                <Text style={styles.premiumHeroHeadline}>Unlock Your Full{'\n'}Nutrition Journey</Text>
                <Text style={styles.premiumHeroSub}>{reasonText}</Text>
                <View style={styles.premiumDivider} />
                <View style={styles.premiumQuickStats}>
                  <View style={styles.premiumQuickStat}>
                    <Text style={styles.premiumQuickStatValue}>10</Text>
                    <Text style={styles.premiumQuickStatLabel}>Daily Scans</Text>
                  </View>
                  <View style={styles.premiumQuickStatDivider} />
                  <View style={styles.premiumQuickStat}>
                    <Text style={styles.premiumQuickStatValue}>AI</Text>
                    <Text style={styles.premiumQuickStatLabel}>Priority Access</Text>
                  </View>
                  <View style={styles.premiumQuickStatDivider} />
                  <View style={styles.premiumQuickStat}>
                    <Text style={styles.premiumQuickStatValue}>24/7</Text>
                    <Text style={styles.premiumQuickStatLabel}>Unlimited Use</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>

            {/* Feature Cards */}
            <View style={styles.featuresSection}>
              <Text style={styles.featuresSectionTitle}>Everything You Get with Pro</Text>

              <View style={styles.featureCard}>
                <View style={styles.featureIconContainer}>
                  <MaterialCommunityIcons name="lightning-bolt" size={24} color={gold} />
                </View>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>10 Daily Scans</Text>
                  <Text style={styles.featureDescription}>
                    5x more scans than free. Analyze every meal, snack, and ingredient without limits.
                  </Text>
                </View>
              </View>

              <View style={styles.featureCard}>
                <View style={styles.featureIconContainer}>
                  <MaterialCommunityIcons name="rocket-launch" size={24} color={gold} />
                </View>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Priority AI Processing</Text>
                  <Text style={styles.featureDescription}>
                    Skip the queue with dedicated AI capacity. Get instant, accurate nutrition data in seconds.
                  </Text>
                </View>
              </View>

              <View style={styles.featureCard}>
                <View style={styles.featureIconContainer}>
                  <MaterialCommunityIcons name="chart-timeline-variant" size={24} color={gold} />
                </View>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Detailed Macro Breakdown</Text>
                  <Text style={styles.featureDescription}>
                    Full nutritional analysis including proteins, carbs, fats, fiber, and micronutrients.
                  </Text>
                </View>
              </View>

              <View style={styles.featureCard}>
                <View style={styles.featureIconContainer}>
                  <MaterialCommunityIcons name="shield-check" size={24} color={gold} />
                </View>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Guaranteed Accuracy</Text>
                  <Text style={styles.featureDescription}>
                    We reserve your AI slot before scanning so you never lose a scan to server limits.
                  </Text>
                </View>
              </View>

              <View style={styles.featureCard}>
                <View style={styles.featureIconContainer}>
                  <MaterialCommunityIcons name="history" size={24} color={gold} />
                </View>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Complete Meal History</Text>
                  <Text style={styles.featureDescription}>
                    Track your nutrition journey over time with full access to your scanning history.
                  </Text>
                </View>
              </View>
            </View>

            {/* Pricing Plans - Highlighted for free/trial */}
            <View style={styles.pricingContainer}>
              <Text style={styles.pricingTitle}>Choose Your Plan</Text>

              {/* Yearly Plan */}
              <Pressable
                onPress={() => setSelectedPlan('yearly')}
                style={({ pressed }) => [
                  styles.pricingOption,
                  selectedPlan === 'yearly' && styles.pricingOptionSelected,
                  pressed && { opacity: 0.95 },
                ]}
              >
                <View style={styles.pricingBadge}>
                  <Text style={styles.pricingBadgeText}>BEST VALUE</Text>
                </View>
                <View style={styles.pricingRadio}>
                  <View style={[
                    styles.radioOuter,
                    selectedPlan === 'yearly' && styles.radioOuterSelected,
                  ]}>
                    {selectedPlan === 'yearly' && <View style={styles.radioInner} />}
                  </View>
                </View>
                <View style={styles.pricingDetails}>
                  <Text style={styles.pricingPlanName}>Yearly</Text>
                  <Text style={styles.pricingPlanSub}>Save 29% • Just $5/month</Text>
                </View>
                <View style={styles.pricingPriceContainer}>
                  <Text style={styles.pricingPrice}>$59.99</Text>
                  <Text style={styles.pricingPeriod}>/year</Text>
                </View>
              </Pressable>

              {/* Monthly Plan */}
              <Pressable
                onPress={() => setSelectedPlan('monthly')}
                style={({ pressed }) => [
                  styles.pricingOption,
                  selectedPlan === 'monthly' && styles.pricingOptionSelected,
                  pressed && { opacity: 0.95 },
                ]}
              >
                <View style={styles.pricingRadio}>
                  <View style={[
                    styles.radioOuter,
                    selectedPlan === 'monthly' && styles.radioOuterSelected,
                  ]}>
                    {selectedPlan === 'monthly' && <View style={styles.radioInner} />}
                  </View>
                </View>
                <View style={styles.pricingDetails}>
                  <Text style={styles.pricingPlanName}>Monthly</Text>
                  <Text style={styles.pricingPlanSub}>Flexible • Cancel anytime</Text>
                </View>
                <View style={styles.pricingPriceContainer}>
                  <Text style={styles.pricingPrice}>$6.99</Text>
                  <Text style={styles.pricingPeriod}>/month</Text>
                </View>
              </Pressable>

              {!isTrial && (
                <View style={styles.trialBanner}>
                  <View style={styles.trialBannerIcon}>
                    <MaterialCommunityIcons name="gift-outline" size={20} color={gold} />
                  </View>
                  <View style={styles.trialBannerContent}>
                    <Text style={styles.trialBannerTitle}>14-Day Free Trial</Text>
                    <Text style={styles.trialBannerSub}>Try all Pro features risk-free</Text>
                  </View>
                </View>
              )}
            </View>

            {/* CTA Buttons - Prominent for free/trial */}
            <View style={styles.actionsCardHighlight}>
              {!trialUnavailable && (
                <Pressable
                  onPress={handleStartTrial}
                  disabled={loadingTrial}
                  style={({ pressed }) => [
                    styles.primaryCtaGold,
                    (pressed || loadingTrial) && styles.primaryCtaPressed,
                  ]}
                >
                  <MaterialCommunityIcons name="crown" size={20} color="#fff" />
                  <Text style={styles.primaryCtaLabelHighlight}>
                    {loadingTrial ? 'Starting trial…' : trialCtaLabel}
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => handleUpgrade()}
                disabled={alreadyOnPro}
                style={({ pressed }) => [
                  styles.upgradeCtaNavy,
                  pressed && { opacity: 0.9 },
                  alreadyOnPro && styles.upgradeCtaDisabled,
                ]}
              >
                <Text style={[styles.upgradeCtaLabelHighlight, alreadyOnPro && { color: muted }]}>
                  {alreadyOnPro ? 'Already on Pro' : `Subscribe Now ${selectedPlan === 'yearly' ? '($59.99/yr)' : '($6.99/mo)'}`}
                </Text>
              </Pressable>

              <Pressable onPress={handleRestore} style={({ pressed }) => [styles.restoreCta, pressed && { opacity: 0.7 }]}>
                <Text style={styles.restoreCtaLabel}>Restore purchases</Text>
              </Pressable>

              <Text style={styles.disclaimer}>
                Cancel anytime. Subscription auto-renews unless cancelled 24 hours before period ends. Managed via App Store / Play Store.
              </Text>
            </View>
          </>
        )}

        {/* Pro Member Experience */}
        {isPro && (
          <>
            {/* Pro Benefits Unlocked */}
            <View style={styles.proBenefitsCard}>
              <View style={styles.proBenefitsHeader}>
                <MaterialCommunityIcons name="check-decagram" size={20} color={gold} />
                <Text style={styles.proBenefitsTitle}>Your Pro Benefits</Text>
              </View>

              <View style={styles.proBenefitItem}>
                <View style={styles.proBenefitIcon}>
                  <MaterialCommunityIcons name="lightning-bolt" size={18} color={gold} />
                </View>
                <Text style={styles.proBenefitText}>10 daily scans</Text>
                <MaterialCommunityIcons name="check" size={18} color="#4CAF50" />
              </View>

              <View style={styles.proBenefitItem}>
                <View style={styles.proBenefitIcon}>
                  <MaterialCommunityIcons name="rocket-launch" size={18} color={gold} />
                </View>
                <Text style={styles.proBenefitText}>Priority AI processing</Text>
                <MaterialCommunityIcons name="check" size={18} color="#4CAF50" />
              </View>

              <View style={styles.proBenefitItem}>
                <View style={styles.proBenefitIcon}>
                  <MaterialCommunityIcons name="chart-timeline-variant" size={18} color={gold} />
                </View>
                <Text style={styles.proBenefitText}>Detailed macro breakdown</Text>
                <MaterialCommunityIcons name="check" size={18} color="#4CAF50" />
              </View>

              <View style={styles.proBenefitItem}>
                <View style={styles.proBenefitIcon}>
                  <MaterialCommunityIcons name="history" size={18} color={gold} />
                </View>
                <Text style={styles.proBenefitText}>Complete meal history</Text>
                <MaterialCommunityIcons name="check" size={18} color="#4CAF50" />
              </View>
            </View>

            {/* Subscription Management */}
            <View style={styles.proManageCard}>
              <Text style={styles.proManageTitle}>Subscription</Text>
              <View style={styles.proManagePlanRow}>
                <View style={styles.proManagePlanInfo}>
                  <Text style={styles.proManagePlanName}>Umami Pro</Text>
                  <Text style={styles.proManagePlanPrice}>$6.99/mo or $59.99/yr</Text>
                </View>
                <View style={styles.proManageActiveBadge}>
                  <Text style={styles.proManageActiveText}>Active</Text>
                </View>
              </View>
              <Pressable
                onPress={handleRestore}
                style={({ pressed }) => [styles.proManageButton, pressed && { opacity: 0.8 }]}
              >
                <MaterialCommunityIcons name="cog-outline" size={18} color={accent} />
                <Text style={styles.proManageButtonText}>Manage Subscription</Text>
              </Pressable>
              <Text style={styles.proManageDisclaimer}>
                Manage billing in App Store / Play Store settings
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: background,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: accent,
  },
  statusBadgeContainer: {
    alignItems: 'center',
    marginVertical: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F5F6F8',
    borderRadius: 20,
    gap: 8,
  },
  statusBadgePro: {
    backgroundColor: '#FDF8EE',
    borderWidth: 1,
    borderColor: '#E8D5B5',
  },
  statusBadgeTrial: {
    backgroundColor: '#F0F4F8',
    borderWidth: 1,
    borderColor: '#D8DEE6',
  },
  statusBadgeText: {
    fontSize: 14,
    color: muted,
    fontWeight: '600',
  },
  statusBadgeTextPro: {
    color: '#B8860B',
    fontWeight: '700',
  },
  card: {
    backgroundColor: card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: border,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardPro: {
    borderColor: '#E8D5B5',
    backgroundColor: '#FFFCF7',
  },
  scansHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scansTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: accent,
  },
  scansProgress: {
    gap: 10,
  },
  scansBarBg: {
    height: 10,
    backgroundColor: '#EEF1F5',
    borderRadius: 5,
    overflow: 'hidden',
  },
  scansBarBgPro: {
    backgroundColor: '#F5EFE6',
  },
  scansBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  scansNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  scansRemaining: {
    fontSize: 36,
    fontWeight: '700',
    color: accent,
  },
  scansTotal: {
    fontSize: 14,
    color: muted,
  },
  scansReset: {
    fontSize: 12,
    color: muted,
  },
  statsCard: {
    backgroundColor: '#F8F9FB',
    borderColor: '#E6E8EB',
  },
  statsTitle: {
    fontSize: 12,
    color: muted,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: accent,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: muted,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: border,
  },
  heroCard: {
    backgroundColor: card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: border,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  heroLabel: {
    color: highlight,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
  },
  heroHeadline: {
    fontSize: 24,
    fontWeight: '700',
    color: accent,
    marginTop: 2,
  },
  heroSub: {
    color: muted,
    fontSize: 14,
    lineHeight: 20,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginTop: 8,
  },
  price: {
    fontSize: 28,
    fontWeight: '700',
    color: accent,
  },
  priceMeta: {
    color: muted,
    fontSize: 14,
  },
  trialPill: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f4ede1',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trialPillText: {
    color: accent,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: accent,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  benefitCopy: {
    flex: 1,
    gap: 4,
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: accent,
  },
  benefitText: {
    fontSize: 14,
    color: muted,
    lineHeight: 20,
  },
  actionsCard: {
    backgroundColor: card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: border,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  primaryCta: {
    backgroundColor: accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryCtaPressed: {
    opacity: 0.9,
  },
  primaryCtaLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  upgradeCta: {
    backgroundColor: '#182C43',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e3853',
  },
  upgradeCtaDisabled: {
    backgroundColor: '#e0e6ef',
    borderColor: '#d5dbe4',
  },
  upgradeCtaLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryCta: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: '#f9fafc',
  },
  secondaryCtaLabel: {
    color: accent,
    fontWeight: '600',
    fontSize: 15,
  },
  disclaimer: {
    color: muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  // Pricing container styles
  pricingContainer: {
    backgroundColor: card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 2,
    borderColor: highlight,
    gap: 12,
    shadowColor: highlight,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  pricingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: accent,
    textAlign: 'center',
    marginBottom: 4,
  },
  pricingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: border,
    backgroundColor: '#FAFBFC',
    gap: 12,
    position: 'relative',
  },
  pricingOptionSelected: {
    borderColor: highlight,
    backgroundColor: '#FDF8EE',
  },
  pricingBadge: {
    position: 'absolute',
    top: -10,
    right: 12,
    backgroundColor: highlight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pricingBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pricingRadio: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: highlight,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: highlight,
  },
  pricingDetails: {
    flex: 1,
  },
  pricingPlanName: {
    fontSize: 16,
    fontWeight: '600',
    color: accent,
  },
  pricingPlanSub: {
    fontSize: 12,
    color: muted,
    marginTop: 2,
  },
  pricingPriceContainer: {
    alignItems: 'flex-end',
  },
  pricingPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: accent,
  },
  pricingPeriod: {
    fontSize: 12,
    color: muted,
  },
  // Highlighted action card for free/trial
  actionsCardHighlight: {
    backgroundColor: card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 2,
    borderColor: highlight,
    gap: 12,
    shadowColor: highlight,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryCtaHighlight: {
    backgroundColor: highlight,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  primaryCtaLabelHighlight: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 17,
  },
  upgradeCtaHighlight: {
    backgroundColor: accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  upgradeCtaLabelHighlight: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  // Subtle pricing for Pro users
  proPlansCard: {
    backgroundColor: '#F8F9FB',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E6E8EB',
    gap: 10,
  },
  proPlansTitle: {
    fontSize: 12,
    color: muted,
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  proPlansRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  proPlanItem: {
    alignItems: 'center',
    flex: 1,
  },
  proPlanPrice: {
    fontSize: 18,
    fontWeight: '600',
    color: muted,
  },
  proPlanPeriod: {
    fontSize: 12,
    color: muted,
    marginTop: 2,
  },
  proPlanSaving: {
    fontSize: 10,
    color: highlight,
    fontWeight: '600',
    marginTop: 4,
  },
  proPlanDivider: {
    width: 1,
    height: 36,
    backgroundColor: border,
  },
  // Premium Hero Styles
  premiumHero: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: navy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  premiumHeroContent: {
    padding: 24,
    alignItems: 'center',
  },
  crownBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(216, 166, 72, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(216, 166, 72, 0.3)',
  },
  premiumHeroLabel: {
    color: gold,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
  },
  premiumHeroHeadline: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 8,
  },
  premiumHeroSub: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  premiumDivider: {
    width: 60,
    height: 2,
    backgroundColor: 'rgba(216, 166, 72, 0.4)',
    borderRadius: 1,
    marginVertical: 18,
  },
  premiumQuickStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumQuickStat: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  premiumQuickStatValue: {
    color: gold,
    fontSize: 22,
    fontWeight: '700',
  },
  premiumQuickStatLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  premiumQuickStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  // Feature Cards Section
  featuresSection: {
    gap: 12,
  },
  featuresSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: accent,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: card,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FDF8EE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F0E6D3',
  },
  featureContent: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: accent,
  },
  featureDescription: {
    fontSize: 13,
    color: muted,
    lineHeight: 19,
  },
  // Trial Banner
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: navy,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  trialBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(216, 166, 72, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trialBannerContent: {
    flex: 1,
  },
  trialBannerTitle: {
    color: gold,
    fontSize: 15,
    fontWeight: '700',
  },
  trialBannerSub: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  // Gold CTA Button
  primaryCtaGold: {
    backgroundColor: gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    shadowColor: gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  // Navy CTA Button
  upgradeCtaNavy: {
    backgroundColor: navy,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  // Restore CTA
  restoreCta: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  restoreCtaLabel: {
    color: muted,
    fontSize: 14,
    fontWeight: '500',
  },
  // Pro Member Styles
  proHero: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  proHeroContent: {
    padding: 24,
    alignItems: 'center',
  },
  proHeroBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(216, 166, 72, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 2,
    borderColor: 'rgba(216, 166, 72, 0.3)',
  },
  proHeroTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
  },
  proHeroSubtitle: {
    color: gold,
    fontSize: 15,
    fontWeight: '500',
  },
  proHeroDivider: {
    width: 50,
    height: 2,
    backgroundColor: 'rgba(216, 166, 72, 0.3)',
    borderRadius: 1,
    marginVertical: 16,
  },
  proHeroRenewal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proHeroRenewalText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
  },
  // Pro Benefits Card
  proBenefitsCard: {
    backgroundColor: card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8D5B5',
    gap: 12,
    shadowColor: gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  proBenefitsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  proBenefitsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: accent,
  },
  proBenefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: '#FDFBF7',
    borderRadius: 10,
  },
  proBenefitIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FDF8EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBenefitText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: accent,
  },
  // Pro Stats Card
  proStatsCard: {
    backgroundColor: '#FFFCF7',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8D5B5',
    gap: 14,
  },
  proStatsTitle: {
    fontSize: 12,
    color: goldDark,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  proStatsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  proStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  proStatValue: {
    fontSize: 28,
    fontWeight: '700',
    color: navy,
    marginBottom: 4,
  },
  proStatLabel: {
    fontSize: 12,
    color: muted,
  },
  proStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E8D5B5',
  },
  // Pro Management Card
  proManageCard: {
    backgroundColor: card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: border,
    gap: 12,
  },
  proManageTitle: {
    fontSize: 12,
    color: muted,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  proManagePlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  proManagePlanInfo: {
    gap: 2,
  },
  proManagePlanName: {
    fontSize: 16,
    fontWeight: '600',
    color: accent,
  },
  proManagePlanPrice: {
    fontSize: 13,
    color: muted,
  },
  proManageActiveBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  proManageActiveText: {
    color: '#2E7D32',
    fontSize: 13,
    fontWeight: '600',
  },
  proManageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F5F6F8',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: border,
  },
  proManageButtonText: {
    color: accent,
    fontSize: 15,
    fontWeight: '600',
  },
  proManageDisclaimer: {
    color: muted,
    fontSize: 12,
    textAlign: 'center',
  },
});
