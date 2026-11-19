import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ads } from './ads';

/**
 * ADMOB-C (ruling M4): the menu's anchored adaptive AdMob banner.
 *
 * - Renders only while `Ads.bannerAllowed` (META_BANNER on, SDK initialised,
 *   ads not remote-killed, consent allowing ad surfaces). A mid-session kill
 *   or a consent withdrawal unmounts it at once.
 * - Takes no space until an ad has loaded: the container is absolute, and the
 *   package's banner view is 0x0 until `onAdLoaded` reports its size.
 *   `onHeight` tells the menu how much room the loaded ad takes (0 otherwise),
 *   so the stats line can sit above it.
 * - It never loads the package itself: `Ads.bannerRequest()` hands over the
 *   `BannerAd` component from the already-initialised AdMob module.
 * - BANNER-RETRY: a failed load (no fill, network) re-requests after BANNER_RETRY_MS by remounting the view: the
 *   SDK only auto-refreshes a banner that has loaded once, so one live no-fill used to leave the menu empty until it
 *   remounted. Load results print one release log line (error code only, never the unit id).
 * - No telemetry: the W6-06 schema's `format` enum is 'interstitial' |
 *   'rewarded', so a banner event would be rejected (changing the schema is a
 *   separate, reviewed change).
 */
/** Same delay as the full-screen formats' shipped reload (ads.tsx RELOAD_DELAY_MS). */
export const BANNER_RETRY_MS = 15000;

/** Release-build log line, silent under jest (ads.tsx releaseLog). */
function bannerLog(message: string): void {
  if (process.env.NODE_ENV !== 'test') console.log(message);
}

export function MenuBanner({
  bottom,
  onHeight,
}: {
  /** Distance from the screen bottom (the bottom safe-area inset). */
  bottom: number;
  onHeight: (height: number) => void;
}) {
  const key = useSyncExternalStore(
    Ads.subscribeBanner,
    () => Ads.bannerRequest()?.key ?? null,
  );
  const request = key === null ? null : Ads.bannerRequest();
  const [loadedHeight, setLoadedHeight] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearRetry = useCallback(() => {
    if (retryTimer.current !== null) clearTimeout(retryTimer.current);
    retryTimer.current = null;
  }, []);

  // A new request (or none) starts again from "nothing loaded".
  useEffect(() => {
    setLoadedHeight(0);
    setAttempt(0);
    return clearRetry;
  }, [key, clearRetry]);

  const hasRequest = request !== null;
  useEffect(() => {
    onHeight(hasRequest ? loadedHeight : 0);
  }, [hasRequest, loadedHeight, onHeight]);

  const onLoaded = useCallback((size: { height: number }) => {
    setLoadedHeight(Math.max(0, Math.ceil(size.height)));
  }, []);
  const onAdLoaded = useCallback((size: { height: number }) => {
    bannerLog(`[ads] banner loaded height=${Math.ceil(size.height)}`);
    onLoaded(size);
  }, [onLoaded]);
  const onFailed = useCallback((error?: unknown) => {
    setLoadedHeight(0);
    const code = (error as { code?: unknown } | undefined)?.code;
    bannerLog(`[ads] banner failed code=${typeof code === 'string' ? code : 'unknown'}; retry in ${BANNER_RETRY_MS} ms`);
    if (retryTimer.current !== null) return;
    retryTimer.current = setTimeout(() => {
      retryTimer.current = null;
      setAttempt((n) => n + 1);
    }, BANNER_RETRY_MS);
  }, []);

  if (!request) return null;
  const { BannerAd } = request;
  return (
    <View pointerEvents="box-none" style={[styles.anchor, { bottom }]} testID="menu-banner">
      <BannerAd
        key={`${request.key}#${attempt}`}
        unitId={request.unitId}
        size={request.size}
        requestOptions={request.requestOptions}
        onAdLoaded={onAdLoaded}
        onSizeChange={onLoaded}
        onAdFailedToLoad={onFailed}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
