import { createContext, useContext, useEffect, useRef } from 'react';

/**
 * MOTION-AUDIT M3: one Back stack for the Settings sheet. A sub-page (the picker's Book tab, a Book confirm or
 * "bought" screen) registers a step while it is open; Android back (the Modal's onRequestClose) undoes the newest
 * step first, so Back walks out one level at a time instead of jumping from a purchase confirm to Settings.
 */
export type RegisterBackStep = (step: () => void) => () => void;

export const SheetBackContext = createContext<RegisterBackStep | null>(null);

/** While `active`, Back runs `step` (the newest active step wins). Outside a SettingsSheet: no-op. */
export function useSheetBackStep(active: boolean, step: () => void): void {
  const register = useContext(SheetBackContext);
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    if (!active || !register) return undefined;
    return register(() => stepRef.current());
  }, [active, register]);
}

/** The stack itself (SettingsSheet owns one). Returns the register function and `pop`, true when a step ran. */
export function createBackStack(): { register: RegisterBackStep; pop: () => boolean } {
  const steps: (() => void)[] = [];
  return {
    register: (step) => {
      steps.push(step);
      return () => {
        const i = steps.lastIndexOf(step);
        if (i >= 0) steps.splice(i, 1);
      };
    },
    pop: () => {
      const top = steps[steps.length - 1];
      if (!top) return false;
      top();
      return true;
    },
  };
}
