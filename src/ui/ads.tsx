import Constants from 'expo-constants';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type {
  InterstitialAd,
  RequestOptions,
  RewardedAd,
} from 'react-native-google-mobile-ads';
import { RemoteConfig } from '../config/remoteConfig';
import { SaveSystem } from '../core/saveSystem';
import { CONSENT_GATE } from '../featureFlags';
import type { EventProps } from '../telemetry/events';
import { Telemetry } from '../telemetry/telemetry';
import { adDecision, type AdFormat } from './adGate';
import { AD_INIT_RETRY_DELAYS_MS, createAdInitController } from './adInit';
import { afterDisplayed, isInterstitialDue, sanitizeCounter } from './adPacing';
import { createReadiness } from './adReadiness';
import { OWNER_AD_UNITS, selectAdUnits, type AdUnitIds, type AdUnitSet } from './adUnits';
import {
  applyPrivacy,
  encodeConsent,
  mayInitAds,
  type ConsentSource,
  type PrivacyApi,
} from './consent';
import { Fonts, Palette } from './theme';

/**
 * Ads on Google AdMob (react-native-google-mobile-ads, classic API, no
 * mediation): one preloaded interstitial paced to every Nth finished game
 * (shown only after a clear) and two rewarded ads, one per placement: the
 * "+1 heart continue" and the hint (ruling M3). Each rewarded placement has its
 * own ad unit and its own readiness, so one being unready never blocks the other.
 *
 * Ad units (ruling M1, src/ui/adUnits.ts): Google's sample units in every
 * `__DEV__` build and in any build made with EXPO_PUBLIC_ADMOB_TEST_ADS=1; the
 * owner's units only in a shipping build.
 *
 * The native SDK only exists in a dev build (`npx expo run:android` / EAS) —
 * Expo Go and web can't load it. Where it's missing in a DEVELOPMENT build
 * (`__DEV__`: web preview, Expo Go, debug builds), a simulated "test ad" modal
 * (countdown, then claim/skip) stands in, so every ad-gated flow stays
 * testable. A release build never simulates: without the native SDK it behaves
 * as "no fill". Every call degrades gracefully: no ad ready => interstitial
 * skipped, rewarded reports failure, gameplay never soft-locks.
 *
 * Rewarded readiness (`Ads.rewardedReady` = the continue placement,
 * `Ads.isRewardedReady(placement)`) comes only from SDK events, so a button can
 * say "no ad right now" instead of silently doing nothing (W0-02). Init is
 * retried (timed, and whenever the app becomes active) until it succeeds.
 *
 * Remote kill switch (W6-02, src/config/remoteConfig.ts): every ad decision
 * reads the kill bits at call time. A kill can only take ads away: no SDK
 * module load, no `initialize()`, no ad request for a killed format, no
 * interstitial, rewarded reported not ready. It never touches the pacing counter.
 *
 * The `import type` above is erased at compile time (zero runtime cost), so it
 * cannot break the Expo Go / web bundle where the native module is absent — the
 * only real load happens through the guarded dynamic `require` in loadAdMob().
 */

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
          Real AdMob test ads appear in a dev build.
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

// ---- AdMob adapter ----------------------------------------------------------

type AdMobModule = typeof import('react-native-google-mobile-ads');
type FullScreenAd = InterstitialAd | RewardedAd;
type RewardedPlacement = EventProps<'ad_reward'>['placement'];

const REWARDED_PLACEMENTS: readonly RewardedPlacement[] = ['continue', 'hint'];

interface InterstitialSlot {
  ad: InterstitialAd;
  /** OPENED fired since the current show began. */
  displayed: boolean;
  onClosed: (() => void) | null;
  unsubscribe: Array<() => void>;
}

interface RewardedSlot {
  ad: RewardedAd;
  displayed: boolean;
  earned: boolean;
  onClosed: ((earned: boolean) => void) | null;
  unsubscribe: Array<() => void>;
}

