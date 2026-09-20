import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  ReduceMotion,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDecay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { ArrowPath, BoardLogic } from '../core';
import { PERF_MODE } from '../perfMode';
import type { TapOutcome } from '../telemetry/levelAggregator';
import {
  arrowArt,
  BoardArrowArtCache,
  dirVec,
  slitherPath,
  SlitherPath,
  STROKE,
} from './arrowGeometry';
import {
  EXIT_TRAIL_CLEANUP_MARGIN_MS,
  EXIT_TRAIL_STROKE_CELLS,
  MAX_CONCURRENT_EXIT_TRAILS,
  exitAnimationKind,
  exitTrailDurationMs,
} from './exitAnimationConfig';
import {
  BLOCKED_BUMP_MS,
  BLOCKER_FLASH_MS, FEEDBACK_CLEANUP_MARGIN_MS,
  blockedBumpAt,
  blockedFlashMixAt,
  blockerOpacityAt,
  blockerStrokeSwellAt,
  hintStrokeSwellAt,
  PRESSED_STROKE_SWELL,
} from './feedbackCurves';
import { FirstPaintCleanupTimer } from './firstPaintCleanup';
import { ArrowHitTester, TAP_RADIUS_PT } from './hitTest';
import { StaticBoardSurface } from './StaticBoardSurface';
import type { NativeExitAnimation } from './StaticBoardSurface.types';
import { BlockedTapLedger, isGhostTap, type RecentRemoval } from './tapRules';
import { Palette } from './theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

/** Board pixel size of one grid cell (the viewport scales, so this is arbitrary). */
export const CELL = 40;

// Pan/zoom feel, ported from BoardPanZoom.cs and then tuned for thumbs.
const MAX_ZOOM_FACTOR = 3.5; // max zoom in, relative to fit-to-view ...
/** ... but never less than this many screen points per cell: a 46-cell board
 * at 3.5x fit was still only 29 pt per cell, under every touch-target guide. */
const MAX_ZOOM_CELL_PT = 64;
const FIT_MARGIN = 0.94; // small border when fully zoomed out
/**
 * Once zoomed past the viewport the board can be pulled this far inward, so
 * an arrow on the board's edge can sit under the thumb instead of against
 * the bezel. Fully zoomed out the board stays centred.
 */
const EDGE_PAD_PT = 72;
/**
 * A tap has no distance limit of its own; the pan's activation distance IS
 * the tap slop. Android's own slop is 8 dp, but a thumb rolling on release
 * wobbles more than a stylus: 12 pt keeps such taps firing without making
 * the pan feel late.
 */
const PAN_SLOP_PT = 12;
/** A slow, deliberate press still counts as a tap (accessibility). */
const TAP_MAX_DURATION_MS = 900;
/**
 * The press preview appears only if the finger is still down after this
 * long (Android's own pressed-state delay is 64 ms). A quick tap resolves
 * its arrow at touch-down but never draws the preview, so rapid play costs
 * no extra render; a hesitant press sees which arrow will fire.
 */
const PRESS_PREVIEW_DELAY_MS = 64;
/** iOS scroll-view rubber band (x*d*c)/(d+c*x), c = 0.55, d = viewport size. */
const RUBBER_BAND_C = 0.55;
const PERF_NO_EXIT_TRAILS =
  PERF_MODE && process.env.EXPO_PUBLIC_PERF_NO_EXIT_TRAILS === '1';

/**
 * W6-01 measurement hook: times every rebuild of the native visibility mask
 * and logs `[mask] …` summary lines (docs/perf-mask-rebuild-2026-09-17.md).
 * Expo inlines EXPO_PUBLIC_* at build time, so a build without the variable
 * sees `undefined === '1'`, and the minifier drops the timed branch and its
 * log text (checked by grepping an `expo export` bundle for `[mask]`).
 */
const PERF_MASK_TIMING = process.env.EXPO_PUBLIC_PERF_MASK_TIMING === '1';
const MASK_TIMING_LOG_EVERY = 50;
/**
 * A PERF run force-stops the app between samples, so the board never
 * unmounts and a blocked-tap sample makes only 3 rebuilds. Log once the
 * rebuilds have been quiet this long: after both rebuilds of a blocked tap
 * (300 + 40 ms apart) and after the harness's 540 ms frame window.
 */
