import { useEffect, useState } from 'react';
import { getMeals, subscribeMeals, MealEntry } from '@/state/meals';

export type StreakData = {
  currentStreak: number;
  longestStreak: number;
  lastLoggedDate: string | null;
  isLoggedToday: boolean;
};

/**
 * Calculate logging streak from meals data
 */
function calculateStreak(meals: MealEntry[]): StreakData {
  if (meals.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastLoggedDate: null,
      isLoggedToday: false,
    };
  }

  // Get unique days that have meals (dayId is already in YYYY-MM-DD format)
  const daysWithMeals = new Set(meals.map(m => m.dayId));
  const sortedDays = Array.from(daysWithMeals).sort().reverse(); // Most recent first

  // Get today's date in YYYY-MM-DD format
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  // Check if logged today
  const isLoggedToday = daysWithMeals.has(todayStr);
  
  // Calculate current streak
  let currentStreak = 0;
  let checkDate = new Date(today);
  
  // If not logged today, start checking from yesterday
  if (!isLoggedToday) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  
  while (true) {
    const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    
    if (daysWithMeals.has(dateStr)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
    
    // Safety limit to prevent infinite loop
    if (currentStreak > 365) break;
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate: Date | null = null;

  // Sort days oldest to newest for longest streak calculation
  const sortedDaysAsc = Array.from(daysWithMeals).sort();
  
  for (const dayStr of sortedDaysAsc) {
    const [year, month, day] = dayStr.split('-').map(Number);
    const currentDate = new Date(year, month - 1, day);
    
    if (prevDate) {
      const diffDays = Math.round((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    } else {
      tempStreak = 1;
    }
    
    prevDate = currentDate;
  }
  
  longestStreak = Math.max(longestStreak, tempStreak);

  return {
    currentStreak,
    longestStreak,
    lastLoggedDate: sortedDays[0] || null,
    isLoggedToday,
  };
}

/**
 * Hook to get and subscribe to streak data
 */
export function useStreak(): StreakData {
  const [streakData, setStreakData] = useState<StreakData>(() => calculateStreak(getMeals()));

  useEffect(() => {
    const unsubscribe = subscribeMeals((meals) => {
      setStreakData(calculateStreak(meals));
    });
    return unsubscribe;
  }, []);

  return streakData;
}

