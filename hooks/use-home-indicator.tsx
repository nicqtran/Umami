import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react';

interface HomeIndicatorContextType {
  triggerAnimation: () => void;
  isActive: boolean;
}

const HomeIndicatorContext = createContext<HomeIndicatorContextType | undefined>(undefined);

export function HomeIndicatorProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);

  const triggerAnimation = useCallback(() => {
    setIsActive(true);
    setTimeout(() => setIsActive(false), 400);
  }, []);

  return (
    <HomeIndicatorContext.Provider value={{ triggerAnimation, isActive }}>
      {children}
    </HomeIndicatorContext.Provider>
  );
}

export function useHomeIndicator() {
  const context = useContext(HomeIndicatorContext);
  if (!context) {
    throw new Error('useHomeIndicator must be used within HomeIndicatorProvider');
  }
  return context;
}