const MASK_TIMING_QUIET_LOG_MS = 750; // OWNER-PICKED STARTING VALUE
const maskTimingAllMs: number[] = [];
let maskTimingUnloggedMs: number[] = [];
let maskTimingClockStepMs = Infinity;
let maskTimingQuietTimer: ReturnType<typeof setTimeout> | null = null;

function logMaskTiming(reason: 'every-50' | 'quiet' | 'unmount'): void {
  if (maskTimingUnloggedMs.length === 0) return;
  const sorted = [...maskTimingAllMs].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
  const ms = (value: number | undefined) => value === undefined ? 'none' : value.toFixed(4);
  console.log(
    `[mask] n=${sorted.length} min=${ms(sorted[0])} ` +
    `minNonZero=${ms(sorted.find((value) => value > 0))} median=${ms(at(0.5))} ` +
    `p95=${ms(at(0.95))} max=${ms(sorted[sorted.length - 1])} ` +
    `clockStep=${maskTimingClockStepMs.toFixed(6)} reason=${reason} ` +
    `new=${maskTimingUnloggedMs.map((value) => value.toFixed(4)).join(',')}`,
  );
  maskTimingUnloggedMs = [];
}

function timeMaskBuild(build: () => string): string {
  const start = performance.now();
  const mask = build();
  const elapsedMs = performance.now() - start;
  maskTimingAllMs.push(elapsedMs);
  maskTimingUnloggedMs.push(elapsedMs);
  // Timer floor: the smallest step this clock can report.
  const probe = performance.now();
  let next = performance.now();
  while (next === probe) next = performance.now();
  maskTimingClockStepMs = Math.min(maskTimingClockStepMs, next - probe);
  if (maskTimingAllMs.length % MASK_TIMING_LOG_EVERY === 0) logMaskTiming('every-50');
  if (maskTimingQuietTimer !== null) clearTimeout(maskTimingQuietTimer);
  maskTimingQuietTimer = setTimeout(() => {
    maskTimingQuietTimer = null;
    logMaskTiming('quiet');
  }, MASK_TIMING_QUIET_LOG_MS);
  return mask;
}

/**
 * W6-06 direct timer around the one callback added to the hot tap path. The
 * build-time flag keeps the timing arrays and log text out of ordinary
 * bundles; the untimed branch calls the callback directly.
 */
const PERF_TELEMETRY_TIMING =
  process.env.EXPO_PUBLIC_PERF_TELEMETRY_TIMING === '1';
const TELEMETRY_TIMING_QUIET_LOG_MS = 750; // OWNER-PICKED STARTING VALUE
const telemetryTimingAllMs: number[] = [];
let telemetryTimingUnloggedMs: number[] = [];
let telemetryTimingQuietTimer: ReturnType<typeof setTimeout> | null = null;

function logTelemetryTiming(): void {
  if (telemetryTimingUnloggedMs.length === 0) return;
  const minNonZero = telemetryTimingAllMs.reduce(
    (minimum, value) => value > 0 && value < minimum ? value : minimum,
    Infinity,
  );
  console.log(
    `[telemetry-tap] n=${telemetryTimingAllMs.length} ` +
    `minNonZero=${Number.isFinite(minNonZero) ? minNonZero.toFixed(6) : 'none'} ` +
    `new=${telemetryTimingUnloggedMs.map((value) => value.toFixed(6)).join(',')}`,
  );
  telemetryTimingUnloggedMs = [];
}

function timeTapOutcome(
  callback: (outcome: TapOutcome) => void,
  outcome: TapOutcome,
): void {
  const start = performance.now();
  callback(outcome);
  const elapsedMs = performance.now() - start;
  telemetryTimingAllMs.push(elapsedMs);
  telemetryTimingUnloggedMs.push(elapsedMs);
  if (telemetryTimingQuietTimer !== null) clearTimeout(telemetryTimingQuietTimer);
  telemetryTimingQuietTimer = setTimeout(() => {
    telemetryTimingQuietTimer = null;
    logTelemetryTiming();
  }, TELEMETRY_TIMING_QUIET_LOG_MS);
}