let adMob: AdMobModule | null = null;
let adMobUnavailable = false;
let sdkInitialized = false;
let unitSet: AdUnitSet | null = null;
let interstitial: InterstitialSlot | null = null;
const rewarded: Record<RewardedPlacement, RewardedSlot | null> = { continue: null, hint: null };

let consentSource: ConsentSource | undefined;
let consentAllowsAdSurfaces = !CONSENT_GATE;
/**
 * Privacy signals carried by every ad request. Only the consent gate sets them
 * (through PrivacyApi); with the gate OFF every request is a default request,
 * exactly as before. AdMob fixes a request's options when the ad object is
 * created, so a change recreates the ad objects (refreshAdsAfterConsent).
 */
let requestNonPersonalized = false;
let ccpaOptOut = false;
/** The request options the live ad objects were created with. */
let liveOptionsKey: string | null = null;

function nativeAvailable(): boolean {
  return (
    consentAllowsAdSurfaces &&
    interstitial !== null &&
    rewarded.continue !== null &&
    rewarded.hint !== null
  );
}

/** Remote kill for one ad format, read at call time (never captured at load). */
function killed(format: AdFormat): boolean {
  return adDecision(format, RemoteConfig.killBits()) === 'killed';
}

/** Native, per placement: the last rewarded SDK event left a loaded, unconsumed ad. */
const rewardedLoaded: Record<RewardedPlacement, boolean> = { continue: false, hint: false };
const rewardedReadiness = {
  continue: createReadiness(false),
  hint: createReadiness(false),
};

/**
 * Readiness = native SDK state once the ad objects exist. Without them, only a
 * development build with the simulated host mounted can "serve" an ad; a
 * release build without the native SDK is never ready.
 */
function syncRewardedReady(): void {
  for (const placement of REWARDED_PLACEMENTS) {
    if (!consentAllowsAdSurfaces || killed('rewarded')) {
      // Refused or killed: the button shows W0-02's "no ad available" state.
      rewardedReadiness[placement].set(false);
      continue;
    }
    rewardedReadiness[placement].set(
      nativeAvailable() ? rewardedLoaded[placement] : __DEV__ && fakeAdListener !== null,
    );
  }
}

function setConsentAllowsAdSurfaces(allowed: boolean): void {
  consentAllowsAdSurfaces = !CONSENT_GATE || allowed;
  syncRewardedReady();
}

function setRewardedLoaded(placement: RewardedPlacement, loaded: boolean): void {
  rewardedLoaded[placement] = loaded;
  syncRewardedReady();
}

/**
 * The one place an ad request is made. Nothing is requested for a killed
 * format or while consent keeps ad surfaces closed (W6-02, W7-01); AdMob itself
 * ignores a load while that ad is loaded or already loading.
 */
function requestLoad(ad: FullScreenAd, format: AdFormat): void {
  if (!consentAllowsAdSurfaces || killed(format)) return;
  ad.load();
}

/** Re-requests every idle ad, e.g. after a kill lifted or consent returned. */
function loadIdleAds(): void {
  if (interstitial) requestLoad(interstitial.ad, 'interstitial');
  for (const placement of REWARDED_PLACEMENTS) {
    const slot = rewarded[placement];
    if (slot) requestLoad(slot.ad, 'rewarded');
  }
}

/**
 * One pending reload per ad: repeated load failures for the same ad schedule a
 * single retry, after RELOAD_DELAY_MS. Load errors arrive as ERROR events.
 */
function createReloader(label: string, load: () => void): () => void {
  let pending: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (pending !== null) return;
    adLog(`[ads] ${label} reload scheduled in ${RELOAD_DELAY_MS} ms`);
    pending = setTimeout(() => {
      pending = null;
      try {
        load();
      } catch {
        schedule();
      }
    }, RELOAD_DELAY_MS);
  };
  return schedule;
}

