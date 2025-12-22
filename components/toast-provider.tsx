import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Animated, StyleSheet, Text, Pressable, View, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

type ToastType = 'success' | 'error' | 'info' | 'undo';

type ToastConfig = {
  message: string;
  type?: ToastType;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
};

type ToastContextType = {
  showToast: (config: ToastConfig) => void;
  hideToast: () => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const COLORS = {
  success: '#22C55E',
  error: '#EF4444',
  info: '#3B82F6',
  undo: '#2C3E50',
};

const ICONS = {
  success: 'check-circle',
  error: 'alert-circle',
  info: 'information',
  undo: 'undo-variant',
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastConfig | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<NodeJS.Timeout>();

  const hideToast = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsVisible(false);
      setToast(null);
    });
  }, [translateY, opacity]);

  const showToast = useCallback((config: ToastConfig) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Reset animations
    translateY.setValue(100);
    opacity.setValue(0);
    progress.setValue(0);

    setToast(config);
    setIsVisible(true);

    // Animate in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Progress bar animation
    const duration = config.duration || (config.action ? 5000 : 3000);
    Animated.timing(progress, {
      toValue: 1,
      duration: duration,
      useNativeDriver: false,
    }).start();

    // Auto-hide after duration
    timeoutRef.current = setTimeout(() => {
      hideToast();
    }, duration);
  }, [translateY, opacity, progress, hideToast]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleActionPress = () => {
    if (toast?.action) {
      toast.action.onPress();
      hideToast();
    }
  };

  const type = toast?.type || 'info';
  const color = COLORS[type];
  const icon = ICONS[type];

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {isVisible && toast && (
        <Animated.View
          style={[
            styles.container,
            {
              bottom: insets.bottom + 16,
              transform: [{ translateY }],
              opacity,
            },
          ]}
        >
          <View style={[styles.toast, { borderLeftColor: color }]}>
            {/* Icon */}
            <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
              <MaterialCommunityIcons name={icon as any} size={20} color={color} />
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text style={styles.message} numberOfLines={2}>
                {toast.message}
              </Text>
            </View>

            {/* Action Button */}
            {toast.action && (
              <Pressable style={styles.actionButton} onPress={handleActionPress}>
                <Text style={[styles.actionText, { color }]}>{toast.action.label}</Text>
              </Pressable>
            )}

            {/* Close Button */}
            <Pressable style={styles.closeButton} onPress={hideToast}>
              <MaterialCommunityIcons name="close" size={18} color="#9CA3AF" />
            </Pressable>
          </View>

          {/* Progress Bar */}
          <Animated.View
            style={[
              styles.progressBar,
              {
                backgroundColor: color,
                width: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['100%', '0%'],
                }),
              },
            ]}
          />
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 10,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderLeftWidth: 4,
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111418',
    lineHeight: 20,
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(44, 62, 80, 0.08)',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 4,
    height: 3,
    borderRadius: 2,
  },
});



