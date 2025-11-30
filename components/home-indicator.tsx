import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface HomeIndicatorProps {
  isActive?: boolean;
}

export function HomeIndicator({ isActive = false }: HomeIndicatorProps) {
  const insets = useSafeAreaInsets();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (isActive) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1.2,
          useNativeDriver: true,
          friction: 8,
          tension: 100,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.6,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            friction: 8,
            tension: 100,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.3,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  }, [isActive, scaleAnim, opacityAnim]);

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom - 10, 8),
        },
      ]}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          styles.pill,
          {
            opacity: opacityAnim,
            transform: [{ scaleX: scaleAnim }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pill: {
    width: 134,
    height: 5,
    borderRadius: 100,
    backgroundColor: '#1C1C1E',
  },
});