export interface BoardViewProps {
  board: BoardLogic;
  palette: Palette;
  /** An arrow left the board. `cleared` = it was the last one. */
  onRemoved: (cleared: boolean) => void;
  /**
   * A blocked arrow was tapped. `costsHeart` is false when this arrow has
   * already been charged this level (a probe or an echoed touch, not a new
   * mistake): shake it, nudge the player, keep the heart.
   */
  onBlocked: (costsHeart: boolean) => void;
  /** One aggregate counter increment for every unlocked tap attempt. */
  onTapOutcome?: (outcome: TapOutcome) => void;
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
  durationMs: number;
  reducedMotion: boolean;
}

interface AnimatedArrowState {
  arrow: ArrowPath;
  id: number;
}

/** Pan range along one axis for content of `size` in a `viewport`. */
function panRange(size: number, viewport: number): [number, number] {
  'worklet';
  if (size <= viewport) {
    const centred = (viewport - size) / 2;
    return [centred, centred];
  }
  const pad = Math.min(EDGE_PAD_PT, viewport * 0.25);
  return [viewport - size - pad, pad];
}

/** Resist dragging past [lo, hi] the way a scroll view does. */
function rubberBand(value: number, lo: number, hi: number, dimension: number): number {
  'worklet';
  const d = Math.max(1, dimension);
  const band = (x: number) => (x * d * RUBBER_BAND_C) / (d + RUBBER_BAND_C * x);
  if (value < lo) return lo - band(lo - value);
  if (value > hi) return hi + band(value - hi);
  return value;
}

/**
 * The playable board: black line-art arrows (rounded polyline + solid
 * triangular head, per UIFactory), slither-exit and blocked-bump feedback
 * (SlitherExit / ArrowTile), inside a fit-to-view pinch/pan/wheel viewport
 * (BoardPanZoom) with momentum and rubber-band edges.
 *
 * Taps resolve to the arrow whose ink is nearest the finger within a
 * 44 pt disc (see hitTest.ts), preview that arrow on touch-down, and fire
 * it on release.
 */
