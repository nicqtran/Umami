import { IconSymbol } from '@/components/ui/icon-symbol';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACTIVE_COLOR = '#2C3E50';
const INACTIVE_COLOR = '#9CA3AF';
const TAB_BAR_HEIGHT = 50;

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const handleTabPress = (route: any, isFocused: boolean) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom - 8, 4),
          height: TAB_BAR_HEIGHT + Math.max(insets.bottom - 8, 4),
        },
      ]}
    >
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={() => handleTabPress(route, isFocused)}
              style={styles.tab}
            >
              {index === 0 ? (
                <IconSymbol
                  size={26}
                  name="house.fill"
                  color={isFocused ? ACTIVE_COLOR : INACTIVE_COLOR}
                />
              ) : (
                <IconSymbol
                  size={26}
                  name="chart.bar.fill"
                  color={isFocused ? ACTIVE_COLOR : INACTIVE_COLOR}
                />
              )}
              <Text
                style={[
                  styles.tabLabel,
                  { color: isFocused ? ACTIVE_COLOR : INACTIVE_COLOR },
                ]}
              >
                {String(label)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  tabBar: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
});
