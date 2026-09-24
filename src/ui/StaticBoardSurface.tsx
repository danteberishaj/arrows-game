import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Line, Path, Pattern, Rect } from 'react-native-svg';
import { gridStroke, type BoardGrid } from './boardGrid';
import type { StaticBoardSurfaceProps } from './StaticBoardSurface.types';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

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
  grid,
  markShaftD,
  markHeadD,
  markColor,
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
        {/* POLISH-T4: the grid sits under the (clipped) arrows, unclipped itself. */}
        {grid !== null && <WebBoardGrid grid={grid} scale={scale} />}
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
          {/* POLISH-T5: marked arrows (empty unless META_MISSED_MARK marked one). */}
          {markShaftD !== '' && (
            <Path
              d={markShaftD}
              stroke={markColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )}
          {markHeadD !== '' && <Path d={markHeadD} fill={markColor} />}
        </G>
      </AnimatedG>
    </Svg>
  );
});

/**
 * POLISH-T4 web grid: one SVG pattern tile per cell (lines, then the dot, so a
 * dot sits cleanly on each crossing) filling the camera-reachable extent. The
 * sizes follow the zoom every frame (the SVG transform is per-frame on JS
 * already): dot radius clamp(0.07 cell, 0.9, 1.75) dp, lines 1 dp on screen.
 */
function WebBoardGrid({ grid, scale }: { grid: BoardGrid; scale: SharedValue<number> }) {
  const { cell, extent, dotColor, lineColor, linesOn } = grid;
  const half = cell / 2;
  const dotProps = useAnimatedProps(() => {
    const s = scale.value;
    return { r: s > 0 ? gridStroke(s, cell).dotRadius : 0 };
  });
  const lineProps = useAnimatedProps(() => {
    const s = scale.value;
    return { strokeWidth: s > 0 ? gridStroke(s, cell).lineWidth : 0 };
  });
  const patternId = linesOn ? 'board-grid-lines' : 'board-grid-dots';
  return (
    <>
      <Defs>
        <Pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          x={0}
          y={0}
          width={cell}
          height={cell}
        >
          {linesOn && (
            <AnimatedLine x1={0} y1={half} x2={cell} y2={half} stroke={lineColor} animatedProps={lineProps} />
          )}
          {linesOn && (
            <AnimatedLine x1={half} y1={0} x2={half} y2={cell} stroke={lineColor} animatedProps={lineProps} />
          )}
          <AnimatedCircle cx={half} cy={half} fill={dotColor} animatedProps={dotProps} />
        </Pattern>
      </Defs>
      <Rect
        x={extent.minCol * cell}
        y={extent.minRow * cell}
        width={(extent.maxCol - extent.minCol + 1) * cell}
        height={(extent.maxRow - extent.minRow + 1) * cell}
        fill={`url(#${patternId})`}
      />
    </>
  );
}