/** v17 reports a presentation failure as ERROR with `phase: 'show'`. */
function isShowError(error: unknown): boolean {
  return (error as { phase?: unknown } | undefined)?.phase === 'show';
}

/**
 * Shows the slot's ad and resolves with the value its close callback receives
 * (CLOSED, or ERROR with phase 'show'), or with `failedValue` when the show is
 * refused. A refusal is either a synchronous throw from `show()` or a rejected
 * native show promise (null-activity / not-ready): 17.1.0 then emits no event
 * and leaves the JS ad object "loaded" and "show requested", so it can never be
 * shown or reloaded again. `onRefused` replaces that one ad object.
 */
function presentAd<T>(
  slot: { ad: FullScreenAd; onClosed: ((value: T) => void) | null },
  failedValue: T,
  onRefused: () => void,
): Promise<T> {
  return new Promise<T>((resolve) => {
    let shown: Promise<void>;
    try {
      shown = Promise.resolve(slot.ad.show());
    } catch {
      onRefused();
      resolve(failedValue);
      return;
    }
    slot.onClosed = resolve;
    shown.catch(() => {
      // Already settled by an ERROR(show) event: that path fetched a fresh ad.
      if (slot.onClosed !== resolve) return;
      slot.onClosed = null;
      onRefused();
      resolve(failedValue);
    });
  });
}

function requestOptions(): RequestOptions {
  const options: RequestOptions = {};
  if (requestNonPersonalized) options.requestNonPersonalizedAdsOnly = true;
  // Google's "restricted data processing" key; RNGMA can only send it as a
  // string extra (the documented Android value is the int 1): UNVERIFIED.
  if (ccpaOptOut) options.networkExtras = { rdp: '1' };
  return options;
}

/** Everything needed to (re)create one ad object with the live configuration. */
interface LiveAdConfig {
  gma: AdMobModule;
  units: AdUnitIds;
  options: RequestOptions;
}

let liveConfig: LiveAdConfig | null = null;

/**
 * Release-build log line, silent under jest so test output stays clean.
 * Metro inlines NODE_ENV as "production" in a release bundle.
 */
function releaseLog(message: string): void {
  if (process.env.NODE_ENV !== 'test') console.log(message);
}

function createInterstitialSlot({ gma, units, options }: LiveAdConfig): InterstitialSlot {
  const { AdEventType, InterstitialAd } = gma;
  const inter = InterstitialAd.createForAdRequest(units.interstitial, options);
  const interSlot: InterstitialSlot = { ad: inter, displayed: false, onClosed: null, unsubscribe: [] };
  const loadInterstitial = () => requestLoad(inter, 'interstitial');
  const reloadInterstitial = createReloader('interstitial', loadInterstitial);
  const finishInterstitial = () => {
    const done = interSlot.onClosed;
    interSlot.onClosed = null;
    done?.();
  };
  interSlot.unsubscribe.push(
    inter.addAdEventListener(AdEventType.ERROR, (error) => {
      if (!isShowError(error)) {
        reloadInterstitial();
        return;
      }
      // Display failed: nothing was shown, so the pacing counter is kept.
      finishInterstitial();
      loadInterstitial(); // the SDK dropped the failed ad; fetch a fresh one
    }),
    // OPENED = "the ad opened and is currently visible". The only place the
    // W0-05 pacing counter resets: an interstitial really displayed.
    inter.addAdEventListener(AdEventType.OPENED, () => {
      interSlot.displayed = true;
      markInterstitialDisplayed();
    }),
    inter.addAdEventListener(AdEventType.CLOSED, () => {
      finishInterstitial();
      loadInterstitial(); // keep one preloaded
    }),
  );
  return interSlot;
}

