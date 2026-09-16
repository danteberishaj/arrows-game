import Constants from 'expo-constants';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type {
  LevelPlayInterstitialAd,
  LevelPlayInterstitialAdListener,
  LevelPlayRewardedAd,
  LevelPlayRewardedAdListener,
} from 'unity-levelplay-mediation';
import { SaveSystem } from '../core/saveSystem';
import { AD_INIT_RETRY_DELAYS_MS, createAdInitController } from './adInit';
import { afterDisplayed, isInterstitialDue, sanitizeCounter } from './adPacing';
import { createReadiness } from './adReadiness';
import { Fonts, Palette } from './theme';

/**
 * Ads, ported from the Unity AdManager (LevelPlay): one preloaded
 * interstitial paced to every Nth finished game (shown only after a clear)
 * and one rewarded ad for the "+1 heart continue" and the hint.
 *
 * The native LevelPlay SDK (unity-levelplay-mediation) only exists in a dev
 * build (`npx expo run:android` / EAS) — Expo Go and web can't load it.
 * Where it's missing in a DEVELOPMENT build (`__DEV__`: web preview, Expo Go,
 * debug builds), a simulated "test ad" modal (countdown, then claim/skip)
 * stands in, so every ad-gated flow stays testable. A release build never
 * simulates: without the native SDK it behaves as "no fill". Like Unity,
 * every call degrades gracefully: no ad ready => interstitial skipped,
 * rewarded reports failure, gameplay never soft-locks.
 *
 * Rewarded readiness (`Ads.rewardedReady`) comes only from SDK callbacks, so a
 * button can say "no ad right now" instead of silently doing nothing. Init is
 * retried (timed, and whenever the app becomes active) until it succeeds.
 *
 * The `import type` above is erased at compile time (zero runtime cost), so it
 * cannot break the Expo Go / web bundle where the native module is absent — the
 * only real load happens through the guarded dynamic `require` in initAds().
 */

// =====================  EDIT THESE  (from the LevelPlay dashboard)  =========
// Same app key / ad units as the Unity Android build. If the RN app ships
// under its own package name, register it in LevelPlay and swap these in.
const APP_KEY = '27012eed5';
const INTERSTITIAL_AD_UNIT = 'tme2lh9p1pkvk1bl';
const REWARDED_AD_UNIT = 'smim4g4z79173hcw';
// ============================================================================

/**
 * Show an interstitial once this many games have finished (win or loss).
 * Inherited from the shipped build, never measured; W0-05 does not change it.
 */
const GAMES_PER_INTERSTITIAL = 2;

/** Delay before re-requesting an ad whose load failed (the shipped 15 s retry). */
const RELOAD_DELAY_MS = 15000;

/** Development-only log line (release builds print nothing). */
function adLog(...args: unknown[]): void {
  if (__DEV__) console.log(...args);
}

// ---- Simulated test-ad host -------------------------------------------------

interface FakeAdRequest {
  kind: 'rewarded' | 'interstitial';
  resolve: (earned: boolean) => void;
  /** Called once the simulated ad is actually on screen. */
  onDisplayed?: () => void;
}

let fakeAdListener: ((req: FakeAdRequest) => void) | null = null;

function showFakeAd(kind: FakeAdRequest['kind'], onDisplayed?: () => void): Promise<boolean> {
  // Release builds never simulate an ad: no fill, nothing granted. `__DEV__` is
  // a build-time constant, so Metro drops the simulated path from the bundle.
  if (!__DEV__) return Promise.resolve(false);
  return new Promise((resolve) => {
    if (fakeAdListener) fakeAdListener({ kind, resolve, onDisplayed });
    else resolve(false); // no host mounted: behave like "no fill"
  });
}

/**
 * Renders the simulated ad when no real SDK is available. Mount once at the
 * app root, above everything.
 */
