import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWinterLook, winterDecorOn } from './winterLook';
import { PAINTED_ASPECTS } from './paintedAspects';
import { MenuTwinkle } from './MenuTwinkle';
import { GARLAND_BULBS, TREE_BULBS } from './paintedBulbs';

const GARLAND = { day: require('../../../assets/images/winter/garland-day.webp'), night: require('../../../assets/images/winter/garland-night.webp') };
const HILLS = { day: require('../../../assets/images/winter/snowscape-day.webp'), night: require('../../../assets/images/winter/snowscape-night.webp') };
const PAINTED = {
  garland: { day: require('../../../assets/images/winter/painted-garland-day.webp'), night: require('../../../assets/images/winter/painted-garland-night.webp') },
  hills: { day: require('../../../assets/images/winter/painted-hills-day.webp'), night: require('../../../assets/images/winter/painted-hills-night.webp') },
};
/** Painted layers are cropped to content by scripts/art/winter/codex-post.py, which prints these ratios. */
const PAINTED_GARLAND_ASPECT = PAINTED_ASPECTS.garland;
const PAINTED_HILLS_ASPECT = PAINTED_ASPECTS.hills;
const GLOW_NIGHT = require('../../../assets/images/winter/garland-glow-night.webp');
const GARLAND_ASPECT = 1440 / 560;
const HILLS_ASPECT = 1440 / 900;
/** The garland hangs below the header buttons (HEADER_TOP + button height in HomeScreen ≈ 64 dp). */
const GARLAND_TOP = 64;

/**
 * WINTER-01: Blender-rendered Christmas dressing behind the menu content. Static images; the only motion is a slow
 * breathing of the night garland's glow (opacity only, UI thread, 2.6 s per half-cycle, sine in-out). The menu is seen
 * often, so nothing enters or moves. Reduced motion: the glow holds still at its mid value.
 */
/** `paused`: a sheet or drawer covers the menu, so the lights rest. */
export function WinterMenuDecor({ dark, paused = false }: { dark: boolean; paused?: boolean }) {
  const look = useWinterLook();
  const insets = useSafeAreaInsets();
  if (!winterDecorOn() || look.menu === 'off') return null;
  const t = dark ? 'night' : 'day';
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="winter-menu-decor">
      {look.menu === 'lights-hills' && (
        <Image source={GARLAND[t]} style={[styles.garland, { top: insets.top + GARLAND_TOP }]} resizeMode="contain" />
      )}
      {look.menu === 'lights-hills' && dark && <GarlandGlow top={insets.top + GARLAND_TOP} />}
      {look.menu === 'painted' ? (
        <>
          <View style={[styles.garland, { top: insets.top + GARLAND_TOP, aspectRatio: PAINTED_GARLAND_ASPECT }]}>
            <Image source={PAINTED.garland[t]} resizeMode="contain" style={styles.fill} />
            <MenuTwinkle look={look.lights} bulbs={GARLAND_BULBS} aspect={PAINTED_GARLAND_ASPECT} paused={paused} day={!dark} testID="winter-twinkle-garland" />
          </View>
          <View style={[styles.hills, { aspectRatio: PAINTED_HILLS_ASPECT }]}>
            <Image source={PAINTED.hills[t]} style={styles.fill} resizeMode="contain" />
            <MenuTwinkle look={look.lights} bulbs={TREE_BULBS} aspect={PAINTED_HILLS_ASPECT} paused={paused} day={!dark} testID="winter-twinkle-tree" />
          </View>
        </>
      ) : (
        <Image source={HILLS[t]} style={styles.hills} resizeMode="contain" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // An absolutely filled Image takes its intrinsic size on Android (1440 px painted art drew 3.5x too big): size it explicitly.
  fill: { width: '100%', height: '100%' },
  garland: { position: 'absolute', left: 0, right: 0, width: '100%', height: undefined, aspectRatio: GARLAND_ASPECT },
  hills: { position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: undefined, aspectRatio: HILLS_ASPECT },
});

function GarlandGlow({ top }: { top: number }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(0.8);
  useEffect(() => {
    if (reduced) {
      o.value = 0.8;
      return;
    }
    o.value = withRepeat(
      withTiming(0.55, { duration: 2600, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.System }),
      -1, true, undefined, ReduceMotion.System,
    );
  }, [reduced, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.Image source={GLOW_NIGHT} style={[styles.garland, { top }, style]} resizeMode="contain" testID="winter-garland-glow" />
  );
}
