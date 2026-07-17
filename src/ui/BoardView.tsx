import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolateColor,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';
import { ArrowPath, BoardLogic } from '../core';
import { arrowArt, slitherPath, SlitherPath, STROKE } from './arrowGeometry';
import { Palette } from './theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

/** Board pixel size of one grid cell (the viewport scales, so this is arbitrary). */
export const CELL = 40;

// Pan/zoom feel, ported from BoardPanZoom.cs.
const MAX_ZOOM_FACTOR = 3.5; // max zoom in, relative to fit-to-view
const FIT_MARGIN = 0.94; // small border when fully zoomed out

export interface BoardViewProps {
  board: BoardLogic;
  palette: Palette;
  /** An arrow left the board. `cleared` = it was the last one. */
  onRemoved: (cleared: boolean) => void;
  /** A blocked arrow was tapped (costs a heart). */
  onBlocked: () => void;
  /** Ignore taps (win/lose overlay up). */
  locked: boolean;
  /** Arrow to pulse as a hint (ArrowTile.Highlight), keyed to retrigger. */
  hint: { arrow: ArrowPath; id: number } | null;
  clearHint: () => void;
}

interface ExitingTrail {
  id: number;
  path: SlitherPath;
}

/**
 * The playable board: black line-art arrows (rounded polyline + solid
 * triangular head, per UIFactory), slither-exit and blocked-shake feedback
 * (SlitherExit / ArrowTile), inside a fit-to-view pinch/pan/wheel viewport
 * (BoardPanZoom).
 */
export function BoardView({ board, palette, onRemoved, onBlocked, locked, hint, clearHint }: BoardViewProps) {
  const boardW = board.cols * CELL;
  const boardH = board.rows * CELL;

  const [, setTick] = useState(0);
  const [exiting, setExiting] = useState<ExitingTrail[]>([]);
  const [shaking, setShaking] = useState<{ arrow: ArrowPath; id: number } | null>(null);
  const nextId = useRef(1);
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  // ---- pan / zoom ------------------------------------------------------

  const scale = useSharedValue(0); // 0 until the first layout fits the board
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const minScale = useSharedValue(1);
  const maxScale = useSharedValue(1);
  const pinchStart = useSharedValue(1);
  const viewport = useSharedValue({ w: 0, h: 0 });

  const clampPos = useCallback(() => {
    'worklet';
    // Keep the (scaled) content covering the viewport; centre any axis smaller than it.
    const vw = viewport.value.w, vh = viewport.value.h;
    const sw = boardW * scale.value, sh = boardH * scale.value;
    tx.value = sw <= vw ? (vw - sw) / 2 : Math.min(0, Math.max(vw - sw, tx.value));
    ty.value = sh <= vh ? (vh - sh) / 2 : Math.min(0, Math.max(vh - sh, ty.value));
  }, [boardW, boardH]);

  const zoomAround = useCallback((fx: number, fy: number, target: number) => {
    'worklet';
    // The board point under the focus stays fixed across the zoom.
    const s2 = Math.min(maxScale.value, Math.max(minScale.value, target));
    const k = s2 / scale.value;
    tx.value = fx - (fx - tx.value) * k;
    ty.value = fy - (fy - ty.value) * k;
    scale.value = s2;
    clampPos();
  }, [clampPos]);

  const onLayout = useCallback((e: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width: vw, height: vh } = e.nativeEvent.layout;
    if (vw < 1 || vh < 1) return;
    viewport.value = { w: vw, h: vh };
    // Fully zoomed out shows the whole board / shape; the player pinches in.
    const fit = Math.min(vw / boardW, vh / boardH) * FIT_MARGIN;
    minScale.value = fit;
    maxScale.value = fit * MAX_ZOOM_FACTOR;
    scale.value = fit;
    tx.value = (vw - boardW * fit) / 2;
    ty.value = (vh - boardH * fit) / 2;
  }, [boardW, boardH]);

  // ---- tap -> game move --------------------------------------------------

  const handleTap = useCallback((bx: number, by: number) => {
    if (lockedRef.current) return;
    const c = Math.floor(bx / CELL);
    const r = Math.floor(by / CELL);
    const owner = board.ownerAt(r, c);
    if (!owner) return;

    if (board.tryRemove(owner)) {
      const id = nextId.current++;
      const path = slitherPath(owner, CELL, board.rows, board.cols);
      setExiting((xs) => [...xs, { id, path }]);
      setTick((t) => t + 1);
      setTimeout(() => setExiting((xs) => xs.filter((x) => x.id !== id)), 420);
      onRemoved(board.isCleared());
    } else {
      setShaking({ arrow: owner, id: nextId.current++ });
      onBlocked();
    }
  }, [board, onRemoved, onBlocked]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(8)
      .maxPointers(1)
      .onChange((e) => {
        'worklet';
        tx.value += e.changeX;
        ty.value += e.changeY;
        clampPos();
      });

    const pinch = Gesture.Pinch()
      .onStart(() => {
        'worklet';
        pinchStart.value = scale.value;
      })
      .onUpdate((e) => {
        'worklet';
        zoomAround(e.focalX, e.focalY, pinchStart.value * e.scale);
      });

    const tap = Gesture.Tap()
      .maxDuration(400)
      .onEnd((e) => {
        'worklet';
        const bx = (e.x - tx.value) / scale.value;
        const by = (e.y - ty.value) / scale.value;
        runOnJS(handleTap)(bx, by);
      });

    // A drag that starts on an arrow pans instead of firing it; a clean tap
    // fires. Race (not Exclusive): on web the mouse-driven pinch never fails,
    // which would leave an Exclusive tap waiting forever.
    return Gesture.Race(tap, Gesture.Simultaneous(pan, pinch));
  }, [clampPos, zoomAround, handleTap]);

  // Mouse-wheel zoom on web (BoardPanZoom.OnScroll).
  const onWheel = useCallback((e: any) => {
    const ne = e.nativeEvent ?? e;
    const steps = Math.max(-3, Math.min(3, -(ne.deltaY ?? 0) / 100));
    const factor = 1 + steps * 0.12;
    const fx = ne.offsetX ?? viewport.value.w / 2;
    const fy = ne.offsetY ?? viewport.value.h / 2;
    zoomAround(fx, fy, scale.value * factor);
    e.preventDefault?.();
  }, [zoomAround]);

  const contentStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      left: 0,
      top: 0,
      width: boardW,
      height: boardH,
      transformOrigin: '0 0 0',
    }),
    [boardW, boardH],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={styles.viewport}
        onLayout={onLayout}
        {...(Platform.OS === 'web' ? ({ onWheel } as any) : null)}
      >
        <BoardContent
          contentStyle={contentStyle}
          scale={scale}
          tx={tx}
          ty={ty}
          boardW={boardW}
          boardH={boardH}
          board={board}
          palette={palette}
          exiting={exiting}
          shaking={shaking}
          clearShake={() => setShaking(null)}
          hint={hint}
          clearHint={clearHint}
        />
      </View>
    </GestureDetector>
  );
}