export function AdHost({ palette }: { palette: Palette }) {
  // Dev-only. `__DEV__` never changes within a build, so the hook order below
  // is stable; in a release bundle everything after this line is dead code.
  if (!__DEV__) return null;
  const [req, setReq] = useState<FakeAdRequest | null>(null);
  const [left, setLeft] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fakeAdListener = (r) => {
      setReq(r);
      setLeft(r.kind === 'rewarded' ? 3 : 2);
    };
    syncRewardedReady();
    return () => {
      fakeAdListener = null;
      syncRewardedReady();
    };
  }, []);

  useEffect(() => {
    if (!req) return;
    req.onDisplayed?.(); // the modal is committed: the simulated ad has opened
    timer.current = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [req]);

  if (!req) return null;
  const p = palette;
  const done = left <= 0;
  const finish = (earned: boolean) => {
    req.resolve(earned);
    setReq(null);
  };

  return (
    <View style={styles.overlay}>
      <View style={[styles.panel, { backgroundColor: p.surface, borderColor: p.border }]}>
        <Text style={[styles.tag, { color: p.inkDim }]}>TEST AD</Text>
        <Text style={[styles.title, { color: p.ink }]}>
          {req.kind === 'rewarded' ? 'Your reward is loading' : 'A word from our sponsor'}
        </Text>
        <Text style={[styles.count, { color: p.accent }]}>{done ? '✓' : left}</Text>
        <Text style={[styles.sub, { color: p.inkDim }]}>
          Real LevelPlay ads appear in a dev build.
        </Text>
        {req.kind === 'rewarded' ? (
          <View style={styles.row}>
            <Pressable
              onPress={() => finish(false)}
              style={[styles.smallBtn, { borderColor: p.border }]}
            >
              <Text style={{ color: p.inkDim, fontWeight: '600' }}>Skip</Text>
            </Pressable>
            <Pressable
              disabled={!done}
              onPress={() => finish(true)}
              style={[
                styles.claimBtn,
                { backgroundColor: done ? p.accent : p.heartLost },
              ]}
            >
              <Text style={{ color: p.inkOnAccent, fontWeight: '700' }}>Claim</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            disabled={!done}
            onPress={() => finish(true)}
            style={[styles.claimBtn, { backgroundColor: done ? p.accent : p.heartLost }]}
          >
            <Text style={{ color: p.inkOnAccent, fontWeight: '700' }}>Close</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ---- LevelPlay adapter ------------------------------------------------------

type LevelPlayModule = typeof import('unity-levelplay-mediation');

let lpInterstitial: LevelPlayInterstitialAd | null = null;
let lpRewarded: LevelPlayRewardedAd | null = null;
let levelPlayApi: LevelPlayModule['LevelPlay'] | null = null;
let levelPlayModule: LevelPlayModule | null = null;
let rewardEarned = false;
let onRewardedClosed: ((earned: boolean) => void) | null = null;
let onInterstitialClosed: (() => void) | null = null;

function nativeAvailable(): boolean {
  return lpInterstitial !== null && lpRewarded !== null;
}

/** Native: the last rewarded SDK callback left a loaded, unconsumed ad. */
let rewardedLoaded = false;
const rewardedReadiness = createReadiness(false);

/**
 * Readiness = native SDK state once the handles exist. Without them, only a
 * development build with the simulated host mounted can "serve" an ad; a
 * release build without the native SDK is never ready.
 */
function syncRewardedReady(): void {
  rewardedReadiness.set(
    nativeAvailable() ? rewardedLoaded : __DEV__ && fakeAdListener !== null,
  );
}

function setRewardedLoaded(loaded: boolean): void {
  rewardedLoaded = loaded;
  syncRewardedReady();
}

/**
 * One pending reload per ad: a rejected `loadAd()` and an `onAdLoadFailed`
 * for the same request schedule a single retry, after RELOAD_DELAY_MS.
 */
function createReloader(label: string, load: () => Promise<void>): () => void {
  let pending: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (pending !== null) return;
    adLog(`[ads] ${label} reload scheduled in ${RELOAD_DELAY_MS} ms`);
    pending = setTimeout(() => {
      pending = null;
      load().catch(schedule);
    }, RELOAD_DELAY_MS);
  };
  return schedule;
}

let initAttemptCount = 0;

/**
 * One init attempt: LevelPlay.init, then assign the handles, then start the
 * first loads (un-awaited). Rejects when init fails, so the controller retries.
 * Keep this order (init, assign handles, load) for any later consent work.
 */
async function initLevelPlayOnce(): Promise<void> {
  const lp = levelPlayModule;
  if (!lp) throw new Error('LevelPlay module missing');
  const { LevelPlay, LevelPlayInitRequest, LevelPlayInterstitialAd, LevelPlayRewardedAd } = lp;
  initAttemptCount += 1;
  adLog('[ads] LevelPlay init attempt', initAttemptCount);

  // Enable the LevelPlay Test Suite in dev builds only (must precede init).
  if (__DEV__) {
    await LevelPlay.setMetaData('is_test_suite', ['enable']);
  }

  // 9.x init request: no legacy ad formats — appKey (+ optional userId) only.
  // LevelPlay.init()'s promise resolves when the call is dispatched, NOT when
  // init finishes — loading an ad before onInitSuccess fails with error 625,
  // so gate ad creation on the actual callback. A second init after
  // onInitFailed succeeds once the network is back (W0-02 premise check).
  const request = LevelPlayInitRequest.builder(APP_KEY).build();
  await new Promise<void>((resolve, reject) => {
    LevelPlay.init(request, {
      onInitSuccess: () => {
        adLog('[ads] LevelPlay init success');
        resolve();
      },
      onInitFailed: (error) => {
        adLog('[ads] LevelPlay init failed:', error);
        reject(new Error('LevelPlay init failed'));
      },
    }).catch(reject);
  });

  const inter = new LevelPlayInterstitialAd(INTERSTITIAL_AD_UNIT);
  const rew = new LevelPlayRewardedAd(REWARDED_AD_UNIT);
  const reloadInterstitial = createReloader('interstitial', () => inter.loadAd());
  const reloadRewarded = createReloader('rewarded', () => rew.loadAd());

  const interListener: LevelPlayInterstitialAdListener = {
    onAdLoaded: () => {},
    onAdLoadFailed: () => reloadInterstitial(),
    // The only place the pacing counter resets: an interstitial really displayed.
    onAdDisplayed: () => markInterstitialDisplayed(),
    onAdClosed: () => {
      onInterstitialClosed?.();
      onInterstitialClosed = null;
      inter.loadAd().catch(reloadInterstitial); // keep one preloaded
    },
    onAdDisplayFailed: () => {
      onInterstitialClosed?.();
      onInterstitialClosed = null;
    },
  };
  inter.setListener(interListener);

  const rewListener: LevelPlayRewardedAdListener = {
    onAdLoaded: () => {
      adLog('[ads] rewarded onAdLoaded');
      setRewardedLoaded(true);
    },
    onAdLoadFailed: (error) => {
      adLog('[ads] rewarded onAdLoadFailed:', error);
      setRewardedLoaded(false);
      reloadRewarded();
    },
    onAdDisplayed: () => {
      setRewardedLoaded(false); // the loaded ad is consumed
    },
    onAdRewarded: () => {
      adLog('[ads] rewarded: reward earned');
      rewardEarned = true;
    },
    onAdClosed: () => {
      adLog('[ads] rewarded closed, earned =', rewardEarned);
      setRewardedLoaded(false);
      onRewardedClosed?.(rewardEarned);
      onRewardedClosed = null;
      rewardEarned = false;
      rew.loadAd().catch(reloadRewarded); // keep one preloaded
    },
    onAdDisplayFailed: () => {
      setRewardedLoaded(false);
      onRewardedClosed?.(false);
      onRewardedClosed = null;
    },
  };
  rew.setListener(rewListener);

  // Handles first, so a failed first load can never take the SDK offline for
  // the session; the reload listeners above recover from load failures.
  lpInterstitial = inter;
  lpRewarded = rew;
  levelPlayApi = LevelPlay;
  syncRewardedReady();

  inter.loadAd().catch(reloadInterstitial);
  rew.loadAd().catch(reloadRewarded);
}

/** Retries a failed init; see adInit.ts for the policy. */
export const adInitController = createAdInitController({
  attempt: initLevelPlayOnce,
  delaysMs: AD_INIT_RETRY_DELAYS_MS,
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (handle) => clearTimeout(handle),
});

/**
 * Initializes LevelPlay when the native module exists (dev build). In Expo
 * Go / web this quietly leaves the simulated path active. Safe to call more
 * than once; a failed init is retried by `adInitController`.
 */
export async function initAds(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (Constants.executionEnvironment === 'storeClient') return; // Expo Go

  if (!levelPlayModule) {
    try {
      // Dynamic require: only resolvable in a dev build with the native module.
      levelPlayModule = require('unity-levelplay-mediation') as LevelPlayModule;
    } catch (e) {
      adLog('[ads] native ads unavailable:', e);
      return; // no native module: nothing to retry
    }
  }
  await adInitController.start();
}

/**
 * Launches the LevelPlay Test Suite (ad-unit validation / mediation debug) when
 * the native SDK is present; a no-op on the simulated path (Expo Go / web).
 * Not wired to any UI — call from a dev affordance when needed.
 */
export async function launchAdTestSuite(): Promise<void> {
  if (!levelPlayApi) return;
  try {
    await levelPlayApi.launchTestSuite();
  } catch {
    /* degrade gracefully */
  }
}

// ---- Public API ---------------------------------------------------------

// The pacing counter is persisted (SaveSystem, `arrows_finished_games`), so a
// cold start does not reset it. It resets only when an interstitial was
// displayed; a skipped, unavailable or failed show keeps it, and the next
// finished game's "Next level" tries again.

function finishedGames(): number {
  return sanitizeCounter(SaveSystem.finishedGames);
}

function markInterstitialDisplayed(): void {
  SaveSystem.setFinishedGames(afterDisplayed());
}

export const Ads = {
  /** Counts a finished game (a win or a loss both count) toward the pacing. */
  registerGameFinished(): void {
    SaveSystem.setFinishedGames(finishedGames() + 1);
  },

  /**
   * Shows a full-screen ad if one is due (every Nth finished game) and
   * resolves when it closes — call between a clear and the next level.
   * Skips silently when not due or nothing is ready.
   */
  async showInterstitialIfDue(): Promise<void> {
    if (!isInterstitialDue(finishedGames(), GAMES_PER_INTERSTITIAL)) return;

    if (nativeAvailable()) {
      try {
        if (!(await lpInterstitial!.isAdReady())) return; // not ready: skip, don't reset
        // No reset here: onAdDisplayed resets, so a failed show keeps the count.
        await new Promise<void>((resolve) => {
          onInterstitialClosed = resolve;
          lpInterstitial!.showAd().catch(() => {
            onInterstitialClosed = null;
            resolve();
          });
        });
      } catch {
        /* degrade gracefully */
      }
      return;
    }

    // No native ad: a release build shows nothing, so it must not touch the
    // pacing counter (only a displayed ad may reset it).
    if (!__DEV__) return;
    // Development host: resets when the simulated ad opens, not if no host is mounted.
    await showFakeAd('interstitial', markInterstitialDisplayed);
  },

  /**
   * Shows the rewarded ad ("continue" / hint). Resolves with whether the
   * user actually earned the reward; false when no ad is available.
   */
  /** Whether a rewarded ad can be shown right now (from SDK callbacks only). */
  get rewardedReady(): boolean {
    return rewardedReadiness.get();
  },

  /** Notifies on every readiness change; returns an unsubscribe function. */
  subscribeRewardedReady(cb: (ready: boolean) => void): () => void {
    return rewardedReadiness.subscribe(cb);
  },

  async showRewarded(): Promise<boolean> {
    if (nativeAvailable()) {
      try {
        if (!(await lpRewarded!.isAdReady())) return false;
        return await new Promise<boolean>((resolve) => {
          onRewardedClosed = resolve;
          lpRewarded!.showAd().catch(() => {
            onRewardedClosed = null;
            resolve(false);
          });
        });
      } catch {
        return false;
      }
    }
    return showFakeAd('rewarded');
  },
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  panel: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 32,
    paddingVertical: 26,
    alignItems: 'center',
    minWidth: 280,
  },
  tag: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    letterSpacing: 2,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    marginTop: 8,
  },
  count: {
    fontSize: 44,
    fontFamily: Fonts.bold,
    marginVertical: 10,
  },
  sub: {
    fontSize: 12,
    marginBottom: 18,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  smallBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  claimBtn: {
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
});
