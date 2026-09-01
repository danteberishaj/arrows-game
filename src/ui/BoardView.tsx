import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolateColor,
  runOnJS,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { ArrowPath, BoardLogic } from '../core';
import { PERF_MODE } from '../perfMode';
import {
  arrowArt,
  BoardArrowArtCache,
  slitherPath,
  SlitherPath,
  STROKE,
} from './arrowGeometry';
import {
  EXIT_TRAIL_CLEANUP_MS,
  EXIT_TRAIL_DURATION_MS,
  MAX_CONCURRENT_EXIT_TRAILS,
  exitAnimationKind,
} from './exitAnimationConfig';
import { StaticBoardSurface } from './StaticBoardSurface';
import type { NativeExitAnimation } from './StaticBoardSurface.types';
import { Palette } from './theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

/** Board pixel size of one grid cell (the viewport scales, so this is arbitrary). */
export const CELL = 40;

// Pan/zoom feel, ported from BoardPanZoom.cs.
const MAX_ZOOM_FACTOR = 3.5; // max zoom in, relative to fit-to-view
const FIT_MARGIN = 0.94; // small border when fully zoomed out
const PERF_NO_EXIT_TRAILS =
  PERF_MODE && process.env.EXPO_PUBLIC_PERF_NO_EXIT_TRAILS === '1';

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
  /** Stable native identifier used only by the release benchmark driver. */
  testID?: string;
}

interface ExitingTrail {
  id: number;
  path: SlitherPath;
  reducedMotion: boolean;
}

interface ShakingArrowState {
  arrow: ArrowPath;
  id: number;
}

/**
 * The playable board: black line-art arrows (rounded polyline + solid
 * triangular head, per UIFactory), slither-exit and blocked-shake feedback
 * (SlitherExit / ArrowTile), inside a fit-to-view pinch/pan/wheel viewport
 * (BoardPanZoom).
 */
