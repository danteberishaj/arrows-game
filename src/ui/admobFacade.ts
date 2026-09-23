/**
 * ADMOB-A (toolchain spike): a TEMPORARY facade that gives ads.tsx the same
 * surface it used from unity-levelplay-mediation, implemented on
 * react-native-google-mobile-ads (AdMob, no mediation). LevelPlay is removed
 * from the app; ads.tsx's pacing, kill-switch, consent and readiness logic is
 * unchanged, and its tests keep their assertions by mocking this module
 * instead of the old package. ADMOB-B replaces this facade with a direct
 * AdMob adapter (two rewarded units, the M1 test/real unit switch, UMP).
 *
 * Spike limits, on purpose:
 * - Every ad request uses Google's sample units (TestIds). The ad-unit and
 *   app-key strings ads.tsx passes in are LevelPlay values and are ignored.
 *   Ruling M1: no real AdMob unit is ever requested from this code.
 * - Privacy signals are NOT wired: setCOPPA / setCCPA / setConsent reject, so
 *   a CONSENT_GATE build fails closed (the init attempt fails, no ad surface
 *   opens). CONSENT_GATE is OFF by default.
 *
 * Importing this module loads the AdMob JS, which registers native event
 * listeners but does not initialise the SDK; only `LevelPlay.init` below calls
 * `MobileAds().initialize()`, and ads.tsx checks the remote kill switch first.
 */
import {
  AdEventType,
  InterstitialAd,
  MobileAds,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

export interface LevelPlayInterstitialAdListener {
  onAdLoaded(adInfo?: unknown): void;
  onAdLoadFailed(error?: unknown): void;
  onAdDisplayed(adInfo?: unknown): void;
  onAdDisplayFailed(error?: unknown, adInfo?: unknown): void;
  onAdClosed(adInfo?: unknown): void;
}

export interface LevelPlayRewardedAdListener extends LevelPlayInterstitialAdListener {
  onAdRewarded(reward?: unknown, adInfo?: unknown): void;
}

export interface LevelPlayInitListener {
  onInitSuccess(config?: unknown): void;
  onInitFailed(error?: unknown): void;
}

const NOT_WIRED = 'ADMOB-A: privacy signals are not wired to AdMob yet (ADMOB-B)';

function adPhase(error: unknown): 'load' | 'show' {
  return (error as { phase?: string } | undefined)?.phase === 'show' ? 'show' : 'load';
}

/** The slice of an AdMob InterstitialAd / RewardedAd this facade uses. */
interface AdMobFullScreenAd {
  load(): void;
  show(): Promise<void>;
  readonly loaded: boolean;
}

type Listen = (
  type: AdEventType | RewardedAdEventType,
  listener: (payload: unknown) => void,
) => () => void;

/** Maps one AdMob full-screen ad onto the LevelPlay ad-object calls ads.tsx makes. */
class FullScreenAd<L extends LevelPlayInterstitialAdListener> {
  protected listener: L | null = null;

  constructor(
    private readonly ad: AdMobFullScreenAd,
    listen: Listen,
    loadedEvent: AdEventType | RewardedAdEventType,
  ) {
    listen(loadedEvent, () => this.listener?.onAdLoaded());
    listen(AdEventType.ERROR, (error) => {
      // v17 emits a presentation failure as ERROR with phase 'show'.
      if (adPhase(error) === 'show') this.listener?.onAdDisplayFailed(error);
      else this.listener?.onAdLoadFailed(error);
    });
    // OPENED = "the ad opened and is currently visible": the displayed event.
    listen(AdEventType.OPENED, () => this.listener?.onAdDisplayed());
    listen(AdEventType.CLOSED, () => this.listener?.onAdClosed());
  }

  setListener(listener: L): void {
    this.listener = listener;
  }

  /** AdMob ignores a load while one is loaded or in flight; errors come as events. */
  async loadAd(): Promise<void> {
    this.ad.load();
  }

  async isAdReady(): Promise<boolean> {
    return this.ad.loaded;
  }

  /** `show()` throws synchronously when not loaded; async turns that into a rejection. */
  async showAd(): Promise<void> {
    await this.ad.show();
  }
}

export class LevelPlayInterstitialAd extends FullScreenAd<LevelPlayInterstitialAdListener> {
  constructor(_levelPlayAdUnitId: string) {
    const ad = InterstitialAd.createForAdRequest(TestIds.INTERSTITIAL);
    super(ad, (type, cb) => ad.addAdEventListener(type as AdEventType, cb), AdEventType.LOADED);
  }
}

export class LevelPlayRewardedAd extends FullScreenAd<LevelPlayRewardedAdListener> {
  constructor(_levelPlayAdUnitId: string) {
    const ad = RewardedAd.createForAdRequest(TestIds.REWARDED);
    const listen: Listen = (type, cb) => ad.addAdEventListener(type, cb);
    super(ad, listen, RewardedAdEventType.LOADED);
    listen(RewardedAdEventType.EARNED_REWARD, (reward) => this.listener?.onAdRewarded(reward));
  }
}

export const LevelPlayInitRequest = {
  builder: (_levelPlayAppKey: string) => ({ build: () => ({}) }),
};

export const LevelPlay = {
  /**
   * Like LevelPlay.init: resolves once dispatched; the outcome arrives through
   * the listener. The AdMob app ID comes from the manifest (app.json plugin).
   */
  init(_request: object, listener: LevelPlayInitListener): Promise<void> {
    MobileAds()
      .initialize()
      .then(
        (adapters) => {
          // Unconditional (release too): the one startup line that proves init
          // resolved and which unit set this build requests.
          console.log(`[ads] AdMob initialize resolved; adapters=${adapters.length}; unitSet=test`);
          listener.onInitSuccess();
        },
        (error: unknown) => {
          console.log('[ads] AdMob initialize failed');
          listener.onInitFailed(error);
        },
      );
    return Promise.resolve();
  },

  /** LevelPlay test-suite metadata has no AdMob counterpart. */
  setMetaData(_key: string, _values: string[]): Promise<void> {
    return Promise.resolve();
  },

  setConsent(_value: boolean): Promise<void> {
    return Promise.reject(new Error(NOT_WIRED));
  },

  /** Development affordance: AdMob's ad inspector replaces the LevelPlay test suite. */
  launchTestSuite(): Promise<void> {
    return MobileAds().openAdInspector();
  },
};

export const LevelPlayPrivacySettings = {
  setCOPPA(_value: boolean): Promise<void> {
    return Promise.reject(new Error(NOT_WIRED));
  },
  setCCPA(_value: boolean): Promise<void> {
    return Promise.reject(new Error(NOT_WIRED));
  },
};