export function BoardView({
  board,
  palette,
  onRemoved,
  onBlocked,
  onTapOutcome,
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
  const [shaking, setShaking] = useState<AnimatedArrowState | null>(null);
  const [blocker, setBlocker] = useState<AnimatedArrowState | null>(null);
  const [pressed, setPressed] = useState<AnimatedArrowState | null>(null);
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  const nextId = useRef(1);
  const nextExitSlot = useRef(0);
  const exitCleanupTimers = useRef<(ReturnType<typeof setTimeout> | null)[]>(
    Array.from({ length: MAX_CONCURRENT_EXIT_TRAILS }, () => null),
  ).current;
  const shakeCleanup = useRef(new FirstPaintCleanupTimer()).current;
  const blockerCleanup = useRef(new FirstPaintCleanupTimer()).current;
  const shakingRef = useRef<AnimatedArrowState | null>(null);
  const pressedRef = useRef<ArrowPath | null>(null);
  const nullTapOutcomeRef = useRef<Extract<TapOutcome, 'ghost' | 'miss'>>('miss');
  const pressPreviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRemoved = useRef<RecentRemoval | null>(null);
  const blockedLedger = useRef(new BlockedTapLedger()).current;
  const boardRef = useRef(board);
  const lockedRef = useRef(locked);
  const arrowArtCache = useMemo(
    () => new BoardArrowArtCache(board.arrows(), CELL),
    [board],
  );
  const hitTester = useMemo(() => new ArrowHitTester(board, CELL), [board]);
  const reducedMotion = useReducedMotion();
  boardRef.current = board;
  lockedRef.current = locked;

  React.useEffect(() => () => {
    for (const timer of exitCleanupTimers) {
      if (timer !== null) clearTimeout(timer);
    }
    shakeCleanup.clear();
    blockerCleanup.clear();
    if (pressPreviewTimer.current !== null) clearTimeout(pressPreviewTimer.current);
  }, []);

  React.useLayoutEffect(() => {
    if (shaking) shakeCleanup.committed(shaking.id);
    else shakeCleanup.clear();
  }, [shaking?.id, shakeCleanup]);

  React.useLayoutEffect(() => {
    if (blocker) blockerCleanup.committed(blocker.id);
    else blockerCleanup.clear();
  }, [blocker?.id, blockerCleanup]);

  // ---- pan / zoom ------------------------------------------------------

  const scale = useSharedValue(0); // 0 until the first layout fits the board
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const minScale = useSharedValue(1);
  const maxScale = useSharedValue(1);
  const pinchStart = useSharedValue({ scale: 1, tx: 0, ty: 0, fx: 0, fy: 0 });
  const panStart = useSharedValue({ tx: 0, ty: 0 });
  const viewport = useSharedValue({ w: 0, h: 0 });

  const clampPos = useCallback(() => {
    'worklet';
    // Keep the (scaled) content covering the viewport (plus the edge pad);
    // centre any axis smaller than it.
    const vw = viewport.value.w, vh = viewport.value.h;
    const [xlo, xhi] = panRange(boardW * scale.value, vw);
    const [ylo, yhi] = panRange(boardH * scale.value, vh);
    tx.value = Math.min(xhi, Math.max(xlo, tx.value));
    ty.value = Math.min(yhi, Math.max(ylo, ty.value));
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
    maxScale.value = Math.max(fit * MAX_ZOOM_FACTOR, MAX_ZOOM_CELL_PT / CELL);
    cancelAnimation(tx);
    cancelAnimation(ty);
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
    shakeCleanup.clear();
    blockerCleanup.clear();
    if (pressPreviewTimer.current !== null) {
      clearTimeout(pressPreviewTimer.current);
      pressPreviewTimer.current = null;
    }
    shakingRef.current = null;
    pressedRef.current = null;
    lastRemoved.current = null;
    blockedLedger.reset();
    nextExitSlot.current = 0;
    setExiting((current) => current.some((trail) => trail !== null)
      ? current.map(() => null)
      : current);
    setNativeExitAnimation(null);
    setShaking(null);
    setBlocker(null);
    setPressed(null);
    const measuredViewport = viewport.value;
    fitToViewport(measuredViewport.w, measuredViewport.h);
  }, [board, fitToViewport]);

  const onLayout = useCallback((e: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width: vw, height: vh } = e.nativeEvent.layout;
    if (vw < 1 || vh < 1) return;
    if (process.env.EXPO_PUBLIC_LOG_BOARD_VIEWPORT === '1') {
      console.log(`[board-viewport] w=${vw} h=${vh}`);
    }
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
    const [xlo, xhi] = panRange(boardW * s, vw);
    const [ylo, yhi] = panRange(boardH * s, vh);
    const txT = Math.min(xhi, Math.max(xlo, vw / 2 - cx * s));
    const tyT = Math.min(yhi, Math.max(ylo, vh / 2 - cy * s));
    cancelAnimation(tx);
    cancelAnimation(ty);
    // Vestibular horizontal recentring follows the player's system setting.
    tx.value = withTiming(txT, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
    // Vestibular vertical recentring follows the player's system setting.
    ty.value = withTiming(tyT, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [hint, boardW, boardH]);

  // ---- tap -> game move --------------------------------------------------

  /**
   * The arrow a touch at board point (bx, by) means, or null. `radius` is the
   * forgiveness disc in board units (screen points / zoom). A touch on the
   * spot an arrow just left is an echo and resolves to nothing.
   */
  const resolveTap = useCallback((bx: number, by: number, radius: number): ArrowPath | null => {
    const cell = { r: Math.floor(by / CELL), c: Math.floor(bx / CELL) };
    if (isGhostTap(board, lastRemoved.current, cell, Date.now())) {
      nullTapOutcomeRef.current = 'ghost';
      return null;
    }
    const hit = hitTester.nearest(bx, by, radius, (arrow) => board.canExit(arrow));
    if (hit === null) nullTapOutcomeRef.current = 'miss';
    return hit?.arrow ?? null;
  }, [board, hitTester]);

  /** Touch-down: resolve the arrow that will fire now (the finger's intent
   * point), and preview it if the press lasts, so the player can bail out
   * (drag to pan) before committing. */
  const handlePressStart = useCallback((bx: number, by: number, radius: number) => {
    if (lockedRef.current || boardRef.current !== board) return;
    const arrow = resolveTap(bx, by, radius);
    pressedRef.current = arrow;
    if (pressPreviewTimer.current !== null) clearTimeout(pressPreviewTimer.current);
    if (!arrow) return;
    const timer = setTimeout(() => {
      if (pressPreviewTimer.current !== timer) return;
      pressPreviewTimer.current = null;
      if (pressedRef.current !== arrow) return;
      setPressed({ arrow, id: nextId.current++ });
    }, PRESS_PREVIEW_DELAY_MS);
    pressPreviewTimer.current = timer;
  }, [board, resolveTap]);

  const handlePressEnd = useCallback(() => {
    if (pressPreviewTimer.current !== null) {
      clearTimeout(pressPreviewTimer.current);
      pressPreviewTimer.current = null;
    }
    pressedRef.current = null;
    setPressed((current) => (current === null ? current : null));
  }, []);

  const handleTap = useCallback((bx: number, by: number, radius: number) => {
    // Drop a UI-thread tap that reached JS after Next/Retry replaced the
    // mission; its closure still points at the previous mutable board.
    if (lockedRef.current || boardRef.current !== board) return;
    // What was highlighted at touch-down is what fires: the finger rolls a
    // little on release and must not slip onto a neighbour.
    const previewed = pressedRef.current;
    const owner = previewed && board.arrows().includes(previewed)
      ? previewed
      : resolveTap(bx, by, radius);
    if (!owner) {
      if (onTapOutcome) {
        if (PERF_TELEMETRY_TIMING) {
          timeTapOutcome(onTapOutcome, nullTapOutcomeRef.current);
        } else {
          onTapOutcome(nullTapOutcomeRef.current);
        }
      }
      return;
    }

    if (board.tryRemove(owner)) {
      if (onTapOutcome) {
        if (PERF_TELEMETRY_TIMING) timeTapOutcome(onTapOutcome, 'exit');
        else onTapOutcome('exit');
      }
      lastRemoved.current = { arrow: owner, at: Date.now() };
      if (hint && hint.arrow === owner) clearHint();
      if (shakingRef.current?.arrow === owner) {
        shakeCleanup.clear(shakingRef.current.id);
        shakingRef.current = null;
        setShaking(null);
      }
      setBlocker((current) => (current?.arrow === owner ? null : current));
      const id = nextId.current++;
      const animationKind = exitAnimationKind(
        PERF_NO_EXIT_TRAILS,
        Platform.OS !== 'web',
      );
      if (animationKind === 'native-slither') {
        // The retained board view already owns the arrowhead path; it only
        // needs the trail polyline, which is identical to the web slither.
        const arrowIndex = arrowArtCache.indexFor(owner);
        if (arrowIndex !== null) {
          const path = slitherPath(owner, CELL, board.rows, board.cols);
          setNativeExitAnimation({
            id,
            arrowIndex,
            durationMs: exitTrailDurationMs(path.totalLen * scale.value),
            reducedMotion,
            path,
            trailStrokeWidth: EXIT_TRAIL_STROKE_CELLS * CELL,
          });
        }
      } else if (animationKind === 'slither') {
        const path = slitherPath(owner, CELL, board.rows, board.cols);
        const durationMs = exitTrailDurationMs(path.totalLen * scale.value);
        const slot = nextExitSlot.current;
        nextExitSlot.current = (slot + 1) % MAX_CONCURRENT_EXIT_TRAILS;
        const previousTimer = exitCleanupTimers[slot];
        if (previousTimer !== null) clearTimeout(previousTimer);
        setExiting((current) => {
          const next = [...current];
          next[slot] = { id, path, durationMs, reducedMotion };
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
        }, durationMs + EXIT_TRAIL_CLEANUP_MARGIN_MS);
        exitCleanupTimers[slot] = timer;
      }
      onRemoved(board.isCleared());
    } else {
      if (onTapOutcome) {
        if (PERF_TELEMETRY_TIMING) timeTapOutcome(onTapOutcome, 'blocked');
        else onTapOutcome('blocked');
      }
      const id = nextId.current++;
      const nextShaking = { arrow: owner, id };
      shakingRef.current = nextShaking;
      shakeCleanup.stage({
        id,
        durationMs: BLOCKED_BUMP_MS + FEEDBACK_CLEANUP_MARGIN_MS,
        onElapsed: () => {
          setShaking((current) => {
            if (current?.id !== id) return current;
            shakingRef.current = null;
            return null;
          });
        },
      });
      setShaking(nextShaking);

      // Show WHY: the first arrow in the lane lights up for a moment.
      const blocking = board.blockerOf(owner);
      if (blocking) {
        const blockerId = nextId.current++;
        blockerCleanup.stage({
          id: blockerId,
          durationMs: BLOCKER_FLASH_MS + FEEDBACK_CLEANUP_MARGIN_MS,
          onElapsed: () => {
            setBlocker((current) => (current?.id === blockerId ? null : current));
          },
        });
        setBlocker({ arrow: blocking, id: blockerId });
      }
      onBlocked(blockedLedger.charge(owner));
    }
  }, [
    arrowArtCache,
    blockedLedger,
    board,
    clearHint,
    hint,
    onBlocked,
    onRemoved,
    onTapOutcome,
    reducedMotion,
    resolveTap,
  ]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(PAN_SLOP_PT)
      .maxPointers(1)
      .onStart(() => {
        'worklet';
        panStart.value = { tx: tx.value, ty: ty.value };
      })
      .onUpdate((e) => {
        'worklet';
        const vw = viewport.value.w, vh = viewport.value.h;
        const [xlo, xhi] = panRange(boardW * scale.value, vw);
        const [ylo, yhi] = panRange(boardH * scale.value, vh);
        tx.value = rubberBand(panStart.value.tx + e.translationX, xlo, xhi, vw);
        ty.value = rubberBand(panStart.value.ty + e.translationY, ylo, yhi, vh);
      })
      .onEnd((e) => {
        'worklet';
        // Fling carries on and settles; an overscrolled drag springs back.
        const vw = viewport.value.w, vh = viewport.value.h;
        const xr = panRange(boardW * scale.value, vw);
        const yr = panRange(boardH * scale.value, vh);
        // Vestibular horizontal fling momentum follows the player's system setting.
        tx.value = withDecay({
          velocity: e.velocityX,
          clamp: xr,
          rubberBandEffect: true,
          reduceMotion: ReduceMotion.System,
        });
        // Vestibular vertical fling momentum follows the player's system setting.
        ty.value = withDecay({
          velocity: e.velocityY,
          clamp: yr,
          rubberBandEffect: true,
          reduceMotion: ReduceMotion.System,
        });
      });

    const pinch = Gesture.Pinch()
      .onStart((e) => {
        'worklet';
        cancelAnimation(tx);
        cancelAnimation(ty);
        pinchStart.value = {
          scale: scale.value,
          tx: tx.value,
          ty: ty.value,
          fx: e.focalX,
          fy: e.focalY,
        };
      })
      .onUpdate((e) => {
        'worklet';
        // The board point under the first focal point follows the fingers:
        // two fingers both zoom and pan, like every map.
        const start = pinchStart.value;
        const s2 = Math.min(maxScale.value, Math.max(minScale.value, start.scale * e.scale));
        const k = s2 / start.scale;
        tx.value = e.focalX - (start.fx - start.tx) * k;
        ty.value = e.focalY - (start.fy - start.ty) * k;
        scale.value = s2;
        clampPos();
      });

    const tap = Gesture.Tap()
      .maxDuration(TAP_MAX_DURATION_MS)
      .onBegin((e) => {
        'worklet';
        // A touch stops any momentum, then previews its arrow immediately.
        cancelAnimation(tx);
        cancelAnimation(ty);
        if (scale.value <= 0) return;
        const bx = (e.x - tx.value) / scale.value;
        const by = (e.y - ty.value) / scale.value;
        scheduleOnRN(handlePressStart, bx, by, TAP_RADIUS_PT / scale.value);
      })
      .onEnd((e, success) => {
        'worklet';
        if (!success || scale.value <= 0) return;
        const bx = (e.x - tx.value) / scale.value;
        const by = (e.y - ty.value) / scale.value;
        scheduleOnRN(handleTap, bx, by, TAP_RADIUS_PT / scale.value);
      })
      .onFinalize(() => {
        'worklet';
        scheduleOnRN(handlePressEnd);
      });

    // A drag that starts on an arrow pans instead of firing it; a clean tap
    // fires. Race (not Exclusive): on web the mouse-driven pinch never fails,
    // which would leave an Exclusive tap waiting forever.
    return Gesture.Race(tap, Gesture.Simultaneous(pan, pinch));
  }, [boardW, boardH, clampPos, handlePressEnd, handlePressStart, handleTap]);

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
          blocker={blocker}
          pressed={pressed}
          hint={hint}
          reducedMotion={reducedMotion}
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
  shaking: AnimatedArrowState | null;
  blocker: AnimatedArrowState | null;
  pressed: AnimatedArrowState | null;
  hint: { arrow: ArrowPath; id: number } | null;
  reducedMotion: boolean;
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
    blocker,
    pressed,
    hint,
    reducedMotion,
  } = props;

  const arrowCount = board.count();
  // Only arrows that MOVE (bump) or change colour for good (hint) leave the
  // static layer. The press preview and the blocker flash draw over their
  // static twin with a wider stroke, so a touch never rebuilds the native
  // board (on iOS that is a full board-sized redraw).
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
    PERF_MASK_TIMING
      ? () => timeMaskBuild(() => arrowArtCache.visibilityMask(arrows, excludedArrows))
      : () => arrowArtCache.visibilityMask(arrows, excludedArrows),
    [arrows, arrowArtCache, arrowCount, excludedArrows],
  );
  if (PERF_MASK_TIMING) {
    // PERF_MASK_TIMING is a build-time constant, so the hook order never
    // changes within one bundle.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => () => logMaskTiming('unmount'), []);
  }
  const hasDynamicLayer =
    shaking !== null ||
    hint !== null ||
    blocker !== null ||
    pressed !== null ||
    exiting.some((trail) => trail !== null);
  const shakingArt = shaking
    ? { id: shaking.id, ...arrowArtCache.artFor(shaking.arrow), ...dirVec(shaking.arrow.headDir) }
    : null;
  const blockerArt = blocker ? { id: blocker.id, ...arrowArtCache.artFor(blocker.arrow) } : null;
  const pressedArt = pressed ? { id: pressed.id, ...arrowArtCache.artFor(pressed.arrow) } : null;
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
        blocker={blockerArt}
        pressed={pressedArt}
        hint={hintArt}
        exiting={exiting}
        nativeExitAnimation={nativeExitAnimation}
        reducedMotion={reducedMotion}
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
          blocker={blocker}
          pressed={pressed}
          hint={hint}
          reducedMotion={reducedMotion}
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
  blocker,
  pressed,
  hint,
  reducedMotion,
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
  shaking: AnimatedArrowState | null;
  blocker: AnimatedArrowState | null;
  pressed: AnimatedArrowState | null;
  hint: { arrow: ArrowPath; id: number } | null;
  reducedMotion: boolean;
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
          {pressed && (
            <PressedArrow key={`p${pressed.id}`} arrow={pressed.arrow} palette={palette} />
          )}
          {blocker && (
            <BlockerArrow
              key={`b${blocker.id}`}
              arrow={blocker.arrow}
              palette={palette}
              reducedMotion={reducedMotion}
            />
          )}
          {shaking && (
            <ShakingArrow
              key={`s${shaking.id}`}
              arrow={shaking.arrow}
              id={shaking.id}
              palette={palette}
              reducedMotion={reducedMotion}
            />
          )}
          {hint && (
            <HintArrow
              key={`h${hint.id}`}
              arrow={hint.arrow}
              palette={palette}
              reducedMotion={reducedMotion}
            />
          )}
          {exiting.filter((trail): trail is ExitingTrail => trail !== null).map((trail) => (
            <ExitTrail
              key={trail.id}
              path={trail.path}
              durationMs={trail.durationMs}
              ink={palette.ink}
              reducedMotion={trail.reducedMotion}
            />
          ))}
        </G>
      </AnimatedG>
    </Svg>
  );
}

