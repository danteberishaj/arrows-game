import { useEffect, useState } from 'react';

/**
 * SPLASH-PERF (2026-11-20): heavy start-up work (UMP / AdMob WebViews, the winter ambience decoder) waits until the
 * intro has handed over to the menu, so it cannot drop the intro's frames on a cold start. Measured on the API 31
 * emulator: UMP's WebView load alone skipped 65 frames (~1 s) mid-intro.
 */
/** After the splash calls onDone: the menu's ~180 ms fade-in (ScreenSlot) plus margin. */
export const AFTER_INTRO_MS = 400;
/** If no splash ever reports (a skipped or broken splash), start anyway; above SPLASH_MAX_MS (4 s). */
export const INTRO_FALLBACK_MS = 6000;

let done = false;
const waiting = new Set<() => void>();
let fallback: ReturnType<typeof setTimeout> | null = null;

function release(): void {
  if (done) return;
  done = true;
  if (fallback) clearTimeout(fallback);
  for (const fn of waiting) fn();
  waiting.clear();
}

/** The splash has handed over: release the waiting work AFTER_INTRO_MS later. */
export function introOver(): void {
  if (!done) setTimeout(release, AFTER_INTRO_MS);
}

/** Runs `fn` once the intro is over (at once if it already is). */
export function afterIntro(fn: () => void): void {
  if (done) {
    fn();
    return;
  }
  waiting.add(fn);
  if (!fallback) fallback = setTimeout(release, INTRO_FALLBACK_MS);
}

/** True from the moment the intro's waiting work is released. */
export function useIntroDone(): boolean {
  const [value, setValue] = useState(done);
  useEffect(() => {
    if (done) {
      setValue(true);
      return undefined;
    }
    const fn = () => setValue(true);
    afterIntro(fn);
    return () => {
      waiting.delete(fn);
    };
  }, []);
  return value;
}

/** Test seam: back to a fresh process. */
export function resetIntroGateForTests(): void {
  done = false;
  waiting.clear();
  if (fallback) clearTimeout(fallback);
  fallback = null;
}