function createRewardedSlot(
  { gma, units, options }: LiveAdConfig,
  placement: RewardedPlacement,
): RewardedSlot {
  const { AdEventType, RewardedAd, RewardedAdEventType } = gma;
  const unit = placement === 'hint' ? units.rewardedHint : units.rewardedContinue;
  const ad = RewardedAd.createForAdRequest(unit, options);
  const slot: RewardedSlot = { ad, displayed: false, earned: false, onClosed: null, unsubscribe: [] };
  const load = () => requestLoad(ad, 'rewarded');
  const reload = createReloader(`rewarded-${placement}`, load);
  const finish = (earned: boolean) => {
    const done = slot.onClosed;
    slot.onClosed = null;
    done?.(earned);
  };
  slot.unsubscribe.push(
    ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      adLog(`[ads] rewarded-${placement} loaded`);
      setRewardedLoaded(placement, true);
    }),
    ad.addAdEventListener(AdEventType.ERROR, (error) => {
      adLog(`[ads] rewarded-${placement} error:`, error);
      setRewardedLoaded(placement, false);
      if (!isShowError(error)) {
        reload();
        return;
      }
      finish(false); // display failed: nothing granted
      load(); // the SDK dropped the failed ad; fetch a fresh one
    }),
    ad.addAdEventListener(AdEventType.OPENED, () => {
      slot.displayed = true;
      setRewardedLoaded(placement, false); // the loaded ad is consumed
    }),
    ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      adLog(`[ads] rewarded-${placement}: reward earned`);
      slot.earned = true;
    }),
    ad.addAdEventListener(AdEventType.CLOSED, () => {
      adLog(`[ads] rewarded-${placement} closed, earned =`, slot.earned);
      setRewardedLoaded(placement, false);
      const earned = slot.earned;
      slot.earned = false;
      finish(earned);
      load(); // keep one preloaded
    }),
  );
  return slot;
}

/** Unsubscribes and destroys one ad object (its pending show is not resolved here). */
function releaseSlot(slot: { ad: FullScreenAd; unsubscribe: Array<() => void> }): void {
  slot.unsubscribe.forEach((off) => off());
  slot.ad.destroy();
}

/** A refused show left the interstitial object dead: replace it and request a new ad. */
function replaceInterstitial(): void {
  const old = interstitial;
  if (!old || !liveConfig) return;
  releaseSlot(old);
  interstitial = createInterstitialSlot(liveConfig);
  requestLoad(interstitial.ad, 'interstitial');
}

/** A refused show left this placement's ad dead: clear its readiness, replace it. */
function replaceRewarded(placement: RewardedPlacement): void {
  const old = rewarded[placement];
  if (!old || !liveConfig) return;
  releaseSlot(old);
  rewarded[placement] = createRewardedSlot(liveConfig, placement);
  setRewardedLoaded(placement, false);
  requestLoad(rewarded[placement]!.ad, 'rewarded');
}

/**
 * Creates the interstitial and one rewarded ad per placement, each on its own
 * unit, then starts the first loads. The unit-set line is printed BEFORE any
 * ad request, so a build that would request the wrong set can be stopped from
 * its log before anything is loaded or shown (ruling M1). Handles are assigned
 * before any load, so a failed first load never takes the SDK offline for the
 * session; the reloaders recover from load failures.
 */
function createAds(gma: AdMobModule, reason: string): void {
  const selected = selectAdUnits({
    isDev: __DEV__,
    testAdsFlag: process.env.EXPO_PUBLIC_ADMOB_TEST_ADS,
    ownerUnits: OWNER_AD_UNITS,
    testIds: gma.TestIds,
  });
  unitSet = selected.set;
  const options = requestOptions();
  liveOptionsKey = JSON.stringify(options);
  liveConfig = { gma, units: selected.units, options };
  // Unconditional in release: names the unit set (never the IDs themselves).
  releaseLog(`[ads] ${reason}; unitSet=${unitSet}`);

  interstitial = createInterstitialSlot(liveConfig);
  for (const placement of REWARDED_PLACEMENTS) {
    rewarded[placement] = createRewardedSlot(liveConfig, placement);
  }
  syncRewardedReady();

  requestLoad(interstitial.ad, 'interstitial');
  for (const placement of REWARDED_PLACEMENTS) requestLoad(rewarded[placement]!.ad, 'rewarded');
}

