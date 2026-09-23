import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  Group,
  interpolateColors,
  Path,
  rect,
  type Transforms3d,
} from '@shopify/react-native-skia';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ArrowsBoardView } from '../../modules/arrows-board';
import { PERF_MODE } from '../perfMode';
import { nativeGridProps } from './boardGrid';
import { BOARD_GRID_ENABLED } from './boardGridFlag';
import { BOARD_WRAPPER_OVERFLOW } from './boardOverflow';
import {
  BLOCKED_BUMP_MS,
  BLOCKER_FLASH_MS,
  blockedBumpAt,
  blockedFlashMixAt,
  blockerOpacityAt,
  blockerStrokeSwellAt,
  hintStrokeSwellAt,
  PRESSED_STROKE_SWELL,
} from './feedbackCurves';
import { serializeNativeExitAnimation } from './nativeExitAnimation';
import type {
  AnimatedArrowArt,
  BumpingArrowArt,
  StaticBoardSurfaceProps,
} from './StaticBoardSurface.types';

const PERF_EMPTY_BOARD =
  PERF_MODE && process.env.EXPO_PUBLIC_PERF_EMPTY_BOARD === '1';
const PERF_OPAQUE_SURFACE =
  PERF_MODE && process.env.EXPO_PUBLIC_PERF_OPAQUE_SURFACE === '1';

/**
 * Native retained board (static arrows + slither exits) with a small Skia
 * layer only for the hint pulse and the blocked shake. The `exiting` prop is
 * consumed by the web surface; on native every exit is drawn by the board view.
 */
export const StaticBoardSurface = React.memo(function StaticBoardSurface({
  scale,
  tx,
  ty,
  boardW,
  boardH,
  nativeGeometry,
  nativeVisibilityMask,
  background,
  ink,
  accent,
  heart,
  cellSize,
  strokeWidth,
  shaking,
  blocker,
  pressed,
  hint,
  nativeExitAnimation,
  reducedMotion,
  grid,
}: StaticBoardSurfaceProps) {
  const boardStyle = useMemo(() => ({
    position: 'absolute' as const,
    left: 0,
    top: 0,
    width: boardW,
    height: boardH,
    // POLISH-T1: 'visible' only when a board-polish flag needs the native
    // board to paint past the board edge; flags off keep today's clip.
    overflow: BOARD_WRAPPER_OVERFLOW,
    transformOrigin: '0 0 0',
  }), [boardW, boardH]);
  const boardTransformStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));
  const exitAnimation = useMemo(
    () => nativeExitAnimation === null
      ? ''
      : serializeNativeExitAnimation(nativeExitAnimation),
    [nativeExitAnimation],
  );
  // POLISH-T4: flag off spreads {}, so the native props are exactly today's.
  const gridProps = useMemo(() => nativeGridProps(grid, BOARD_GRID_ENABLED), [grid]);

  return (
    <>
      {PERF_OPAQUE_SURFACE && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: background }]}
        />
      )}
      <Animated.View
        pointerEvents="none"
        style={[boardStyle, boardTransformStyle]}
      >
        {!PERF_EMPTY_BOARD && (
          <ArrowsBoardView
            geometry={nativeGeometry}
            visibleMask={nativeVisibilityMask}
            ink={ink}
            strokeWidth={strokeWidth}
            exitAnimation={exitAnimation}
            {...gridProps}
            style={StyleSheet.absoluteFill}
          />
        )}
      </Animated.View>
      <DynamicFeedbackSurface
        scale={scale}
        tx={tx}
        ty={ty}
        boardW={boardW}
        boardH={boardH}
        ink={ink}
        accent={accent}
        heart={heart}
        cellSize={cellSize}
        strokeWidth={strokeWidth}
        shaking={shaking}
        blocker={blocker}
        pressed={pressed}
        hint={hint}
        reducedMotion={reducedMotion}
      />
    </>
  );
});

const DynamicFeedbackSurface = React.memo(function DynamicFeedbackSurface({
  scale,
  tx,
  ty,
  boardW,
  boardH,
  ink,
  accent,
  heart,
  cellSize,
  strokeWidth,
  shaking,
  blocker,
  pressed,
  hint,
  reducedMotion,
}: Pick<
  StaticBoardSurfaceProps,
  | 'scale'
  | 'tx'
  | 'ty'
  | 'boardW'
  | 'boardH'
  | 'ink'
  | 'accent'
  | 'heart'
  | 'cellSize'
  | 'strokeWidth'
  | 'shaking'
  | 'blocker'
  | 'pressed'
  | 'hint'
  | 'reducedMotion'
>) {
  const boardTransform = useDerivedValue((): Transforms3d => [
    { translateX: tx.value },
    { translateY: ty.value },
    { scale: scale.value },
  ]);
  const boardClip = useMemo(() => rect(0, 0, boardW, boardH), [boardW, boardH]);

  return (
    <Canvas
      colorSpace="srgb"
      opaque={false}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    >
      <Group transform={boardTransform}>
        <Group clip={boardClip}>
          {!PERF_EMPTY_BOARD && pressed !== null && (
            <PressedArrow
              key={pressed.id}
              art={pressed}
              accent={accent}
              strokeWidth={strokeWidth}
            />
          )}
          {!PERF_EMPTY_BOARD && blocker !== null && (
            <BlockerArrow
              key={blocker.id}
              art={blocker}
              heart={heart}
              strokeWidth={strokeWidth}
              reducedMotion={reducedMotion}
            />
          )}
          {!PERF_EMPTY_BOARD && shaking !== null && (
            <ShakingArrow
              key={shaking.id}
              art={shaking}
              ink={ink}
              heart={heart}
              cellSize={cellSize}
              strokeWidth={strokeWidth}
              reducedMotion={reducedMotion}
            />
          )}
          {!PERF_EMPTY_BOARD && hint !== null && (
            <HintArrow
              key={hint.id}
              art={hint}
              accent={accent}
              strokeWidth={strokeWidth}
              reducedMotion={reducedMotion}
            />
          )}
        </Group>
      </Group>
    </Canvas>
  );
});

