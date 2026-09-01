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
import { serializeNativeExitAnimation } from './nativeExitAnimation';
import type {
  AnimatedArrowArt,
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
  hint,
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
  const exitAnimation = useMemo(
    () => nativeExitAnimation === null
      ? ''
      : serializeNativeExitAnimation(nativeExitAnimation),
    [nativeExitAnimation],
  );

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
