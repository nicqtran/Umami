import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { refreshAccessStatusState, subscribeAccessStatus } from '@/state/access';
import { subscribeMeals, MealEntry } from '@/state/meals';
import { AccessStatus } from '@/types/access';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

const background = '#f5f6fa';
const card = '#ffffff';
const border = '#e4e6eb';
const accent = '#2C3E50';
const muted = '#6A7178';
const highlight = '#D8A648';

export default function UpgradeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ reason?: string }>();
  const { user } = useSupabaseAuth();
  const [access, setAccess] = useState<AccessStatus | null>(null);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [loadingTrial, setLoadingTrial] = useState(false);

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

  const handleUpgrade = () => {
    Alert.alert('Upgrade to Pro', 'In-app purchase flow goes here. Connect your store receipt validation to activate Pro.');
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
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>UPGRADE</Text>
              <Text style={styles.heroHeadline}>Smarter scans. Premium results.</Text>
              <Text style={styles.heroSub}>{reasonText}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>$6.99</Text>
                <Text style={styles.priceMeta}>/month • cancel anytime</Text>
              </View>
              {!isTrial && (
                <View style={styles.trialPill}>
                  <MaterialCommunityIcons name="clock-outline" size={18} color={accent} />
                  <Text style={styles.trialPillText}>14-day free trial included</Text>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>What you get</Text>
              <View style={styles.benefitRow}>
                <MaterialCommunityIcons name="lightning-bolt" size={20} color={highlight} />
                <View style={styles.benefitCopy}>
                  <Text style={styles.benefitTitle}>Unlimited scans (10/day)</Text>
                  <Text style={styles.benefitText}>No friction, no queue. Trial and Pro get the fastest AI responses.</Text>
                </View>
              </View>
              <View style={styles.benefitRow}>
                <MaterialCommunityIcons name="shield-check" size={20} color={highlight} />
                <View style={styles.benefitCopy}>
                  <Text style={styles.benefitTitle}>Guaranteed access</Text>
                  <Text style={styles.benefitText}>We reserve your spot before hitting the AI so you never waste a scan.</Text>
                </View>
              </View>
            </View>

            <View style={styles.actionsCard}>
              {!trialUnavailable && (
                <Pressable
                  onPress={handleStartTrial}
                  disabled={loadingTrial}
                  style={({ pressed }) => [
                    styles.primaryCta,
                    (pressed || loadingTrial) && styles.primaryCtaPressed,
                  ]}
                >
                  <Text style={styles.primaryCtaLabel}>
                    {loadingTrial ? 'Starting trial…' : trialCtaLabel}
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={handleUpgrade}
                disabled={alreadyOnPro}
                style={({ pressed }) => [
                  styles.upgradeCta,
                  pressed && { opacity: 0.9 },
                  alreadyOnPro && styles.upgradeCtaDisabled,
                ]}
              >
                <Text style={[styles.upgradeCtaLabel, alreadyOnPro && { color: muted }]}>
                  {alreadyOnPro ? 'Already on Pro' : 'Upgrade to Pro'}
                </Text>
              </Pressable>

              <Pressable onPress={handleRestore} style={({ pressed }) => [styles.secondaryCta, pressed && { opacity: 0.7 }]}>
                <Text style={styles.secondaryCtaLabel}>Restore purchases</Text>
              </Pressable>

              <Text style={styles.disclaimer}>
                Subscription is managed by the App Store / Play Store. Trial converts to paid unless canceled at least 24 hours before renewal.
              </Text>
            </View>

            {/* Stats Card - Show after upgrade section for non-Pro */}
            <View style={[styles.card, styles.statsCard]}>
              <Text style={styles.statsTitle}>YOUR ACTIVITY</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{usageStats.totalThisMonth}</Text>
                  <Text style={styles.statLabel}>This month</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{usageStats.totalThisWeek}</Text>
                  <Text style={styles.statLabel}>This week</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{usageStats.totalAllTime}</Text>
                  <Text style={styles.statLabel}>All time</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* Pro users see manage subscription option */}
        {isPro && (
          <View style={styles.actionsCard}>
            <Pressable onPress={handleRestore} style={({ pressed }) => [styles.secondaryCta, pressed && { opacity: 0.7 }]}>
              <Text style={styles.secondaryCtaLabel}>Manage subscription</Text>
            </Pressable>
            <Text style={styles.disclaimer}>
              Your Pro subscription renews {access?.proRenewsAt ? `on ${new Date(access.proRenewsAt).toLocaleDateString()}` : 'automatically'}. Manage in App Store / Play Store settings.
            </Text>
          </View>
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
});