/** Releases every ad object; a show still waiting resolves as not shown. */
function destroyAds(): void {
  const inter = interstitial;
  interstitial = null;
  if (inter) {
    releaseSlot(inter);
    const done = inter.onClosed;
    inter.onClosed = null;
    done?.();
  }
  for (const placement of REWARDED_PLACEMENTS) {
    const slot = rewarded[placement];
    rewarded[placement] = null;
    rewardedLoaded[placement] = false;
    if (!slot) continue;
    releaseSlot(slot);
    const done = slot.onClosed;
    slot.onClosed = null;
    done?.(false);
  }
  syncRewardedReady();
}

/** Consent changed while the SDK runs: new request options need new ad objects. */
function refreshAdsAfterConsent(gma: AdMobModule): void {
  if (JSON.stringify(requestOptions()) !== liveOptionsKey) {
    destroyAds();
    createAds(gma, 'AdMob ads recreated after a consent change');
    return;
  }
  loadIdleAds();
}

/** The AdMob JS, loaded on first use; null where the native module is missing. */
function loadAdMob(): AdMobModule | null {
  if (adMob || adMobUnavailable) return adMob;
  try {
    // Dynamic require: the native module exists only in a dev/release build,
    // so loading the package throws (and is caught) anywhere else.
    adMob = require('react-native-google-mobile-ads') as AdMobModule;
  } catch (e) {
    adMobUnavailable = true;
    adLog('[ads] native ads unavailable:', e);
  }
  return adMob;
}

let initAttemptCount = 0;

/**
 * One init attempt: the kill check first (a killed session never loads the
 * AdMob JS, calls `initialize()` or requests an ad). When the consent gate is
 * on, gather and persist consent, stop on a refusal, then apply privacy. From
 * there: `MobileAds().initialize()`, create the ad objects, start the first
 * loads. Rejects when gathering, privacy application or init fails, so the
 * controller retries without treating an error as consent.
 */
async function initAdMobOnce(): Promise<void | 'declined'> {
  // Remote kill: no AdMob contact at all. Thrown as a failed attempt, so the
  // controller's timed and app-active retries re-check this same gate.
  if (RemoteConfig.adsKilled()) {
    adLog('[ads] AdMob init skipped: ads killed by remote config');
    throw new Error('ads killed by remote config');
  }
  const gma = loadAdMob();
  if (!gma) throw new Error('AdMob module missing');

  if (CONSENT_GATE) {
    if (!consentSource) throw new Error('Consent source missing');
    const state = await consentSource.gather();
    SaveSystem.setConsentBits(encodeConsent(state));
    const privacyApi: PrivacyApi = {
      // COPPA: the SDK-wide request configuration, applied before initialize().
      setCOPPA: (value) =>
        gma.MobileAds().setRequestConfiguration({ tagForChildDirectedTreatment: value }),
      // CCPA and personalisation are per-request options on AdMob.
      setCCPA: async (value) => {
        ccpaOptOut = value;
      },
      setConsent: async (value) => {
        requestNonPersonalized = !value;
      },
    };

    const allowed = mayInitAds(state);
    if (!allowed) {
      // Keep an already-running SDK process, but close every ad surface before
      // awaiting its privacy update so withdrawal takes effect immediately.
      setConsentAllowsAdSurfaces(false);
      if (sdkInitialized) await applyPrivacy(state, privacyApi);
      return 'declined';
    }

    await applyPrivacy(state, privacyApi);
    setConsentAllowsAdSurfaces(true);
    if (sdkInitialized) {
      refreshAdsAfterConsent(gma);
      return;
    }
  }

  initAttemptCount += 1;
  adLog('[ads] AdMob init attempt', initAttemptCount);

  // Resolves once the SDK and its adapters initialised (or its own timeout);
  // a rejection is a failed attempt the controller retries.
  const adapters = await gma.MobileAds().initialize();
  sdkInitialized = true;
  // The startup line (release too) proves init resolved and names the unit set;
  // createAds prints it before the first ad request.
  createAds(gma, `AdMob initialize resolved; adapters=${adapters.length}`);
}

