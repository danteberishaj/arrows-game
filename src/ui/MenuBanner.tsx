import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
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
 * - No telemetry: the W6-06 schema's `format` enum is 'interstitial' |
 *   'rewarded', so a banner event would be rejected (changing the schema is a
 *   separate, reviewed change).
 */
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

  // A new request (or none) starts again from "nothing loaded".
  useEffect(() => {
    setLoadedHeight(0);
  }, [key]);

  const hasRequest = request !== null;
  useEffect(() => {
    onHeight(hasRequest ? loadedHeight : 0);
  }, [hasRequest, loadedHeight, onHeight]);

  const onLoaded = useCallback((size: { height: number }) => {
    setLoadedHeight(Math.max(0, Math.ceil(size.height)));
  }, []);
  const onFailed = useCallback(() => setLoadedHeight(0), []);

  if (!request) return null;
  const { BannerAd } = request;
  return (
    <View pointerEvents="box-none" style={[styles.anchor, { bottom }]} testID="menu-banner">
      <BannerAd
        key={request.key}
        unitId={request.unitId}
        size={request.size}
        requestOptions={request.requestOptions}
        onAdLoaded={onLoaded}
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
