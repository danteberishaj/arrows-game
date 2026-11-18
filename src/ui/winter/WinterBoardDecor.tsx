import React, { useEffect } from 'react';
import { Image, StyleSheet, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import Animated, {
  cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import type { SkinSpec } from '../skinSpecs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOARD_ASPECTS } from './boardAspects';
import { useWinterLook, winterDecorOn } from './winterLook';

const DRIFT = { day: require('../../../assets/images/winter/board-drift-day.webp'), night: require('../../../assets/images/winter/board-drift-night.webp') };
const FROST = { day: require('../../../assets/images/winter/board-frost-day.webp'), night: require('../../../assets/images/winter/board-frost-night.webp') };
const FALL = {
  far: { day: require('../../../assets/images/winter/snowfall-far-day.webp'), night: require('../../../assets/images/winter/snowfall-far-night.webp') },
  near: { day: require('../../../assets/images/winter/snowfall-near-day.webp'), night: require('../../../assets/images/winter/snowfall-near-night.webp') },
};
const TILE_ASPECT = 720 / 1600; // scripts/art/winter/board-post.py TILE: at phone width a tile outgrows the board viewport
const FAR_MS = 26000; // one tile height per cycle: slow, so it reads as weather, not motion to track
const NEAR_MS = 16000;

/** True for a skin whose board asks for snow (`board.decor: 'snow'`, the Winter skins). */
export function wantsSnow(spec: SkinSpec | null | undefined): boolean {
  const board = spec?.board as { decor?: string } | undefined;
  return board?.decor === 'snow';
}

/**
 * WINTER-01 in-game winter frame, drawn inside the board viewport UNDER the arrows (the native board view is
 * transparent). Everyone in season gets the static frame (frost along the top, a snowbank along the bottom); a Winter
 * skin adds sparse snowfall: two pre-drawn tiles sliding down on the UI thread (transform only), none under reduced
 * motion. Screen-anchored, so it never pans or zooms with the board.
 */
export function WinterBoardDecor({ spec, dark }: { spec: SkinSpec | null | undefined; dark: boolean }) {
  const look = useWinterLook();
  const bottom = useSafeAreaInsets().bottom; // the board viewport runs under the nav bar; the bank sits above it
  if (!winterDecorOn() || look.board === 'off') return null;
  const t = dark ? 'night' : 'day';
  const snowing = look.board === 'snow' || (look.board === 'auto' && wantsSnow(spec));
  return (
    <View pointerEvents="none" style={styles.root} testID="winter-board-decor">
      {snowing && <Snowfall t={t} />}
      <Image source={FROST[t]} style={[styles.frost, { aspectRatio: BOARD_ASPECTS.frost }]} resizeMode="contain" />
      <Image source={DRIFT[t]} style={[styles.drift, { bottom, aspectRatio: BOARD_ASPECTS.drift }]} resizeMode="contain" />
    </View>
  );
}

function Snowfall({ t }: { t: 'day' | 'night' }) {
  const reduced = useReducedMotion();
  const h = useWindowDimensions().width / TILE_ASPECT;
  if (reduced) return null; // still flakes read as dust on the board
  return (
    <>
      <FallLayer source={FALL.far[t]} h={h} ms={FAR_MS} />
      <FallLayer source={FALL.near[t]} h={h} ms={NEAR_MS} />
    </>
  );
}

/** Two identical tiles stacked; translateY runs -h → 0 and wraps, and the two ends look the same, so the loop is seamless. */
function FallLayer({ source, h, ms }: { source: ImageSourcePropType; h: number; ms: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(
      withTiming(1, { duration: ms, easing: Easing.linear, reduceMotion: ReduceMotion.System }),
      -1, false, undefined, ReduceMotion.System,
    );
    return () => cancelAnimation(p);
  }, [ms, p]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: (p.value - 1) * h }] }));
  return (
    <Animated.View style={[styles.fall, { height: 2 * h }, style]} testID="winter-snowfall">
      <Image source={source} style={{ width: '100%', height: h }} />
      <Image source={source} style={{ width: '100%', height: h }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  fall: { position: 'absolute', top: 0, left: 0, right: 0 },
  frost: { position: 'absolute', top: 0, left: 0, right: 0, width: '100%', height: undefined },
  drift: { position: 'absolute', bottom: 0, left: 0, right: 0, width: '100%', height: undefined },
});
