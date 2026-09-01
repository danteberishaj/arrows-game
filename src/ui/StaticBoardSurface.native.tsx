import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  DashPathEffect,
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
import type {
  AnimatedArrowArt,
  AnimatedExitTrail,
  StaticBoardSurfaceProps,
} from './StaticBoardSurface.types';
import { EXIT_TRAIL_DURATION_MS } from './exitAnimationConfig';

const PERF_EMPTY_BOARD =
  PERF_MODE && process.env.EXPO_PUBLIC_PERF_EMPTY_BOARD === '1';
const PERF_OPAQUE_SURFACE =
  PERF_MODE && process.env.EXPO_PUBLIC_PERF_OPAQUE_SURFACE === '1';
const PERF_NO_EXIT_TRAILS =
  PERF_MODE && process.env.EXPO_PUBLIC_PERF_NO_EXIT_TRAILS === '1';

/** Native retained board with a small Skia layer only for transient feedback. */
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
  hint,
  exiting,
  nativeExitAnimation,
}: StaticBoardSurfaceProps) {
  const boardStyle = useMemo(() => ({
    position: 'absolute' as const,
    left: 0,
    top: 0,
    width: boardW,
    height: boardH,
    overflow: 'hidden' as const,
    transformOrigin: '0 0 0',
  }), [boardW, boardH]);
  const boardTransformStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

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
            exitAnimation={nativeExitAnimation === null
              ? ''
              : [
                  nativeExitAnimation.id,
                  nativeExitAnimation.arrowIndex,
                  nativeExitAnimation.durationMs,
                  nativeExitAnimation.reducedMotion ? 1 : 0,
                ].join(',')}
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
        hint={hint}
        exiting={exiting}
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
  hint,
  exiting,
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
  | 'hint'
  | 'exiting'
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
          {!PERF_EMPTY_BOARD && shaking !== null && (
            <ShakingArrow
              key={shaking.id}
              art={shaking}
              ink={ink}
              heart={heart}
              cellSize={cellSize}
              strokeWidth={strokeWidth}
            />
          )}
          {!PERF_EMPTY_BOARD && hint !== null && (
            <HintArrow
              key={hint.id}
              art={hint}
              accent={accent}
              strokeWidth={strokeWidth}
            />
          )}
          {!PERF_EMPTY_BOARD && !PERF_NO_EXIT_TRAILS && exiting.map((trail, slot) => (
            <ExitTrailSlot
              key={slot}
              trail={trail}
              ink={ink}
              cellSize={cellSize}
            />
          ))}
        </Group>
      </Group>
    </Canvas>
  );
});

function ShakingArrow({
  art,
  ink,
  heart,
  cellSize,
  strokeWidth,
}: {
  art: AnimatedArrowArt;
  ink: string;
  heart: string;
  cellSize: number;
  strokeWidth: number;
}) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 300, easing: Easing.linear });
  }, [art.id]);

  const transform = useDerivedValue((): Transforms3d => {
    const t = progress.value * 0.3;
    const dx = Math.sin(t * 70) * 0.4 * cellSize * (1 - progress.value);
    return [{ translateX: dx }];
  });
  const color = useDerivedValue(() => {
    const eased = 1 - (1 - progress.value) * (1 - progress.value);
    return interpolateColors(eased, [0, 1], [heart, ink]);
  });

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

function HintArrow({
  art,
  accent,
  strokeWidth,
}: {
  art: AnimatedArrowArt;
  accent: string;
  strokeWidth: number;
}) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 1600, easing: Easing.linear });
  }, [art.id]);

  const animatedStrokeWidth = useDerivedValue(() => {
    const pulse = Math.abs(Math.sin(progress.value * Math.PI * 4)) * (1 - progress.value * 0.6);
    return strokeWidth * (1 + 0.45 * pulse);
  });

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

function ExitTrailSlot({
  trail,
  ink,
  cellSize,
}: {
  trail: AnimatedExitTrail | null;
  ink: string;
  cellSize: number;
}) {
  const progress = useSharedValue(0);
  const totalLength = useSharedValue(0);
  const directionX = useSharedValue(0);
  const directionY = useSharedValue(0);
  const active = useSharedValue(0);
  const path = trail?.path ?? null;
  const reducedMotion = trail?.reducedMotion ?? false;
  const headD = useMemo(() => {
    if (path === null) return '';
    const tip = path.headTip;
    const left = path.headBaseL;
    const right = path.headBaseR;
    return `M${tip.x} ${tip.y} L${left.x} ${left.y} L${right.x} ${right.y} Z`;
  }, [path]);

  React.useEffect(() => {
    progress.value = 0;
    if (path === null) {
      active.value = 0;
      totalLength.value = 0;
      directionX.value = 0;
      directionY.value = 0;
      return;
    }
    totalLength.value = path.totalLen;
    directionX.value = path.dir.x;
    directionY.value = path.dir.y;
    active.value = 1;
    progress.value = withTiming(1, {
      duration: EXIT_TRAIL_DURATION_MS,
      easing: Easing.linear,
    });
  }, [trail?.id]);

  const phase = useDerivedValue(
    () => reducedMotion ? 0 : progress.value * progress.value * totalLength.value,
  );
  const opacity = useDerivedValue(() => {
    if (active.value === 0) return 0;
    if (reducedMotion) return 1 - progress.value;
    if (progress.value < 0.55) return 1;
    const fade = (progress.value - 0.55) / 0.45;
    return 1 - fade * fade * (3 - 2 * fade);
  });
  const headTransform = useDerivedValue((): Transforms3d => {
    const travelled = reducedMotion
      ? 0
      : progress.value * progress.value * totalLength.value;
    return [
      { translateX: directionX.value * travelled },
      { translateY: directionY.value * travelled },
    ];
  });

  if (path === null) return null;

  return (
    <Group>
      <Path
        path={path.d}
        color={ink}
        opacity={opacity}
        style="stroke"
        strokeWidth={0.26 * cellSize}
        strokeCap="round"
        strokeJoin="round"
      >
        <DashPathEffect
          intervals={[path.bodyLen, path.totalLen + path.bodyLen]}
          phase={phase}
        />
      </Path>
      <Group transform={headTransform}>
        <Path path={headD} color={ink} />
      </Group>
    </Group>
  );
}
