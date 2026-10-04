import React, { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { Ads } from './ads';
import { PressScale, pressSnapTransform } from './PressScale';
import { PETALS_PER_AD, grantPetalAd, petalAdState, type RewardState } from './rewardLedger';
import { Type, type Palette } from './theme';

const subscribePetalsReady = (cb: (ready: boolean) => void) => Ads.subscribeRewardedReady(cb, 'petals');
const readPetalsReady = () => Ads.isRewardedReady('petals');

/** Decorative "watch" mark: a small screen with a play triangle, drawn as SVG (never an emoji). */
function WatchIcon({ colour }: { colour: string }) {
  return <Svg accessible={false} width={18} height={14} viewBox="0 0 18 14">
    <Rect x={1} y={1} width={16} height={12} rx={3} fill="none" stroke={colour} strokeWidth={1.6} />
    <Path d="M7.2 4.3L11.8 7L7.2 9.7Z" fill={colour} />
  </Svg>;
}

/**
 * PETAL-ADS-01: "Watch an ad · +3 petals". Readiness comes only from the SDK's events for the 'petals' placement, and
 * petals are granted only when the ad resolves with an EARNED reward. States, in priority order: read-only save
 * (SAVE-GUARD) → cap reached → an ad on screen → no ad loaded ("No ad available right now", never grants) → ready.
 */
export function PetalAdButton({ palette: p, state, now }: { palette: Palette; state: RewardState; now: Date }) {
  const ready = useSyncExternalStore(subscribePetalsReady, readPetalsReady);
  const [showing, setShowing] = useState(false);
  // Synchronous latch: a second tap in the same frame (before `showing` re-renders) never starts a second ad.
  const busy = useRef(false);
  const { left } = petalAdState(now);
  const readOnly = !state.canBuy;
  const capped = left <= 0;
  const disabled = readOnly || capped || showing || !ready;
  const label = readOnly || showing ? `Watch an ad · +${PETALS_PER_AD} petals`
    : capped ? 'Come back tomorrow for more'
    : !ready ? 'No ad available right now' : `Watch an ad · +${PETALS_PER_AD} petals`;
  const caption = readOnly ? 'Ads for petals are paused right now' : capped ? null : `${left} left today`;

  const watch = useCallback(async () => {
    if (busy.current || readOnly || petalAdState(now).left <= 0 || !Ads.isRewardedReady('petals')) return;
    busy.current = true;
    setShowing(true);
    try {
      const earned = await Ads.showRewarded('petals');
      if (earned && grantPetalAd(now) === 'granted') {
        AccessibilityInfo.announceForAccessibility(`+${PETALS_PER_AD} petals`);
      }
    } finally {
      busy.current = false;
      setShowing(false);
    }
  }, [now, readOnly]);

  const ink = disabled ? p.inkDim : p.inkOnAccent;
  return <View style={styles.wrap}>
    <PressScale testID="petal-ad-button" accessibilityRole="button" accessibilityLabel={label}
      accessibilityHint={caption ?? undefined} accessibilityState={{ disabled, busy: showing }} disabled={disabled}
      onPress={watch} style={({ pressed }) => [styles.button, disabled
        // Same unavailable look as the book's disabled Buy: no fill, a dashed outline, dimmed label.
        ? { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: p.border }
        : { backgroundColor: pressed ? p.accentDeep : p.accent, transform: pressSnapTransform(pressed) }]}>
      <View style={styles.row}>
        <WatchIcon colour={ink} />
        <Text style={[styles.label, { color: disabled ? p.inkDim : p.inkOnAccent }]}>{label}</Text>
      </View>
    </PressScale>
    {caption !== null && <Text testID="petal-ad-caption" style={[styles.caption, { color: p.inkDim }]}>{caption}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', alignItems: 'center', gap: 6 },
  button: { minHeight: 52, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderRadius: 28, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { ...Type.panelButton, textAlign: 'center' },
  caption: { ...Type.panelSub, textAlign: 'center' },
});
