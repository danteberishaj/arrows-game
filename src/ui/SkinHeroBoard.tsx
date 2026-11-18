import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { ArrowPath } from '../core';
import { Direction } from '../core/direction';
import { META_BLOCKED_INK_HOLD } from '../featureFlags';
import { CAPTURE_DIAG } from '../perfMode';
import { serializeNativeBoardGeometry, STROKE } from './arrowGeometry';
import { EXIT_TRAIL_STROKE_CELLS } from './exitAnimationConfig';
import { planExit } from './exitToScreenEdge';
import { serializeNativeExitAnimation } from './nativeExitAnimation';
import { SKIN_SPEC_JSON, type ArrowStyle } from './skinSpecs';
import { skinBoardPalette } from './skinBoardPalette';
import type { Palette } from './theme';
import { skinPickerEnabled } from './useArrowStyle';
import { seasonFxPayload, useWinterLook } from './winter/winterLook';

/**
 * Skin showcase (owner + Fable consult 2026-11-18): the purchase / unlock hero is a small REAL native board in the
 * skin, on its own board colour, instead of the flat SVG glyph, so the player sees exactly what they buy. One instance
 * at a time (only the confirm / bought / reveal screens mount it). Android only; elsewhere the caller keeps the SVG.
 * Demo: 600 ms after it opens, the free arrow (index 0) slides out once; reduced motion keeps the board still.
 */
const CELL = 34;
const COLS = 7;
const ROWS = 4;
const at = (r: number, c: number) => ({ r, c });
/** Hand-authored 7x4 snippet: bends of every kind, no overlaps; arrow 0 has a clear run off the right edge. */
const ARROWS: readonly ArrowPath[] = [
  new ArrowPath([at(1, 3), at(1, 4), at(1, 5), at(1, 6)], Direction.Right),
  new ArrowPath([at(0, 0), at(0, 1), at(0, 2), at(1, 2)], Direction.Down),
  new ArrowPath([at(0, 6), at(0, 5), at(0, 4)], Direction.Left),
  new ArrowPath([at(3, 0), at(2, 0), at(1, 0)], Direction.Up),
  new ArrowPath([at(2, 1), at(2, 2), at(2, 3), at(3, 3)], Direction.Down),
  new ArrowPath([at(3, 6), at(2, 6), at(2, 5), at(2, 4)], Direction.Left),
  new ArrowPath([at(3, 4), at(3, 5)], Direction.Right),
];
const GEOMETRY = serializeNativeBoardGeometry(ARROWS, CELL);
const SKIN_GEOMETRY = ARROWS.map(a => [a.headDir, ...a.cells.flatMap(({ r, c }) => [r, c])].join(',')).join(';');
const ALL = '1'.repeat(ARROWS.length);
const DEMO_DELAY_MS = 600;

export const SKIN_HERO_SIZE = { width: COLS * CELL + 28, height: ROWS * CELL + 28 };

export function skinHeroAvailable(): boolean {
  return Platform.OS === 'android' && skinPickerEnabled();
}

export function SkinHeroBoard({ style, palette: p, dark, demo = true }: { style: ArrowStyle; palette: Palette; dark: boolean; demo?: boolean }) {
  // Lazy: importing this file must not load the native module (jest, iOS); it only renders where skinHeroAvailable().
  const { ArrowsBoardView } = require('../../modules/arrows-board') as typeof import('../../modules/arrows-board');
  const reduced = useReducedMotion();
  const bg = skinBoardPalette(p, style.spec ?? null, dark).bg;
  const [mask, setMask] = useState(ALL);
  const [exit, setExit] = useState('');
  const look = useWinterLook();
  const seasonFx = seasonFxPayload(look, bg, CAPTURE_DIAG);
  const exitEvent = useMemo(() => {
    const plan = planExit(ARROWS[0], CELL, ROWS, COLS, { tx: 0, ty: 0, scale: 1, viewportW: 0, viewportH: 0 },
      { toScreenEdge: false, reducedMotion: false });
    return serializeNativeExitAnimation({ id: 1, arrowIndex: 0, durationMs: plan.durationMs, reducedMotion: false,
      path: plan.path, trailStrokeWidth: EXIT_TRAIL_STROKE_CELLS * CELL, motion: plan.motion });
  }, []);
  useEffect(() => {
    if (!demo || reduced) return;
    const t = setTimeout(() => { setExit(exitEvent); setMask('0' + ALL.slice(1)); }, DEMO_DELAY_MS);
    return () => clearTimeout(t);
  }, [demo, reduced, exitEvent]);
  return (
    <View style={[styles.stage, SKIN_HERO_SIZE, { backgroundColor: bg }]} accessible={false}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="skin-hero-board">
      <View style={styles.board}>
        <ArrowsBoardView
          geometry={GEOMETRY}
          visibleMask={mask}
          ink={p.ink}
          strokeWidth={STROKE * CELL}
          exitAnimation={exit}
          artSkin={style.spec ? SKIN_SPEC_JSON[style.id] : ''}
          skinGeometry={SKIN_GEOMETRY}
          skinConfig={`${CELL},${reduced ? 1 : 0},${META_BLOCKED_INK_HOLD ? 1 : 0},${CELL},${p.heart}`}
          skinFeedback="-1,-1,-1,-1,-1,-1,-1"
          {...(seasonFx ? { seasonFx } : {})}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  board: { width: COLS * CELL, height: ROWS * CELL },
});