/** Touch-down preview: the arrow under the finger, accent-tinted and a
 * little bolder, before the release commits it. Static on purpose: it must
 * appear on the very next frame and must not move. */
function PressedArrow({ arrow, palette }: { arrow: ArrowPath; palette: Palette }) {
  const art = useMemo(() => arrowArt(arrow, CELL), [arrow]);
  return (
    <G>
      <Path
        d={art.shaftD}
        stroke={palette.accent}
        strokeWidth={STROKE * CELL * PRESSED_STROKE_SWELL}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path d={art.headD} fill={palette.accent} />
    </G>
  );
}

/** The arrow in the way lights up in the fail colour and fades back, so a
 * lost heart teaches something. Under Reduce Motion it stays solid heart at the
 * onset swell until it unmounts. */
function BlockerArrow({
  arrow,
  palette,
  reducedMotion,
}: {
  arrow: ArrowPath;
  palette: Palette;
  reducedMotion: boolean;
}) {
  const art = useMemo(() => arrowArt(arrow, CELL), [arrow]);
  const k = useSharedValue(0);

  React.useEffect(() => {
    k.value = 0;
    // Reduce Motion: no driver; the curves return their static values.
    if (reducedMotion) return;
    k.value = withTiming(1, { duration: BLOCKER_FLASH_MS, easing: Easing.linear });
  }, [arrow, reducedMotion]);

  const gProps = useAnimatedProps(
    () => ({ opacity: blockerOpacityAt(k.value, reducedMotion) }) as any,
  );
  const shaftProps = useAnimatedProps(() => ({
    strokeWidth: STROKE * CELL * blockerStrokeSwellAt(k.value, reducedMotion),
  }));

  return (
    <AnimatedG animatedProps={gProps}>
      <AnimatedPath
        d={art.shaftD}
        animatedProps={shaftProps}
        stroke={palette.heart}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path d={art.headD} fill={palette.heart} />
    </AnimatedG>
  );
}