/** The transformed SVG board (split out so the animated style hook reads cleanly). */
function BoardContent(props: {
  contentStyle: object;
  scale: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  boardW: number;
  boardH: number;
  board: BoardLogic;
  palette: Palette;
  exiting: ExitingTrail[];
  shaking: { arrow: ArrowPath; id: number } | null;
  clearShake: () => void;
  hint: { arrow: ArrowPath; id: number } | null;
  clearHint: () => void;
}) {
  const { contentStyle, scale, tx, ty, boardW, boardH, board, palette, exiting, shaking, clearShake, hint, clearHint } = props;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View style={[contentStyle, animatedStyle]}>
      <Svg width={boardW} height={boardH} viewBox={`0 0 ${boardW} ${boardH}`}>
        {board.arrows().map((arrow) => {
          if (shaking && shaking.arrow === arrow) {
            return (
              <ShakingArrow
                key={`s${shaking.id}`}
                arrow={arrow}
                palette={palette}
                onDone={clearShake}
              />
            );
          }
          if (hint && hint.arrow === arrow) {
            return (
              <HintArrow
                key={`h${hint.id}`}
                arrow={arrow}
                palette={palette}
                onDone={clearHint}
              />
            );
          }
          return <StaticArrow key={arrow.toLine()} arrow={arrow} ink={palette.ink} />;
        })}
        {exiting.map((x) => (
          <ExitTrail key={x.id} path={x.path} ink={palette.ink} />
        ))}
      </Svg>
    </Animated.View>
  );
}

function StaticArrow({ arrow, ink }: { arrow: ArrowPath; ink: string }) {
  const art = useMemo(() => arrowArt(arrow, CELL), [arrow]);
  return (
    <G>
      <Path
        d={art.shaftD}
        stroke={ink}
        strokeWidth={STROKE * CELL}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path d={art.headD} fill={ink} />
    </G>
  );
}

/**
 * Blocked feedback (ArrowTile.PlayShake): decaying horizontal shake, red
 * flash settling back to ink, ~0.3 s.
 */
