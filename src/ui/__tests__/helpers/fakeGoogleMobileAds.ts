/**
 * ADMOB-B: a hand-written fake of the slice of react-native-google-mobile-ads
 * (17.1.0, classic API) that ads.tsx uses. The package ships no jest mock.
 *
 * Mirrors the real JS where ads.tsx depends on it (node_modules/
 * react-native-google-mobile-ads/src/ads/MobileAd.ts):
 * - `loaded` turns true on LOADED / `rewarded_loaded`, false on CLOSED / ERROR;
 * - `load()` is ignored while loaded or while a load is in flight;
 * - `show()` throws synchronously when not loaded or already showing;
 * - `addAdEventListener` returns an unsubscribe function;
 * - `AdEventType.LOADED` is rejected on a rewarded ad.
 * A test can override `loaded` per format (the old fakes' `isAdReady()`), and
 * choose what `show()` does.
 *
 * `legacyListener()` lets the ported W0-02 / W0-05 / W6-02 / W7-01 suites keep
 * their bodies byte-identical: each LevelPlay listener call they make is sent
 * as the AdMob event that ads.tsx maps it to (the report's mapping table).
 */

export const AdEventType = {
  LOADED: 'loaded',
  ERROR: 'error',
  OPENED: 'opened',
  PAID: 'paid',
  CLICKED: 'clicked',
  CLOSED: 'closed',
  IMPRESSION: 'impression',
} as const;

export const RewardedAdEventType = {
  LOADED: 'rewarded_loaded',
  EARNED_REWARD: 'rewarded_earned_reward',
} as const;

/** Android values of the package's TestIds (src/TestIds.ts). */
export const TestIds = {
  INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  REWARDED: 'ca-app-pub-3940256099942544/5224354917',
  ADAPTIVE_BANNER: 'ca-app-pub-3940256099942544/9214589741',
} as const;

export type FakeAdKind = 'interstitial' | 'rewarded';

/**
 * - `manual`: `show()` resolves and nothing else happens (the test emits events).
 * - `auto`: the SDK "plays" the ad on the next tick, with the event sequence the
 *   old LevelPlay fakes used (interstitial: displayed + closed; rewarded:
 *   rewarded + closed).
 * - `reject`: the `show()` promise rejects and no event follows.
 */
export type ShowBehaviour = 'manual' | 'auto' | 'reject';

type Handler = (payload?: unknown) => void;

export interface FakeAd {
  readonly kind: FakeAdKind;
  readonly unitId: string;
  readonly options: Record<string, unknown>;
  /** load() calls that reached "native" (not ignored). */
  loads: number;
  shows: number;
  destroyed: boolean;
  readonly loaded: boolean;
  load(): void;
  show(): Promise<void>;
  destroy(): void;
  addAdEventListener(type: string, handler: Handler): () => void;
  /** Delivers a native event, updating `loaded` like the real MobileAd. */
  emit(type: string, payload?: unknown): void;
  listenerCount(): number;
}

export interface FakeGmaConfig {
  initOutcome: 'success' | 'failed';
  /** `undefined` = event-driven like the real JS; a boolean pins `ad.loaded`. */
  loadedOverride: Partial<Record<FakeAdKind, boolean>>;
  showBehaviour: Record<FakeAdKind, ShowBehaviour>;
}

export interface FakeGma {
  config: FakeGmaConfig;
  ads: FakeAd[];
  /** `MobileAds().initialize()` calls. */
  inits: number;
  /** Calls that must precede initialize (setRequestConfiguration, openAdInspector). */
  preInitCalls: number;
  requestConfigurations: Record<string, unknown>[];
  /** Order of SDK-wide calls: 'setRequestConfiguration' | 'initialize' | 'create:<kind>'. */
  callLog: string[];
  /** How many times the package module was evaluated (required). */
  moduleLoads: number;
  reset(): void;
  /** The module object `jest.mock('react-native-google-mobile-ads', ...)` returns. */
  module(): Record<string, unknown>;
  live(kind: FakeAdKind, unitId?: string): FakeAd[];
}

export function createFakeGma(): FakeGma {
  const gma: FakeGma = {
    config: defaultConfig(),
    ads: [],
    inits: 0,
    preInitCalls: 0,
    requestConfigurations: [],
    callLog: [],
    moduleLoads: 0,
    reset() {
      gma.config = defaultConfig();
      gma.ads = [];
      gma.inits = 0;
      gma.preInitCalls = 0;
      gma.requestConfigurations = [];
      gma.callLog = [];
      gma.moduleLoads = 0;
    },
    live(kind, unitId) {
      return gma.ads.filter(
        (ad) => ad.kind === kind && !ad.destroyed && (unitId === undefined || ad.unitId === unitId),
      );
    },
    module() {
      gma.moduleLoads += 1;
      const mobileAds = () => ({
        initialize: () => {
          gma.inits += 1;
          gma.callLog.push('initialize');
          return gma.config.initOutcome === 'success'
            ? Promise.resolve([{ name: 'com.google.android.gms.ads.MobileAds', state: 1 }])
            : Promise.reject(new Error('initialize failed'));
        },
        setRequestConfiguration: (config: Record<string, unknown>) => {
          gma.preInitCalls += 1;
          gma.requestConfigurations.push(config);
          gma.callLog.push('setRequestConfiguration');
          return Promise.resolve();
        },
        openAdInspector: () => {
          gma.preInitCalls += 1;
          return Promise.resolve();
        },
      });
      const create = (kind: FakeAdKind) => (unitId: string, options?: Record<string, unknown>) => {
        const ad = createFakeAd(gma, kind, unitId, options ?? {});
        gma.callLog.push(`create:${kind}`);
        gma.ads.push(ad);
        return ad;
      };
      return {
        __esModule: true,
        default: mobileAds,
        MobileAds: mobileAds,
        AdEventType,
        RewardedAdEventType,
        TestIds,
        InterstitialAd: { createForAdRequest: create('interstitial') },
        RewardedAd: { createForAdRequest: create('rewarded') },
      };
    },
  };
  return gma;
}

