import { useCallback, useSyncExternalStore } from "react";
import { getUnlocks, addUnlock, isUnlocked, seedDemoUnlocks, clearUnlocks } from "@frame-one/shared";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners() {
  listeners.forEach((l) => l());
}

function getSnapshot() {
  return JSON.stringify(getUnlocks());
}

/**
 * React hook for consuming unlocks. MapView and other components can use this
 * to reactively read unlock state without managing their own subscription.
 */
export function useUnlocks() {
  const unlocksJson = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const unlocks: string[] = JSON.parse(unlocksJson);

  const unlock = useCallback((spotId: string) => {
    addUnlock(spotId);
    notifyListeners();
  }, []);

  const checkUnlocked = useCallback((spotId: string) => {
    return isUnlocked(spotId);
  }, []);

  const seedDemo = useCallback(() => {
    seedDemoUnlocks();
    notifyListeners();
  }, []);

  const reset = useCallback(() => {
    clearUnlocks();
    notifyListeners();
  }, []);

  return {
    unlocks,
    unlockCount: unlocks.length,
    unlock,
    isUnlocked: checkUnlocked,
    seedDemo,
    reset,
  };
}
