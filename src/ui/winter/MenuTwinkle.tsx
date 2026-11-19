import React, { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat,
  withTiming, type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import type { Bulb } from './paintedBulbs';

/**
 * MENU-TWINKLE (META_MENU_TWINKLE): soft glows over the painted bulbs. OWNER-PICKED 2026-11-19: "breathing" (the
 * occasional-glint variant was compared on device and removed). Bulbs are wired into 3 circuits (every third bulb)
 * that each breathe on a sine, with half-cycles of 2.6 / 3.1 / 3.7 s, so the pattern never visibly repeats
 * (range 0.15 ↔ 0.55, see BREATHE_*). Under 0.5 Hz (photosensitivity limit is 3 flashes / s). Opacity only, on the UI thread; one Svg per
 * circuit, not per bulb (Android rasterises each Svg). Reduced motion: still at the mid value. Stops (rests) while
 * paused (a sheet or drawer covers the menu) or the app is in the background.
 */
export type TwinkleLook = 'breathe' | 'off';

const CIRCUIT_MS = [2600, 3100, 3700] as const;
/** Owner accepted these on the device comparison clip (between Fable's 0.25-0.7 and Astra's subtler range). */
const BREATHE_LO = 0.15;
const BREATHE_HI = 0.55;
/** Reduced motion / paused: the breathing glow holds here. */
const REST = 0.35;
/** Glow radius as a share of the layer's width (~10 dp at 360 dp: the halo just past the painted bulb). */
const R = 0.028;
const VB = 1000;

function Glows({ bulbs, aspect, only, day }: { bulbs: readonly Bulb[]; aspect: number; only?: (i: number) => boolean; day: boolean }) {
  const h = VB / aspect;
  const shown = bulbs.map((b, i) => ({ b, i })).filter(({ i }) => !only || only(i));
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${VB} ${h}`}>
      <Defs>
        {shown.map(({ b, i }) => (
          <RadialGradient key={i} id={`g${i}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#fff8e0" stopOpacity={day ? 0.55 : 0.9} />
            <Stop offset="0.3" stopColor={b.color} stopOpacity={day ? 0.4 : 0.7} />
            <Stop offset="1" stopColor={b.color} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {shown.map(({ b, i }) => <Circle key={i} cx={b.x * VB} cy={b.y * h} r={R * VB} fill={`url(#g${i})`} />)}
    </Svg>
  );
}

function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

function Circuit({ o, children }: { o: SharedValue<number>; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => ({ opacity: o.get() }));
  return <Animated.View pointerEvents="none" renderToHardwareTextureAndroid style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>;
}

/** Fills its parent, which must be laid out exactly over the image whose bulbs it lights. */
export function MenuTwinkle({ look, bulbs, aspect, paused, day, testID }: {
  look: TwinkleLook; bulbs: readonly Bulb[]; aspect: number; paused: boolean; day: boolean; testID?: string;
}) {
  const reduced = useReducedMotion();
  const active = useAppActive();
  const run = look !== 'off' && !reduced && !paused && active;
  const c0 = useSharedValue(0.45), c1 = useSharedValue(0.45), c2 = useSharedValue(0.45);
  const circuits = [c0, c1, c2];

  useEffect(() => {
    circuits.forEach(c => { cancelAnimation(c); c.set(REST); });
    if (!run) return;
    circuits.forEach((c, k) => {
      c.set(BREATHE_LO);
      c.set(withDelay(k * 700, withRepeat(withTiming(BREATHE_HI, {
        duration: CIRCUIT_MS[k], easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.System,
      }), -1, true, undefined, ReduceMotion.System), ReduceMotion.System));
    });
    return () => circuits.forEach(c => cancelAnimation(c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  if (look === 'off') return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID={testID}>
      {circuits.map((c, k) => <Circuit key={k} o={c}><Glows bulbs={bulbs} aspect={aspect} day={day} only={i => i % 3 === k} /></Circuit>)}
    </View>
  );
}
