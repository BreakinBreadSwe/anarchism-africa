/**
 * Premium entitlement state. The unlock is a one-time purchase; the
 * entitlement flag is cached in AsyncStorage so gating works offline,
 * and can be re-established via "Restore purchases".
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { PREMIUM_CATEGORIES, type Remedy } from '../types/content';
import { purchasePremium, restorePremium } from '../services/iap';

const PREMIUM_STORAGE_KEY = '@grandma/premium';

interface PremiumContextValue {
  isPremium: boolean;
  /** Whether a purchase/restore call is in flight. */
  busy: boolean;
  isLocked: (remedy: Remedy) => boolean;
  purchase: () => Promise<boolean>;
  restore: () => Promise<boolean>;
}

const PremiumContext = createContext<PremiumContextValue | undefined>(
  undefined
);

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const [isPremium, setIsPremium] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PREMIUM_STORAGE_KEY)
      .then((raw) => setIsPremium(raw === 'true'))
      .catch(() => undefined);
  }, []);

  const unlock = useCallback(() => {
    setIsPremium(true);
    AsyncStorage.setItem(PREMIUM_STORAGE_KEY, 'true').catch(() => undefined);
  }, []);

  const purchase = useCallback(async () => {
    setBusy(true);
    try {
      const result = await purchasePremium();
      if (result.success) unlock();
      return result.success;
    } finally {
      setBusy(false);
    }
  }, [unlock]);

  const restore = useCallback(async () => {
    setBusy(true);
    try {
      const result = await restorePremium();
      if (result.success) unlock();
      return result.success;
    } finally {
      setBusy(false);
    }
  }, [unlock]);

  const value = useMemo(
    () => ({
      isPremium,
      busy,
      isLocked: (remedy: Remedy) =>
        !isPremium && PREMIUM_CATEGORIES.includes(remedy.category),
      purchase,
      restore,
    }),
    [isPremium, busy, purchase, restore]
  );

  return (
    <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>
  );
}

export function usePremium(): PremiumContextValue {
  const context = useContext(PremiumContext);
  if (!context) {
    throw new Error('usePremium must be used within a PremiumProvider');
  }
  return context;
}