function ShakingArrow({ arrow, palette, onDone }: { arrow: ArrowPath; palette: Palette; onDone: () => void }) {
  const art = useMemo(() => arrowArt(arrow, CELL), [arrow]);
  const k = useSharedValue(0);

  React.useEffect(() => {
    k.value = 0;
    k.value = withTiming(1, { duration: 300, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(onDone)();
    });
  }, [arrow]);

  const gProps = useAnimatedProps(() => {
    const t = k.value * 0.3; // seconds, matching Unity's Time.time-based sin
    const dx = Math.sin(t * 70) * 0.4 * CELL * (1 - k.value); // decaying side-to-side
    return { x: dx } as any;
  });

  const colorAt = (kv: number) => {
    'worklet';
    const e = 1 - (1 - kv) * (1 - kv); // easeOutQuad: flash red, settle to ink
    return interpolateColor(e, [0, 1], [palette.heart, palette.ink]);
  };

  const shaftProps = useAnimatedProps(() => ({ stroke: colorAt(k.value) }));
  const headProps = useAnimatedProps(() => ({ fill: colorAt(k.value) }));

  return (
    <AnimatedG animatedProps={gProps}>
      <AnimatedPath
        d={art.shaftD}
        animatedProps={shaftProps}
        strokeWidth={STROKE * CELL}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <AnimatedPath d={art.headD} animatedProps={headProps} />
    </AnimatedG>
  );
}

/**
 * Hint feedback (ArrowTile.Highlight): the suggested arrow pulses in the
 * accent colour with a gentle swell (~1.5 decaying pulses over 1.1 s),
 * settling back to ink. The arrow stays tappable throughout — the pulse is
 * drawing only.
 */
function HintArrow({ arrow, palette, onDone }: { arrow: ArrowPath; palette: Palette; onDone: () => void }) {
  const art = useMemo(() => arrowArt(arrow, CELL), [arrow]);
  const k = useSharedValue(0);

  React.useEffect(() => {
    k.value = 0;
    k.value = withTiming(1, { duration: 1100, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(onDone)();
    });
  }, [arrow]);

  const pulseAt = (kv: number) => {
    'worklet';
    return Math.abs(Math.sin(kv * Math.PI * 3)) * (1 - kv); // ~1.5 decaying pulses
  };

  const shaftProps = useAnimatedProps(() => {
    const pulse = pulseAt(k.value);
    return {
      stroke: interpolateColor(pulse, [0, 1], [palette.ink, palette.accent]),
      strokeWidth: STROKE * CELL * (1 + 0.3 * pulse), // the swell
    };
  });
  const headProps = useAnimatedProps(() => ({
    fill: interpolateColor(pulseAt(k.value), [0, 1], [palette.ink, palette.accent]),
  }));

  return (
    <G>
      <AnimatedPath
        d={art.shaftD}
        animatedProps={shaftProps}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <AnimatedPath d={art.headD} animatedProps={headProps} />
    </G>
  );
}

/**
 * Slither exit (SlitherExit.cs): a dash the length of the arrow body flows
 * head-first along the arrow's own centerline and continues straight off the
 * board, accelerating out and fading past 55%. The arrowhead stays on,
 * leading the trail — everything past the head is a straight ray, so the head
 * is a pure translation along the exit direction. The SVG is clipped to the
 * board, so head and trail vanish exactly at the edge.
 */
function ExitTrail({ path, ink }: { path: SlitherPath; ink: string }) {
  const k = useSharedValue(0);

  React.useEffect(() => {
    k.value = withTiming(1, { duration: 340, easing: Easing.linear });
  }, []);

  const fadeAt = (kk: number) => {
    'worklet';
    if (kk < 0.55) return 1;
    const f = (kk - 0.55) / 0.45;
    return 1 - f * f * (3 - 2 * f); // smoothstep fade
  };

  const trailProps = useAnimatedProps(() => {
    const kk = k.value;
    const travelled = kk * kk * path.totalLen; // accelerate out
    return { strokeDashoffset: -travelled, opacity: fadeAt(kk) };
  });

  // The head's motion is a pure translation along the exit ray, but web SVG
  // paths have no x/y transform props — so rebuild the 3-point path each
  // frame. No fade on the head: the board edge clips it as it slides off,
  // which is exactly how leaving should look.
  const headProps = useAnimatedProps(() => {
    const travelled = k.value * k.value * path.totalLen;
    const dx = path.dir.x * travelled;
    const dy = path.dir.y * travelled;
    const t = path.headTip, l = path.headBaseL, r = path.headBaseR;
    return {
      d:
        `M${t.x + dx} ${t.y + dy} ` +
        `L${l.x + dx} ${l.y + dy} ` +
        `L${r.x + dx} ${r.y + dy} Z`,
    };
  });

  return (
    <G>
      <AnimatedPath
        d={path.d}
        animatedProps={trailProps}
        stroke={ink}
        strokeWidth={0.26 * CELL} // the bead tube's diameter
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={`${path.bodyLen} ${path.totalLen + path.bodyLen}`}
      />
      <AnimatedPath animatedProps={headProps} fill={ink} />
    </G>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    overflow: 'hidden',
  },
});
