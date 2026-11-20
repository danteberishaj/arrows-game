import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';
import { useStopWhenScreenLeaves } from './screenHandoff';

/**
 * SEASON-SPLASH: the moving part of the Valentine's / spring / summer splash decor. One linear clock per layer drives
 * every particle on the UI thread (transform + opacity only; each particle's Svg is drawn once). The caller skips this
 * under reduced motion, as it skips the winter snowfall.
 */
const CYCLE_MS = 5200; // one particle crosses the screen in a cycle (x its speed): reads as drifting within a 2.5 s intro
const HEART = 'M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z';
const INK = '#191724';

type Kind = 'hearts' | 'petals';
// Deterministic "random" layout: x (0..1 of width), phase (0..1), speed, size (dp), sway (dp), colour.
const PARTICLES: readonly { x: number; ph: number; sp: number; s: number; sw: number; c: number }[] = [
  { x: 0.08, ph: 0.05, sp: 1.0, s: 35, sw: 18, c: 0 },
  { x: 0.22, ph: 0.55, sp: 0.8, s: 26, sw: 13, c: 1 },
  { x: 0.36, ph: 0.3, sp: 1.15, s: 42, sw: 23, c: 0 },
  { x: 0.5, ph: 0.8, sp: 0.9, s: 29, sw: 16, c: 2 },
  { x: 0.64, ph: 0.15, sp: 1.05, s: 38, sw: 21, c: 1 },
  { x: 0.78, ph: 0.65, sp: 0.85, s: 26, sw: 13, c: 0 },
  { x: 0.92, ph: 0.4, sp: 1.1, s: 35, sw: 18, c: 2 },
  { x: 0.14, ph: 0.9, sp: 0.75, s: 22, sw: 10, c: 2 },
  { x: 0.44, ph: 0.7, sp: 0.7, s: 22, sw: 10, c: 1 },
  { x: 0.7, ph: 0.95, sp: 0.95, s: 32, sw: 16, c: 0 },
  { x: 0.86, ph: 0.25, sp: 0.8, s: 24, sw: 12, c: 1 },
  { x: 0.3, ph: 0.45, sp: 1.2, s: 29, sw: 16, c: 2 },
];
const COLORS: Record<Kind, readonly string[]> = {
  hearts: ['#E4327D', '#FF7FB0', '#EFEDF9'],
  petals: ['#FFB3D1', '#EFEDF9', '#FFD6E7'],
};

function useClock(): SharedValue<number> {
  const t = useSharedValue(0);
  useStopWhenScreenLeaves(t);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: CYCLE_MS * 4, easing: Easing.linear, reduceMotion: ReduceMotion.System }),
      -1, false, undefined, ReduceMotion.System,
    );
    return () => cancelAnimation(t);
  }, [t]);
  return t;
}

export function SeasonParticles({ kind, width, height }: { kind: Kind; width: number; height: number }) {
  const t = useClock();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {PARTICLES.map((p, i) => (
        <Particle key={i} kind={kind} p={p} t={t} width={width} height={height} />
      ))}
    </View>
  );
}

function Particle({ kind, p, t, width, height }: {
  kind: Kind; p: (typeof PARTICLES)[number]; t: SharedValue<number>; width: number; height: number;
}) {
  const up = kind === 'hearts'; // hearts rise like balloons, petals fall
  const travel = height + 2 * p.s + 40;
  const style = useAnimatedStyle(() => {
    const k = (t.value * 4 * p.sp + p.ph) % 1; // the clock repeats every 4 cycles (20.8 s), long after the intro
    const y = up ? height + p.s - k * travel : -2 * p.s + k * travel;
    const sway = Math.sin((k * 2 + p.ph) * Math.PI * 2) * p.sw;
    const fade = Math.min(1, k * 8, (1 - k) * 8); // soft in and out at the edges of the cycle
    return {
      opacity: 0.9 * fade,
      transform: [{ translateX: p.x * width + sway }, { translateY: y }, { rotate: `${(up ? sway : k * 540) | 0}deg` }],
    };
  });
  const color = COLORS[kind][p.c];
  return (
    <Animated.View style={[styles.particle, { width: p.s, height: p.s }, style]}>
      <Svg width={p.s} height={p.s} viewBox="0 0 24 24">
        {up ? (
          <Path d={HEART} fill={color} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
        ) : (
          <Ellipse cx={12} cy={12} rx={6} ry={10} fill={color} stroke={INK} strokeWidth={1.4} />
        )}
      </Svg>
    </Animated.View>
  );
}

/** Summer: slow sun rays behind Buddy. One static Svg turned by a transform; opacity follows the lockup's rise. */
export function SunRays({ size, cy, lift }: { size: number; cy: number; lift: SharedValue<number> }) {
  const t = useClock();
  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + 0.4 * lift.value,
    transform: [{ rotate: `${t.value * 4 * 30}deg` }], // 30 deg per cycle: a slow turn
  }));
  const r = size / 2;
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a0 = ((i * 30 - 6) * Math.PI) / 180, a1 = ((i * 30 + 6) * Math.PI) / 180;
    return `M${r} ${r} L${r + r * Math.cos(a0)} ${r + r * Math.sin(a0)} L${r + r * Math.cos(a1)} ${r + r * Math.sin(a1)} Z`;
  }).join(' ');
  return (
    <Animated.View pointerEvents="none" style={[styles.rays, { width: size, height: size, top: cy - r, marginLeft: -r }, style]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          {/* Soft sun: bright at Buddy, gone before the rays' tips, so the edges never read as a pinwheel. */}
          <RadialGradient id="sun" cx="50%" cy="50%" r="50%">
            <Stop offset="0.15" stopColor="#FFE08A" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#FFE08A" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Path d={rays} fill="url(#sun)" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  particle: { position: 'absolute', left: 0, top: 0 },
  rays: { position: 'absolute', left: '50%' },
});