/** Retries a failed init; see adInit.ts for the policy. */
export const adInitController = createAdInitController({
  attempt: initAdMobOnce,
  delaysMs: AD_INIT_RETRY_DELAYS_MS,
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (handle) => clearTimeout(handle),
});

// An accepted remote config changes readiness at once (a kill turns a loaded
// rewarded ad not-ready), a lifted per-format kill re-requests the idle ads, and
// a re-enable retries an init the kill blocked. onAppActive() only starts an
// attempt after a failed one, so it is a no-op before initAds() ran and after
// init succeeded.
RemoteConfig.subscribe(() => {
  syncRewardedReady();
  loadIdleAds();
  if (!RemoteConfig.adsKilled()) adInitController.onAppActive();
});

/**
 * Initializes AdMob when the native module exists (dev/release build). In Expo
 * Go / web this quietly leaves the simulated path active. Safe to call more
 * than once; a failed init is retried by `adInitController`.
 */
export async function initAds(source?: ConsentSource): Promise<void> {
  if (Platform.OS === 'web') return;
  if (Constants.executionEnvironment === 'storeClient') return; // Expo Go

  if (CONSENT_GATE) consentSource = source;

  // Killed at boot: the AdMob JS is not even loaded here; the attempt loads it
  // only once ads are allowed again.
  if (!RemoteConfig.adsKilled() && loadAdMob() === null) return; // no native module: nothing to retry
  await adInitController.start();
}

/**
 * Opens AdMob's Ad Inspector (ad-unit and request debugging) once the SDK is
 * initialised; a no-op on the simulated path (Expo Go / web). Not wired to any
 * UI — call from a dev affordance when needed.
 */
export async function launchAdTestSuite(): Promise<void> {
  if (!adMob || !sdkInitialized) return;
  try {
    await adMob.MobileAds().openAdInspector();
  } catch {
    /* degrade gracefully */
  }
}

// ---- Public API ---------------------------------------------------------

// The pacing counter is persisted (SaveSystem, `arrows_finished_games`), so a
// cold start does not reset it. It resets only when an interstitial was
// displayed (AdMob OPENED); a skipped, unavailable or failed show keeps it, and
// the next finished game's "Next level" tries again.

function finishedGames(): number {
  return sanitizeCounter(SaveSystem.finishedGames);
}

function markInterstitialDisplayed(): void {
  SaveSystem.setFinishedGames(afterDisplayed());
}

type AdResultOutcome = EventProps<'ad_result'>['outcome'];

function emitAdRequest(
  format: EventProps<'ad_request'>['format'],
  placement: EventProps<'ad_request'>['placement'],
): void {
  Telemetry.emit('ad_request', { format, placement });
}

function emitAdResult(
  format: EventProps<'ad_result'>['format'],
  placement: EventProps<'ad_result'>['placement'],
  outcome: AdResultOutcome,
): void {
  Telemetry.emit('ad_result', { format, placement, outcome });
}