export function BoardView({
  board,
  palette,
  onRemoved,
  onBlocked,
  locked,
  hint,
  clearHint,
  testID,
}: BoardViewProps) {
  const boardW = board.cols * CELL;
  const boardH = board.rows * CELL;

  const [exiting, setExiting] = useState<(ExitingTrail | null)[]>(() =>
    Array.from({ length: MAX_CONCURRENT_EXIT_TRAILS }, () => null),
  );
  const [nativeExitAnimation, setNativeExitAnimation] =
    useState<NativeExitAnimation | null>(null);
  const [shaking, setShaking] = useState<ShakingArrowState | null>(null);
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  const nextId = useRef(1);
  const nextExitSlot = useRef(0);
  const exitCleanupTimers = useRef<(ReturnType<typeof setTimeout> | null)[]>(
    Array.from({ length: MAX_CONCURRENT_EXIT_TRAILS }, () => null),
  ).current;
  const shakeCleanupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakingRef = useRef<ShakingArrowState | null>(null);
  const boardRef = useRef(board);
  const lockedRef = useRef(locked);
  const arrowArtCache = useMemo(
    () => new BoardArrowArtCache(board.arrows(), CELL),
    [board],
  );
  const reducedMotion = useReducedMotion();
  boardRef.current = board;
  lockedRef.current = locked;

  React.useEffect(() => () => {
    for (const timer of exitCleanupTimers) {
      if (timer !== null) clearTimeout(timer);
    }
    if (shakeCleanupTimer.current !== null) clearTimeout(shakeCleanupTimer.current);
  }, []);

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

  const fitToViewport = useCallback((vw: number, vh: number) => {
    if (vw < 1 || vh < 1) return;
    viewport.value = { w: vw, h: vh };
    // Fully zoomed out shows the whole board / shape; the player pinches in.
    const fit = Math.min(vw / boardW, vh / boardH) * FIT_MARGIN;
    minScale.value = fit;
    maxScale.value = fit * MAX_ZOOM_FACTOR;
    pinchStart.value = fit;
    scale.value = fit;
    tx.value = (vw - boardW * fit) / 2;
    ty.value = (vh - boardH * fit) / 2;
  }, [boardW, boardH]);

  React.useLayoutEffect(() => {
    for (let slot = 0; slot < exitCleanupTimers.length; slot += 1) {
      const timer = exitCleanupTimers[slot];
      if (timer !== null) clearTimeout(timer);
      exitCleanupTimers[slot] = null;
    }
    if (shakeCleanupTimer.current !== null) {
      clearTimeout(shakeCleanupTimer.current);
      shakeCleanupTimer.current = null;
    }
    shakingRef.current = null;
    nextExitSlot.current = 0;
    setExiting((current) => current.some((trail) => trail !== null)
      ? current.map(() => null)
      : current);
    setNativeExitAnimation(null);
    setShaking(null);
    const measuredViewport = viewport.value;
    fitToViewport(measuredViewport.w, measuredViewport.h);
  }, [board, fitToViewport]);

  const onLayout = useCallback((e: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width: vw, height: vh } = e.nativeEvent.layout;
    if (vw < 1 || vh < 1) return;
    setViewportSize((current) =>
      current.w === vw && current.h === vh ? current : { w: vw, h: vh },
    );
    fitToViewport(vw, vh);
  }, [fitToViewport]);

  // Centre the viewport on the hint arrow (BoardPanZoom.FocusOn) — on a
  // zoomed-in board the pulse would otherwise happen off-screen.
  React.useEffect(() => {
    if (!hint) return;
    const a = hint.arrow;
    const cx = ((a.minCol + a.maxCol + 1) / 2) * CELL;
    const cy = ((a.minRow + a.maxRow + 1) / 2) * CELL;
    const s = scale.value;
    const { w: vw, h: vh } = viewport.value;
    if (vw < 1 || vh < 1) return;
    const sw = boardW * s, sh = boardH * s;
    let txT = vw / 2 - cx * s;
    let tyT = vh / 2 - cy * s;
    txT = sw <= vw ? (vw - sw) / 2 : Math.min(0, Math.max(vw - sw, txT));
    tyT = sh <= vh ? (vh - sh) / 2 : Math.min(0, Math.max(vh - sh, tyT));
    tx.value = withTiming(txT, { duration: 280, easing: Easing.out(Easing.cubic) });
    ty.value = withTiming(tyT, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [hint, boardW, boardH]);

  // ---- tap -> game move --------------------------------------------------

  const handleTap = useCallback((bx: number, by: number) => {
    // Drop a UI-thread tap that reached JS after Next/Retry replaced the
    // mission; its closure still points at the previous mutable board.
    if (lockedRef.current || boardRef.current !== board) return;
    const c = Math.floor(bx / CELL);
    const r = Math.floor(by / CELL);
    const owner = board.ownerAt(r, c);
    if (!owner) return;

    if (board.tryRemove(owner)) {
      if (hint && hint.arrow === owner) clearHint();
      if (shakingRef.current?.arrow === owner) {
        if (shakeCleanupTimer.current !== null) {
          clearTimeout(shakeCleanupTimer.current);
          shakeCleanupTimer.current = null;
        }
        shakingRef.current = null;
        setShaking(null);
      }
      const id = nextId.current++;
      const animationKind = exitAnimationKind(
        PERF_NO_EXIT_TRAILS,
        board.count(),
        Platform.OS !== 'web',
      );
      if (animationKind === 'native-launch') {
        const arrowIndex = arrowArtCache.indexFor(owner);
        if (arrowIndex !== null) {
          setNativeExitAnimation({
            id,
            arrowIndex,
            durationMs: EXIT_TRAIL_DURATION_MS,
            reducedMotion,
          });
        }
      } else if (animationKind === 'slither') {
        const path = slitherPath(owner, CELL, board.rows, board.cols);
        const slot = nextExitSlot.current;
        nextExitSlot.current = (slot + 1) % MAX_CONCURRENT_EXIT_TRAILS;
        const previousTimer = exitCleanupTimers[slot];
        if (previousTimer !== null) clearTimeout(previousTimer);
        setExiting((current) => {
          const next = [...current];
          next[slot] = { id, path, reducedMotion };
          return next;
        });
        const timer = setTimeout(() => {
          if (exitCleanupTimers[slot] === timer) {
            exitCleanupTimers[slot] = null;
          }
          setExiting((current) => {
            if (current[slot]?.id !== id) return current;
            const next = [...current];
            next[slot] = null;
            return next;
          });
        }, EXIT_TRAIL_CLEANUP_MS);
        exitCleanupTimers[slot] = timer;
      }
      onRemoved(board.isCleared());
    } else {
      const id = nextId.current++;
      const nextShaking = { arrow: owner, id };
      shakingRef.current = nextShaking;
      setShaking(nextShaking);
      if (shakeCleanupTimer.current !== null) {
        clearTimeout(shakeCleanupTimer.current);
      }
      const timer = setTimeout(() => {
        if (shakeCleanupTimer.current === timer) shakeCleanupTimer.current = null;
        setShaking((current) => {
          if (current?.id !== id) return current;
          shakingRef.current = null;
          return null;
        });
      }, 340);
      shakeCleanupTimer.current = timer;
      onBlocked();
    }
  }, [
    arrowArtCache,
    board,
    clearHint,
    hint,
    onBlocked,
    onRemoved,
    reducedMotion,
  ]);

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
      .onEnd((e, success) => {
        'worklet';
        if (!success) return;
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

  return (
    <GestureDetector gesture={gesture}>
      <View
        testID={testID}
        accessible={testID ? true : undefined}
        accessibilityLabel={testID}
        collapsable={testID ? false : undefined}
        style={styles.viewport}
        onLayout={onLayout}
        {...(Platform.OS === 'web' ? ({ onWheel } as any) : null)}
      >
        <BoardContent
          scale={scale}
          tx={tx}
          ty={ty}
          viewportW={viewportSize.w}
          viewportH={viewportSize.h}
          boardW={boardW}
          boardH={boardH}
          board={board}
          arrowArtCache={arrowArtCache}
          palette={palette}
          exiting={exiting}
          nativeExitAnimation={nativeExitAnimation}
          shaking={shaking}
          hint={hint}
        />
      </View>
    </GestureDetector>
  );
}

/** GPU-backed board plus a web-only SVG layer for active feedback. */
function BoardContent(props: {
  scale: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  viewportW: number;
  viewportH: number;
  boardW: number;
  boardH: number;
  board: BoardLogic;
  arrowArtCache: BoardArrowArtCache;
  palette: Palette;
  exiting: (ExitingTrail | null)[];
  nativeExitAnimation: NativeExitAnimation | null;
  shaking: ShakingArrowState | null;
  hint: { arrow: ArrowPath; id: number } | null;
}) {
  const {
    scale,
    tx,
    ty,
    viewportW,
    viewportH,
    boardW,
    boardH,
    board,
    arrowArtCache,
    palette,
    exiting,
    nativeExitAnimation,
    shaking,
    hint,
  } = props;

  const arrowCount = board.count();
  const excludedArrows = useMemo(() => {
    const excluded = new Set<ArrowPath>();
    if (shaking) excluded.add(shaking.arrow);
    if (hint) excluded.add(hint.arrow);
    return excluded;
  }, [shaking?.arrow, hint?.arrow]);
  const arrows = board.arrows();
  const staticArt = useMemo(
    () => Platform.OS === 'web'
      ? arrowArtCache.batch(arrows, excludedArrows)
      : { shaftD: '', headD: '' },
    [arrows, arrowArtCache, arrowCount, excludedArrows],
  );
  const nativeGeometry = useMemo(
    () => arrowArtCache.geometryForNativeView(),
    [arrowArtCache],
  );
  const nativeVisibilityMask = useMemo(
    () => arrowArtCache.visibilityMask(arrows, excludedArrows),
    [arrows, arrowArtCache, arrowCount, excludedArrows],
  );
  const hasDynamicLayer =
    shaking !== null || hint !== null || exiting.some((trail) => trail !== null);
  const shakingArt = shaking ? { id: shaking.id, ...arrowArtCache.artFor(shaking.arrow) } : null;
  const hintArt = hint ? { id: hint.id, ...arrowArtCache.artFor(hint.arrow) } : null;

  return (
    <>
      <StaticBoardSurface
        scale={scale}
        tx={tx}
        ty={ty}
        viewportW={viewportW}
        viewportH={viewportH}
        boardW={boardW}
        boardH={boardH}
        shaftD={staticArt.shaftD}
        headD={staticArt.headD}
        nativeGeometry={nativeGeometry}
        nativeVisibilityMask={nativeVisibilityMask}
        background={palette.bg}
        ink={palette.ink}
        accent={palette.accent}
        heart={palette.heart}
        cellSize={CELL}
        strokeWidth={STROKE * CELL}
        shaking={shakingArt}
        hint={hintArt}
        exiting={exiting}
        nativeExitAnimation={nativeExitAnimation}
      />
      {Platform.OS === 'web' && hasDynamicLayer && (
        <WebDynamicBoardLayer
          scale={scale}
          tx={tx}
          ty={ty}
          viewportW={viewportW}
          viewportH={viewportH}
          boardW={boardW}
          boardH={boardH}
          palette={palette}
          exiting={exiting}
          shaking={shaking}
          hint={hint}
        />
      )}
    </>
  );
}

/** Web-only feedback layer. Keeping its animated SVG mapper inside this child
 * prevents native pan/zoom from evaluating an unused transform string. */
function WebDynamicBoardLayer({
  scale,
  tx,
  ty,
  viewportW,
  viewportH,
  boardW,
  boardH,
  palette,
  exiting,
  shaking,
  hint,
}: {
  scale: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  viewportW: number;
  viewportH: number;
  boardW: number;
  boardH: number;
  palette: Palette;
  exiting: (ExitingTrail | null)[];
  shaking: ShakingArrowState | null;
  hint: { arrow: ArrowPath; id: number } | null;
}) {
  const boardProps = useAnimatedProps(() => ({
    transform: `translate(${tx.value}, ${ty.value}) scale(${scale.value})`,
  }) as any);

  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox={`0 0 ${Math.max(1, viewportW)} ${Math.max(1, viewportH)}`}
      preserveAspectRatio="none"
    >
      <Defs>
        <ClipPath id="dynamic-board-clip">
          <Rect x={0} y={0} width={boardW} height={boardH} />
        </ClipPath>
      </Defs>
      <AnimatedG animatedProps={boardProps}>
        <G clipPath="url(#dynamic-board-clip)">
          {shaking && (
            <ShakingArrow
              key={`s${shaking.id}`}
              arrow={shaking.arrow}
              id={shaking.id}
              palette={palette}
            />
          )}
          {hint && <HintArrow key={`h${hint.id}`} arrow={hint.arrow} palette={palette} />}
          {exiting.filter((trail): trail is ExitingTrail => trail !== null).map((trail) => (
            <ExitTrail
              key={trail.id}
              path={trail.path}
              ink={palette.ink}
              reducedMotion={trail.reducedMotion}
            />
          ))}
        </G>
      </AnimatedG>
    </Svg>
  );
}

/**
 * Blocked feedback (ArrowTile.PlayShake): decaying horizontal shake, red
 * flash settling back to ink, ~0.3 s.
 */
function ShakingArrow({
  arrow,
  id,
  palette,
}: {
  arrow: ArrowPath;
  id: number;
  palette: Palette;
}) {
  const art = useMemo(() => arrowArt(arrow, CELL), [arrow]);
  const k = useSharedValue(0);

  React.useEffect(() => {
    k.value = 0;
    k.value = withTiming(1, { duration: 300, easing: Easing.linear });
  }, [id]);

  const gProps = useAnimatedProps(() => {
    const t = k.value * 0.3; // seconds, matching Unity's Time.time-based sin
    const dx = Math.sin(t * 70) * 0.4 * CELL * (1 - k.value); // decaying side-to-side
    // transform string, not x/y props: <g> has no x attribute on web SVG.
    return { transform: `translate(${dx}, 0)` } as any;
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
 * Hint feedback (ArrowTile.Highlight): the suggested arrow turns solid
 * accent with a breathing stroke swell that settles after a moment — but the
 * accent tint STAYS until the arrow is fired, so the player never loses
 * track of the paid-for suggestion. The tint is a static prop on purpose —
 * even if animated attribute updates fail on some renderer, the hint still
 * visibly lights up. The arrow stays tappable throughout.
 */
function HintArrow({ arrow, palette }: { arrow: ArrowPath; palette: Palette }) {
  const art = useMemo(() => arrowArt(arrow, CELL), [arrow]);
  const k = useSharedValue(0);

  React.useEffect(() => {
    k.value = 0;
    k.value = withTiming(1, { duration: 1600, easing: Easing.linear });
  }, [arrow]);

  const shaftProps = useAnimatedProps(() => {
    const pulse = Math.abs(Math.sin(k.value * Math.PI * 4)) * (1 - k.value * 0.6);
    return { strokeWidth: STROKE * CELL * (1 + 0.45 * pulse) }; // the swell
  });

  return (
    <G>
      <AnimatedPath
        d={art.shaftD}
        animatedProps={shaftProps}
        stroke={palette.accent}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path d={art.headD} fill={palette.accent} />
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
function ExitTrail({
  path,
  ink,
  reducedMotion,
}: {
  path: SlitherPath;
  ink: string;
  reducedMotion: boolean;
}) {
  const k = useSharedValue(0);

  React.useEffect(() => {
    k.value = 0;
    k.value = withTiming(1, { duration: EXIT_TRAIL_DURATION_MS, easing: Easing.linear });
  }, []);

  const fadeAt = (kk: number) => {
    'worklet';
    if (kk < 0.55) return 1;
    const f = (kk - 0.55) / 0.45;
    return 1 - f * f * (3 - 2 * f); // smoothstep fade
  };

  const trailProps = useAnimatedProps(() => {
    const kk = k.value;
    const travelled = reducedMotion ? 0 : kk * kk * path.totalLen;
    return {
      strokeDashoffset: -travelled,
      opacity: reducedMotion ? 1 - kk : fadeAt(kk),
    };
  });

  const headTransformProps = useAnimatedProps(() => {
    const travelled = reducedMotion ? 0 : k.value * k.value * path.totalLen;
    const dx = path.dir.x * travelled;
    const dy = path.dir.y * travelled;
    return { transform: `translate(${dx}, ${dy})` } as any;
  });
  const headD = useMemo(() => {
    const t = path.headTip, l = path.headBaseL, r = path.headBaseR;
    return `M${t.x} ${t.y} L${l.x} ${l.y} L${r.x} ${r.y} Z`;
  }, [path]);

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
      <AnimatedG animatedProps={headTransformProps}>
        <Path d={headD} fill={ink} />
      </AnimatedG>
    </G>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    overflow: 'hidden',
  },
});
