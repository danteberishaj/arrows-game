import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import type { StaticBoardSurfaceProps } from './StaticBoardSurface.types';

const AnimatedG = Animated.createAnimatedComponent(G);

/** SVG fallback for web. Native platforms resolve StaticBoardSurface.native.tsx. */
export const StaticBoardSurface = React.memo(function StaticBoardSurface({
  scale,
  tx,
  ty,
  viewportW,
  viewportH,
  boardW,
  boardH,
  shaftD,
  headD,
  ink,
  strokeWidth,
}: StaticBoardSurfaceProps) {
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
        <ClipPath id="static-board-clip">
          <Rect x={0} y={0} width={boardW} height={boardH} />
        </ClipPath>
      </Defs>
      <AnimatedG animatedProps={boardProps}>
        <G clipPath="url(#static-board-clip)">
          {shaftD !== '' && (
            <Path
              d={shaftD}
              stroke={ink}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )}
          {headD !== '' && <Path d={headD} fill={ink} />}
        </G>
      </AnimatedG>
    </Svg>
  );
});