function finishRewarded(
  placement: RewardedPlacement,
  outcome: AdResultOutcome,
  earned: boolean,
): boolean {
  emitAdResult('rewarded', placement, outcome);
  Telemetry.emit('ad_reward', { placement, earned });
  return earned;
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
    emitAdRequest('interstitial', 'between_levels');
    // Killed remotely: report the reason, but never touch the pacing counter.
    if (killed('interstitial')) {
      emitAdResult('interstitial', 'between_levels', 'killed');
      return;
    }
    if (!consentAllowsAdSurfaces) {
      emitAdResult('interstitial', 'between_levels', 'not_ready');
      return;
    }

    const slot = interstitial;
    if (nativeAvailable() && slot) {
      let outcome: AdResultOutcome = 'display_failed';
      try {
        if (!slot.ad.loaded) {
          outcome = 'not_ready'; // skip without resetting the pacing counter
        } else if (slot.onClosed === null) {
          slot.displayed = false;
          // No reset here: OPENED resets, so a failed show keeps the count.
          await presentAd<void>(slot, undefined, replaceInterstitial);
          outcome = slot.displayed ? 'shown' : 'display_failed';
        } // else: one is already on screen; this call shows nothing (display_failed)
      } catch {
        outcome = 'display_failed';
      }
      emitAdResult('interstitial', 'between_levels', outcome);
      return;
    }

    // No native ad: a release build shows nothing, so it must not touch the
    // pacing counter (only a displayed ad may reset it).
    if (!__DEV__ || fakeAdListener === null) {
      emitAdResult('interstitial', 'between_levels', 'not_ready');
      return;
    }
    // Development host: resets when the simulated ad opens, not if no host is mounted.
    adLog('[ads][simulated] interstitial telemetry can be filtered from this dev tag');
    await showFakeAd('interstitial', markInterstitialDisplayed);
    emitAdResult('interstitial', 'between_levels', 'shown');
  },

  /**
   * Whether the CONTINUE placement's rewarded ad can be shown right now (from
   * SDK events only). The hint placement is `isRewardedReady('hint')`.
   */
  get rewardedReady(): boolean {
    return rewardedReadiness.continue.get();
  },

  /** Whether one placement's rewarded ad can be shown right now (M3). */
  isRewardedReady(placement: RewardedPlacement): boolean {
    return rewardedReadiness[placement].get();
  },

  /**
   * Notifies on every readiness change of one placement (default: continue);
   * returns an unsubscribe function.
   */
  subscribeRewardedReady(
    cb: (ready: boolean) => void,
    placement: RewardedPlacement = 'continue',
  ): () => void {
    return rewardedReadiness[placement].subscribe(cb);
  },

  /**
   * Shows the placement's own rewarded ad ("continue" / hint). Resolves with
   * whether the user actually earned the reward; false when no ad is available.
   */
  async showRewarded(placement: RewardedPlacement = 'continue'): Promise<boolean> {
    emitAdRequest('rewarded', placement);
    if (killed('rewarded')) {
      return finishRewarded(placement, 'killed', false);
    }
    if (!consentAllowsAdSurfaces) {
      return finishRewarded(placement, 'not_ready', false);
    }
    const slot = rewarded[placement];
    if (nativeAvailable() && slot) {
      try {
        if (!slot.ad.loaded) {
          return finishRewarded(placement, 'not_ready', false);
        }
        if (slot.onClosed !== null) {
          // This placement's ad is already on screen: nothing more to show.
          return finishRewarded(placement, 'display_failed', false);
        }
        slot.earned = false;
        slot.displayed = false;
        const earned = await presentAd<boolean>(slot, false, () => replaceRewarded(placement));
        const outcome: AdResultOutcome = earned
          ? 'shown'
          : slot.displayed ? 'dismissed' : 'display_failed';
        return finishRewarded(placement, outcome, earned);
      } catch {
        return finishRewarded(placement, 'display_failed', false);
      }
    }
    if (!__DEV__ || fakeAdListener === null) {
      return finishRewarded(placement, 'not_ready', false);
    }
    adLog(`[ads][simulated] rewarded/${placement} telemetry can be filtered from this dev tag`);
    const earned = await showFakeAd('rewarded');
    return finishRewarded(placement, earned ? 'shown' : 'dismissed', earned);
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