/**
 * Blocked feedback (ArrowTile.PlayShake, revised): the arrow bumps INTO the
 * lane it cannot enter and springs back, flashing the fail colour and
 * settling to ink, ~0.3 s. Under Reduce Motion it stays still and solid
 * fail colour until it unmounts.
 */
function ShakingArrow({
  arrow,
  id,
  palette,
  reducedMotion,
}: {
  arrow: ArrowPath;
  id: number;
  palette: Palette;
  reducedMotion: boolean;
}) {
  const art = useMemo(() => arrowArt(arrow, CELL), [arrow]);
  const dir = useMemo(() => dirVec(arrow.headDir), [arrow]);
  const k = useSharedValue(0);

  React.useEffect(() => {
    k.value = 0;
    // Reduce Motion: no driver; the curves return their static values.
    if (reducedMotion) return;
    k.value = withTiming(1, { duration: BLOCKED_BUMP_MS, easing: Easing.linear });
  }, [id, reducedMotion]);

  const gProps = useAnimatedProps(() => {
    const d = reducedMotion ? 0 : blockedBumpAt(k.value) * CELL;
    // transform string, not x/y props: <g> has no x attribute on web SVG.
    return { transform: `translate(${dir.x * d}, ${dir.y * d})` } as any;
  });

  const colorAt = (kv: number) => {
    'worklet';
    // easeOutQuad: flash red, settle to ink (held red under Reduce Motion)
    return interpolateColor(
      blockedFlashMixAt(kv, reducedMotion),
      [0, 1],
      [palette.heart, palette.ink],
    );
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
 * visibly lights up. The arrow stays tappable throughout. Under Reduce Motion
 * the stroke holds the pulse peak instead of breathing.
 */
function HintArrow({
  arrow,
  palette,
  reducedMotion,
}: {
  arrow: ArrowPath;
  palette: Palette;
  reducedMotion: boolean;
}) {
  const art = useMemo(() => arrowArt(arrow, CELL), [arrow]);
  const k = useSharedValue(0);

  React.useEffect(() => {
    k.value = 0;
    // Reduce Motion: no driver; the curve returns its static value.
    if (reducedMotion) return;
    k.value = withTiming(1, { duration: 1600, easing: Easing.linear });
  }, [arrow, reducedMotion]);

  const shaftProps = useAnimatedProps(() => ({
    strokeWidth: STROKE * CELL * hintStrokeSwellAt(k.value, reducedMotion), // the swell
  }));

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
  durationMs,
  ink,
  reducedMotion,
}: {
  path: SlitherPath;
  durationMs: number;
  ink: string;
  reducedMotion: boolean;
}) {
  const k = useSharedValue(0);

  React.useEffect(() => {
    k.value = 0;
    // The component supplies its own stationary fade, so its opacity clock must keep running.
    k.value = withTiming(1, {
      duration: durationMs,
      easing: Easing.linear,
      reduceMotion: ReduceMotion.Never,
    });
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
        strokeWidth={EXIT_TRAIL_STROKE_CELLS * CELL} // the bead tube's diameter
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
