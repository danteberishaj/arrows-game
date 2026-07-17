import Constants from 'expo-constants';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Fonts, Palette } from './theme';

/**
 * Ads, ported from the Unity AdManager (LevelPlay): one preloaded
 * interstitial paced to every Nth finished game (shown only after a clear)
 * and one rewarded ad for the "+1 heart continue" and the hint.
 *
 * The native LevelPlay SDK (ironsource-mediation) only exists in a dev build
 * (`npx expo run:android` / EAS) — Expo Go and web can't load it. Everywhere
 * it's missing, a simulated "test ad" modal (countdown, then claim/skip)
 * stands in, so every ad-gated flow stays testable. Like Unity, every call
 * degrades gracefully: no ad ready => interstitial skipped, rewarded reports
 * failure, gameplay never soft-locks.
 */

// =====================  EDIT THESE  (from the LevelPlay dashboard)  =========
// Same app key / ad units as the Unity Android build. If the RN app ships
// under its own package name, register it in LevelPlay and swap these in.
const APP_KEY = '27012eed5';
const INTERSTITIAL_AD_UNIT = 'tme2lh9p1pkvk1bl';
const REWARDED_AD_UNIT = 'smim4g4z79173hcw';
// ============================================================================

/** Show an interstitial once this many games have finished (win or loss). */
const GAMES_PER_INTERSTITIAL = 2;

// ---- Simulated test-ad host -------------------------------------------------

interface FakeAdRequest {
  kind: 'rewarded' | 'interstitial';
  resolve: (earned: boolean) => void;
}

let fakeAdListener: ((req: FakeAdRequest) => void) | null = null;

function showFakeAd(kind: FakeAdRequest['kind']): Promise<boolean> {
  return new Promise((resolve) => {
    if (fakeAdListener) fakeAdListener({ kind, resolve });
    else resolve(false); // no host mounted: behave like "no fill"
  });
}

/**
 * Renders the simulated ad when no real SDK is available. Mount once at the
 * app root, above everything.
 */
export function AdHost({ palette }: { palette: Palette }) {
  const [req, setReq] = useState<FakeAdRequest | null>(null);
  const [left, setLeft] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fakeAdListener = (r) => {
      setReq(r);
      setLeft(r.kind === 'rewarded' ? 3 : 2);
    };
    return () => {
      fakeAdListener = null;
    };
  }, []);

  useEffect(() => {
    if (!req) return;
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

type LpAd = { loadAd(): Promise<void>; showAd(): Promise<void>; isAdReady(): Promise<boolean>; setListener(l: unknown): void };
let lpInterstitial: LpAd | null = null;
let lpRewarded: LpAd | null = null;
let rewardEarned = false;
let onRewardedClosed: ((earned: boolean) => void) | null = null;
let onInterstitialClosed: (() => void) | null = null;

function nativeAvailable(): boolean {
  return lpInterstitial !== null && lpRewarded !== null;
}

/**
 * Initializes LevelPlay when the native module exists (dev build). In Expo
 * Go / web this quietly leaves the simulated path active.
 */
export async function initAds(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (Constants.executionEnvironment === 'storeClient') return; // Expo Go

  try {
    // Dynamic require: only resolvable in a dev build with the native module.
    const lp = require('ironsource-mediation');
    const { LevelPlay, LevelPlayInitRequest, LevelPlayInterstitialAd, LevelPlayRewardedAd, AdFormat } = lp;

    const request = LevelPlayInitRequest.builder(APP_KEY)
      .withLegacyAdFormats([AdFormat.INTERSTITIAL, AdFormat.REWARDED])
      .build();
    await LevelPlay.init(request, {
      onInitSuccess: () => {},
      onInitFailed: () => {},
    });

    const inter: LpAd = new LevelPlayInterstitialAd(INTERSTITIAL_AD_UNIT);
    inter.setListener({
      onAdLoaded: () => {},
      onAdLoadFailed: () => setTimeout(() => inter.loadAd().catch(() => {}), 15000),
      onAdClosed: () => {
        onInterstitialClosed?.();
        onInterstitialClosed = null;
        inter.loadAd().catch(() => {}); // keep one preloaded
      },
      onAdDisplayFailed: () => {
        onInterstitialClosed?.();
        onInterstitialClosed = null;
      },
    });
    await inter.loadAd();

    const rew: LpAd = new LevelPlayRewardedAd(REWARDED_AD_UNIT);
    rew.setListener({
      onAdLoaded: () => {},
      onAdLoadFailed: () => setTimeout(() => rew.loadAd().catch(() => {}), 15000),
      onAdRewarded: () => {
        rewardEarned = true;
      },
      onAdClosed: () => {
        onRewardedClosed?.(rewardEarned);
        onRewardedClosed = null;
        rewardEarned = false;
        rew.loadAd().catch(() => {}); // keep one preloaded
      },
      onAdDisplayFailed: () => {
        onRewardedClosed?.(false);
        onRewardedClosed = null;
      },
    });
    await rew.loadAd();

    lpInterstitial = inter;
    lpRewarded = rew;
  } catch {
    lpInterstitial = null;
    lpRewarded = null;
  }
}

// ---- Public API ---------------------------------------------------------

let finishedGames = 0;

export const Ads = {
  /** Counts a finished game (a win or a loss both count) toward the pacing. */
  registerGameFinished(): void {
    finishedGames++;
  },

  /**
   * Shows a full-screen ad if one is due (every Nth finished game) and
   * resolves when it closes — call between a clear and the next level.
   * Skips silently when not due or nothing is ready.
   */
  async showInterstitialIfDue(): Promise<void> {
    if (finishedGames < GAMES_PER_INTERSTITIAL) return;

    if (nativeAvailable()) {
      try {
        if (!(await lpInterstitial!.isAdReady())) return; // not ready: skip, don't reset
        finishedGames = 0;
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

    finishedGames = 0;
    await showFakeAd('interstitial');
  },

  /**
   * Shows the rewarded ad ("continue" / hint). Resolves with whether the
   * user actually earned the reward; false when no ad is available.
   */
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
