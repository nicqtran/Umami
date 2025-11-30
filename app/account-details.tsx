import { GoalsState, subscribeGoals, updateGoals } from '@/state/goals';
import { subscribeUserProfile, updateUserProfile, UserProfile } from '@/state/user';
import { Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

// Design tokens - matching app aesthetic
const COLORS = {
  background: '#F8F9FB',
  card: '#FFFFFF',
  text: '#111418',
  textMuted: '#6A7178',
  textLight: '#9CA3AF',
  accent: '#2C3E50',
  accentLight: 'rgba(44, 62, 80, 0.06)',
  border: '#E6E8EB',
  borderLight: '#F0F1F3',
  success: '#6AB7A8',
};

type EditingField = 'name' | 'email' | 'password' | null;

export default function AccountDetailsScreen() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Global user profile state
  const [userProfile, setUserProfile] = useState<UserProfile>({ name: '' });
  const [goals, setGoals] = useState<GoalsState | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [showYearPicker, setShowYearPicker] = useState(false);

  // Subscribe to global user state
  useEffect(() => {
    const unsubscribe = subscribeUserProfile(setUserProfile);
    return () => unsubscribe();
  }, []);

  // Subscribe to goals state
  useEffect(() => {
    const unsubscribe = subscribeGoals(setGoals);
    return () => unsubscribe();
  }, []);

  // Calculate age from date of birth
  const calculateAge = (birthDate: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Format date for display
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Add date of birth';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Handle date selection from calendar
  const handleDaySelect = (dateStr: string) => {
    const selectedDate = new Date(dateStr + 'T12:00:00');
    setTempDate(selectedDate);
  };

  const saveDateOfBirth = (date: Date) => {
    const isoDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const age = calculateAge(date);
    updateUserProfile({ dateOfBirth: isoDate });
    updateGoals({ age }); // Update age in goals state for BMR calculations
    setHasChanges(true);
    setShowDatePicker(false);
  };

  const openDatePicker = () => {
    let dateToUse: Date;
    if (userProfile.dateOfBirth) {
      dateToUse = new Date(userProfile.dateOfBirth);
    } else {
      // Default to 25 years ago if no date set
      dateToUse = new Date();
      dateToUse.setFullYear(dateToUse.getFullYear() - 25);
    }
    setTempDate(dateToUse);
    setCalendarMonth(new Date(dateToUse)); // Start calendar at the DOB month
    setShowDatePicker(true);
  };

  // Generate year options for year picker
  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let year = currentYear; year >= 1920; year--) {
      years.push(year);
    }
    return years;
  };

  // Edit modal state
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [fieldDraft, setFieldDraft] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Animations
  const entrance = useRef(new Animated.Value(0)).current;
  const rowAnims = useRef([...Array(5)].map(() => new Animated.Value(0))).current;
  const saveButtonAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Page entrance animation
    Animated.timing(entrance, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Staggered row animations
    Animated.stagger(
      50,
      rowAnims.map((anim) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    ).start();

    // Save button entrance (delayed)
    Animated.timing(saveButtonAnim, {
      toValue: 1,
      duration: 400,
      delay: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const pageStyle = {
    opacity: entrance,
    transform: [
      {
        translateY: entrance.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  };

  const createRowStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        }),
      },
    ],
  });

  const saveButtonStyle = {
    opacity: saveButtonAnim,
    transform: [
      {
        translateY: saveButtonAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        }),
      },
    ],
  };

  // Font styles
  const titleFont = fontsLoaded ? styles.titleLoaded : null;
  const semiFont = fontsLoaded ? styles.semiLoaded : null;
  const bodyFont = fontsLoaded ? styles.bodyLoaded : null;
  const lightFont = fontsLoaded ? styles.lightLoaded : null;

  // Edit handlers
  const openEditor = (field: EditingField) => {
    setEditingField(field);
    if (field === 'name') setFieldDraft(userProfile.name || '');
    else if (field === 'email') setFieldDraft(userProfile.email || '');
    else setFieldDraft('');
    setConfirmPassword('');
  };

  const saveFieldEdit = () => {
    if (editingField === 'name' && fieldDraft.trim()) {
      updateUserProfile({ name: fieldDraft.trim() });
      setHasChanges(true);
    } else if (editingField === 'email' && fieldDraft.trim()) {
      updateUserProfile({ email: fieldDraft.trim() });
      setHasChanges(true);
    } else if (editingField === 'password' && fieldDraft.trim()) {
      // Password validation and save logic will be implemented with backend
      setHasChanges(true);
    }
    closeEditor();
  };

  const closeEditor = () => {
    setEditingField(null);
    setFieldDraft('');
    setConfirmPassword('');
  };

  const handleSave = () => {
    // Changes are already saved to global state
    // Navigate back
    router.back();
  };

  const getModalTitle = () => {
    switch (editingField) {
      case 'name': return 'Edit Name';
      case 'email': return 'Edit Email';
      case 'password': return 'Change Password';
      default: return '';
    }
  };

  const getModalPlaceholder = () => {
    switch (editingField) {
      case 'name': return 'Enter your name';
      case 'email': return 'Enter your email';
      case 'password': return 'Enter new password';
      default: return '';
    }
  };

  // Editable row component
  const EditableRow = ({
    icon,
    label,
    value,
    onPress,
    animStyle,
    isLast = false,
  }: {
    icon: string;
    label: string;
    value: string;
    onPress: () => void;
    animStyle: any;
    isLast?: boolean;
  }) => (
    <Animated.View style={animStyle}>
      <Pressable style={styles.row} onPress={onPress}>
        <View style={styles.rowLeft}>
          <View style={styles.rowIcon}>
            <MaterialCommunityIcons name={icon as any} size={20} color={COLORS.accent} />
          </View>
          <View style={styles.rowContent}>
            <Text style={[styles.rowLabel, lightFont]}>{label}</Text>
            <Text style={[styles.rowValue, bodyFont]}>{value}</Text>
          </View>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={COLORS.textLight} />
      </Pressable>
      {!isLast && <View style={styles.rowDivider} />}
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View style={[styles.container, pageStyle]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
          </Pressable>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Page Title */}
          <Animated.View style={[styles.titleSection, createRowStyle(rowAnims[0])]}>
            <Text style={[styles.pageTitle, titleFont]}>Account Details</Text>
            <Text style={[styles.pageSubtitle, lightFont]}>
              Manage your personal information
            </Text>
          </Animated.View>

          {/* Account Fields Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, bodyFont]}>Personal Information</Text>
            
            <View style={styles.fieldGroup}>
              <EditableRow
                icon="account-outline"
                label="Profile Name"
                value={userProfile.name || 'Add name'}
                onPress={() => openEditor('name')}
                animStyle={createRowStyle(rowAnims[1])}
              />
              
              <EditableRow
                icon="email-outline"
                label="Account Email"
                value={userProfile.email || 'Add email'}
                onPress={() => openEditor('email')}
                animStyle={createRowStyle(rowAnims[2])}
              />
              
              <EditableRow
                icon="calendar-outline"
                label="Date of Birth"
                value={formatDate(userProfile.dateOfBirth)}
                onPress={openDatePicker}
                animStyle={createRowStyle(rowAnims[3])}
              />
              
              <EditableRow
                icon="lock-outline"
                label="Password"
                value="••••••••"
                onPress={() => openEditor('password')}
                animStyle={createRowStyle(rowAnims[4])}
                isLast
              />
            </View>
          </View>
        </ScrollView>

        {/* Premium Date of Birth Calendar Modal */}
        <Modal
          visible={showDatePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShowDatePicker(false)}>
            <Pressable style={styles.datePickerCard} onPress={() => {}}>
              <View style={styles.datePickerHeader}>
                <Pressable onPress={() => setShowDatePicker(false)}>
                  <Text style={[styles.datePickerCancel, bodyFont]}>Cancel</Text>
                </Pressable>
                <Text style={[styles.datePickerTitle, semiFont]}>Date of Birth</Text>
                <Pressable onPress={() => saveDateOfBirth(tempDate)}>
                  <Text style={[styles.datePickerDone, semiFont]}>Done</Text>
                </Pressable>
              </View>

              {/* Year Picker Toggle */}
              <Pressable 
                style={styles.yearPickerToggle}
                onPress={() => setShowYearPicker(!showYearPicker)}
              >
                <MaterialCommunityIcons 
                  name="calendar-clock" 
                  size={18} 
                  color={COLORS.accent} 
                />
                <Text style={[styles.yearPickerToggleText, bodyFont]}>
                  {calendarMonth.getFullYear()}
                </Text>
                <MaterialCommunityIcons 
                  name={showYearPicker ? "chevron-up" : "chevron-down"} 
                  size={18} 
                  color={COLORS.accent} 
                />
              </Pressable>

              {/* Year Picker Grid */}
              {showYearPicker && (
                <ScrollView 
                  style={styles.yearPickerContainer}
                  showsVerticalScrollIndicator={true}
                  contentContainerStyle={styles.yearPickerContent}
                >
                  <View style={styles.yearGrid}>
                    {generateYearOptions().map((year) => {
                      const isSelected = calendarMonth.getFullYear() === year;
                      return (
                        <Pressable
                          key={year}
                          style={[styles.yearOption, isSelected && styles.yearOptionSelected]}
                          onPress={() => {
                            const newMonth = new Date(calendarMonth);
                            newMonth.setFullYear(year);
                            setCalendarMonth(newMonth);
                            setShowYearPicker(false);
                          }}
                        >
                          <Text style={[
                            styles.yearOptionText,
                            isSelected && styles.yearOptionTextSelected
                          ]}>
                            {year}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              )}

              {/* Mini Calendar */}
              {!showYearPicker && (
                <View style={styles.miniCalendarContainer}>
                  {/* Calendar Header */}
                  <View style={styles.miniCalendarHeader}>
                    <Pressable 
                      style={styles.miniCalendarNav}
                      onPress={() => {
                        const newMonth = new Date(calendarMonth);
                        newMonth.setMonth(newMonth.getMonth() - 1);
                        if (newMonth >= new Date(1920, 0, 1)) {
                          setCalendarMonth(newMonth);
                        }
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
                      const selectedDateStr = tempDate.toISOString().split('T')[0];
                      
                      const days: React.ReactNode[] = [];
                      
                      // Empty cells for days before first of month
                      for (let i = 0; i < firstDay; i++) {
                        days.push(<View key={`empty-${i}`} style={styles.miniDayCell} />);
                      }
                      
                      // Days of the month
                      for (let day = 1; day <= daysInMonth; day++) {
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const isSelected = dateStr === selectedDateStr;
                        const todayStr = today.toISOString().split('T')[0];
                        const isToday = dateStr === todayStr;
                        const isFuture = new Date(dateStr) > today;
                        const isTooOld = new Date(dateStr) < new Date(1920, 0, 1);
                        const isDisabled = isFuture || isTooOld;
                        
                        days.push(
                          <Pressable
                            key={day}
                            style={styles.miniDayCell}
                            onPress={() => !isDisabled && handleDaySelect(dateStr)}
                            disabled={isDisabled}
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
                                isDisabled && styles.miniDayTextDisabled,
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
                    <MaterialCommunityIcons name="cake-variant" size={16} color={COLORS.accent} />
                    <Text style={styles.selectedDateText}>
                      {tempDate.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'long', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </Text>
                  </View>

                  {/* Age Display */}
                  <View style={styles.ageDisplay}>
                    <Text style={styles.ageText}>
                      Age: {calculateAge(tempDate)} years old
                    </Text>
                  </View>
                </View>
              )}
            </Pressable>
          </Pressable>
        </Modal>

        {/* Save Button */}
        <Animated.View style={[styles.saveButtonContainer, saveButtonStyle]}>
          <Pressable 
            style={[styles.saveButton, hasChanges && styles.saveButtonActive]}
            onPress={handleSave}
          >
            <Text style={[styles.saveButtonText, semiFont, hasChanges && styles.saveButtonTextActive]}>
              Save Changes
            </Text>
          </Pressable>
        </Animated.View>

        {/* Edit Modal */}
        <Modal
          visible={editingField !== null}
          transparent
          animationType="fade"
          onRequestClose={closeEditor}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <Pressable style={styles.modalBackdrop} onPress={closeEditor}>
              <Pressable style={styles.modalCard} onPress={() => {}}>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, semiFont]}>{getModalTitle()}</Text>
                  <Pressable style={styles.modalClose} onPress={closeEditor}>
                    <MaterialCommunityIcons name="close" size={20} color={COLORS.textMuted} />
                  </Pressable>
                </View>

                {/* Modal Content */}
                <View style={styles.modalContent}>
                  <View style={styles.inputWrapper}>
                    <Text style={[styles.inputLabel, bodyFont]}>
                      {editingField === 'password' ? 'New Password' : getModalTitle().replace('Edit ', '')}
                    </Text>
                    <TextInput
                      style={[styles.inputField, bodyFont]}
                      value={fieldDraft}
                      onChangeText={setFieldDraft}
                      placeholder={getModalPlaceholder()}
                      placeholderTextColor={COLORS.textLight}
                      autoFocus
                      secureTextEntry={editingField === 'password'}
                      keyboardType={editingField === 'email' ? 'email-address' : 'default'}
                      autoCapitalize={editingField === 'name' ? 'words' : 'none'}
                      autoCorrect={false}
                    />
                  </View>

                  {editingField === 'password' && (
                    <View style={styles.inputWrapper}>
                      <Text style={[styles.inputLabel, bodyFont]}>Confirm Password</Text>
                      <TextInput
                        style={[styles.inputField, bodyFont]}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Confirm new password"
                        placeholderTextColor={COLORS.textLight}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  )}
                </View>

                {/* Modal Actions */}
                <View style={styles.modalActions}>
                  <Pressable style={styles.modalCancelButton} onPress={closeEditor}>
                    <Text style={[styles.modalCancelText, bodyFont]}>Cancel</Text>
                  </Pressable>
                  <Pressable style={styles.modalSaveButton} onPress={saveFieldEdit}>
                    <Text style={[styles.modalSaveText, semiFont]}>Save</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  
  // Header
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
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
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
  },

  // Title Section
  titleSection: {
    paddingTop: 4,
    paddingBottom: 28,
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 16,
    color: COLORS.textMuted,
    lineHeight: 22,
  },

  // Section
  section: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 16,
    marginLeft: 4,
  },
  fieldGroup: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
    gap: 4,
  },
  rowLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
    letterSpacing: 0.1,
  },
  rowValue: {
    fontSize: 17,
    color: COLORS.text,
    fontWeight: '500',
  },
  rowDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginLeft: 80,
  },

  // Save Button
  saveButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 34,
    paddingTop: 16,
    backgroundColor: COLORS.background,
  },
  saveButton: {
    backgroundColor: COLORS.borderLight,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonActive: {
    backgroundColor: COLORS.accent,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  saveButtonTextActive: {
    color: '#FFFFFF',
  },

  // Modal
  modalContainer: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 8,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 20,
  },
  inputWrapper: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginLeft: 4,
  },
  inputField: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: COLORS.borderLight,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Date Picker Styles
  datePickerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    overflow: 'hidden',
    width: '90%',
    maxWidth: 360,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  datePickerTitle: {
    fontSize: 17,
    color: COLORS.text,
    fontWeight: '600',
  },
  datePickerCancel: {
    fontSize: 16,
    color: COLORS.textMuted,
  },
  datePickerDone: {
    fontSize: 16,
    color: COLORS.accent,
    fontWeight: '600',
  },
  datePicker: {
    height: 200,
    backgroundColor: COLORS.card,
  },

  // Year Picker Styles
  yearPickerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: COLORS.accentLight,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 12,
  },
  yearPickerToggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.accent,
  },
  yearPickerContainer: {
    maxHeight: 280,
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  yearPickerContent: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  yearOption: {
    width: '23%',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  yearOptionSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  yearOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  yearOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Mini Calendar Styles
  miniCalendarContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  miniCalendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
    marginBottom: 4,
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
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  selectedDateText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.accent,
  },
  ageDisplay: {
    alignItems: 'center',
    marginTop: 8,
  },
  ageText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },

  // Font styles
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