function defaultConfig(): FakeGmaConfig {
  return {
    initOutcome: 'success',
    loadedOverride: {},
    showBehaviour: { interstitial: 'manual', rewarded: 'manual' },
  };
}

function createFakeAd(
  gma: FakeGma,
  kind: FakeAdKind,
  unitId: string,
  options: Record<string, unknown>,
): FakeAd {
  const handlers = new Map<string, Set<Handler>>();
  let eventLoaded = false;
  let loadInFlight = false;
  let showRequested = false;

  const ad: FakeAd = {
    kind,
    unitId,
    options,
    loads: 0,
    shows: 0,
    destroyed: false,
    get loaded() {
      const pinned = gma.config.loadedOverride[kind];
      return pinned === undefined ? eventLoaded : pinned;
    },
    load() {
      if (ad.destroyed || eventLoaded || loadInFlight) return;
      loadInFlight = true;
      ad.loads += 1;
    },
    show() {
      if (ad.destroyed) throw new Error('show() The requested ad has been destroyed.');
      if (!ad.loaded) throw new Error('show() The requested ad has not loaded and could not be shown.');
      if (showRequested) throw new Error('show() Show has already been requested.');
      showRequested = true;
      ad.shows += 1;
      const behaviour = gma.config.showBehaviour[kind];
      if (behaviour === 'reject') {
        showRequested = false;
        return Promise.reject(new Error('show failed'));
      }
      if (behaviour === 'auto') {
        setImmediate(() => {
          if (kind === 'interstitial') ad.emit(AdEventType.OPENED);
          else ad.emit(RewardedAdEventType.EARNED_REWARD, { type: 'reward', amount: 1 });
          ad.emit(AdEventType.CLOSED);
        });
      }
      return Promise.resolve();
    },
    destroy() {
      ad.destroyed = true;
      handlers.clear();
      eventLoaded = false;
      loadInFlight = false;
      showRequested = false;
    },
    addAdEventListener(type, handler) {
      if (ad.destroyed) throw new Error('addAdEventListener(*) ad has been destroyed.');
      if (kind === 'rewarded' && type === AdEventType.LOADED) {
        throw new Error('RewardedAd.addAdEventListener(*) use RewardedAdEventType.LOADED instead.');
      }
      if (kind === 'interstitial' && Object.values(RewardedAdEventType).includes(type as never)) {
        throw new Error("InterstitialAd.addAdEventListener(*) 'type' expected a valid event type value.");
      }
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(handler);
      return () => {
        handlers.get(type)?.delete(handler);
      };
    },
    emit(type, payload) {
      if (ad.destroyed) return;
      if (type === AdEventType.LOADED || type === RewardedAdEventType.LOADED) {
        eventLoaded = true;
        loadInFlight = false;
      }
      if (type === AdEventType.CLOSED || type === AdEventType.ERROR) {
        eventLoaded = false;
        loadInFlight = false;
        showRequested = false;
      }
      for (const handler of [...(handlers.get(type) ?? [])]) handler(payload);
    },
    listenerCount() {
      let n = 0;
      for (const set of handlers.values()) n += set.size;
      return n;
    },
  };
  return ad;
}

/** A load failure as the package delivers it (AdError with phase 'load'). */
export function loadError(): Record<string, unknown> {
  return { code: 'googleMobileAds/error-code-no-fill', reason: 'no-fill', phase: 'load' };
}

/** A presentation failure as v17 delivers it on Android (ERROR, phase 'show'). */
export function showError(): Record<string, unknown> {
  return { code: 'googleMobileAds/error-code-internal-error', reason: 'internal-error', phase: 'show' };
}

export type LegacyListener = Record<
  | 'onAdLoaded'
  | 'onAdLoadFailed'
  | 'onAdDisplayed'
  | 'onAdDisplayFailed'
  | 'onAdClosed'
  | 'onAdRewarded',
  (...args: unknown[]) => void
>;

/**
 * The LevelPlay listener calls the ported suites make, sent as AdMob events to
 * every ad `targets()` returns (the mapping table in docs/next-level/reports/ADMOB-B.md).
 */
export function legacyListener(targets: () => FakeAd[]): LegacyListener {
  const send = (type: (ad: FakeAd) => string, payload?: unknown) => () => {
    for (const ad of targets()) ad.emit(type(ad), payload);
  };
  return {
    onAdLoaded: send((ad) => (ad.kind === 'rewarded' ? RewardedAdEventType.LOADED : AdEventType.LOADED)),
    onAdLoadFailed: send(() => AdEventType.ERROR, loadError()),
    onAdDisplayed: send(() => AdEventType.OPENED),
    onAdDisplayFailed: send(() => AdEventType.ERROR, showError()),
    onAdClosed: send(() => AdEventType.CLOSED),
    onAdRewarded: send(() => RewardedAdEventType.EARNED_REWARD, { type: 'reward', amount: 1 }),
  };
}