/** Touch-down preview: accent, bolder, drawn over the static arrow. Static
 * on purpose so it appears on the next frame and never moves. */
function PressedArrow({
  art,
  accent,
  strokeWidth,
}: {
  art: AnimatedArrowArt;
  accent: string;
  strokeWidth: number;
}) {
  return (
    <Group>
      <Path
        path={art.shaftD}
        color={accent}
        style="stroke"
        strokeWidth={strokeWidth * PRESSED_STROKE_SWELL}
        strokeCap="round"
        strokeJoin="round"
      />
      <Path path={art.headD} color={accent} />
    </Group>
  );
}

/** The arrow in the way flashes the fail colour and fades back to ink. Under
 * Reduce Motion it stays solid heart at the onset swell until it unmounts. */
function BlockerArrow({
  art,
  heart,
  strokeWidth,
  reducedMotion,
}: {
  art: AnimatedArrowArt;
  heart: string;
  strokeWidth: number;
  reducedMotion: boolean;
}) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = 0;
    // Reduce Motion: no driver; the curves return their static values.
    if (reducedMotion) return;
    progress.value = withTiming(1, { duration: BLOCKER_FLASH_MS, easing: Easing.linear });
  }, [art.id, reducedMotion]);

  const opacity = useDerivedValue(() => blockerOpacityAt(progress.value, reducedMotion));
  const animatedStrokeWidth = useDerivedValue(
    () => strokeWidth * blockerStrokeSwellAt(progress.value, reducedMotion),
  );

  return (
    <Group opacity={opacity}>
      <Path
        path={art.shaftD}
        color={heart}
        style="stroke"
        strokeWidth={animatedStrokeWidth}
        strokeCap="round"
        strokeJoin="round"
      />
      <Path path={art.headD} color={heart} />
    </Group>
  );
}

/** Blocked bump: lunge into the lane, spring back, flash red to ink. Under
 * Reduce Motion it stays still and solid heart until it unmounts. */
function ShakingArrow({
  art,
  ink,
  heart,
  cellSize,
  strokeWidth,
  reducedMotion,
}: {
  art: BumpingArrowArt;
  ink: string;
  heart: string;
  cellSize: number;
  strokeWidth: number;
  reducedMotion: boolean;
}) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = 0;
    // Reduce Motion: no driver; the curves return their static values.
    if (reducedMotion) return;
    progress.value = withTiming(1, { duration: BLOCKED_BUMP_MS, easing: Easing.linear });
  }, [art.id, reducedMotion]);

  const transform = useDerivedValue((): Transforms3d => {
    const d = reducedMotion ? 0 : blockedBumpAt(progress.value) * cellSize;
    return [{ translateX: art.x * d }, { translateY: art.y * d }];
  });
  const color = useDerivedValue(() =>
    interpolateColors(blockedFlashMixAt(progress.value, reducedMotion), [0, 1], [heart, ink]),
  );

  return (
    <Group transform={transform}>
      <Path
        path={art.shaftD}
        color={color}
        style="stroke"
        strokeWidth={strokeWidth}
        strokeCap="round"
        strokeJoin="round"
      />
      <Path path={art.headD} color={color} />
    </Group>
  );
}

/** Hint: accent with a settling stroke pulse. Under Reduce Motion the stroke
 * holds the pulse peak. */
function HintArrow({
  art,
  accent,
  strokeWidth,
  reducedMotion,
}: {
  art: AnimatedArrowArt;
  accent: string;
  strokeWidth: number;
  reducedMotion: boolean;
}) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = 0;
    // Reduce Motion: no driver; the curve returns its static value.
    if (reducedMotion) return;
    progress.value = withTiming(1, { duration: 1600, easing: Easing.linear });
  }, [art.id, reducedMotion]);

  const animatedStrokeWidth = useDerivedValue(
    () => strokeWidth * hintStrokeSwellAt(progress.value, reducedMotion),
  );

  return (
    <Group>
      <Path
        path={art.shaftD}
        color={accent}
        style="stroke"
        strokeWidth={animatedStrokeWidth}
        strokeCap="round"
        strokeJoin="round"
      />
      <Path path={art.headD} color={accent} />
    </Group>
  );
}
