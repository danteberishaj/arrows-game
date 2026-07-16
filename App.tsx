import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  ArrowPath,
  Difficulties,
  Direction,
  GeneratedLevel,
  LevelGenerator,
} from './src/core';

/**
 * Minimal playable prototype of the Arrows game (Ink Night) on the ported
 * core engine: tap an arrow whose head lane is clear and it leaves the board;
 * tap a blocked one and it flashes red and costs a heart. This screen exists
 * to prove the engine on web/iOS/Android — the real board rendering (Skia
 * line-art, pan/zoom, slither animation) comes later.
 */

// Daylight theme (the game's default): ink shapes on paper. Distinct muted
// inks per arrow so adjacent pieces read as separate without line-art yet.
const PAPER = '#f6f2e9';
const INK = '#1c1a2e';
const PALETTE = [
  '#1c1a2e', '#3d2c8d', '#5b4bb7', '#2d4059', '#6b3fa0',
  '#264653', '#4a3f6b', '#553d67', '#3a5a80', '#7048a8',
];
const BLOCKED = '#d64545';

const HEAD_GLYPH: Record<Direction, string> = {
  [Direction.Up]: '▲',
  [Direction.Down]: '▼',
  [Direction.Left]: '◀',
  [Direction.Right]: '▶',
};

type Phase = 'playing' | 'won' | 'lost';

export default function App() {
  const { width, height } = useWindowDimensions();

  const [levelIndex, setLevelIndex] = useState(0);
  const [level, setLevel] = useState<GeneratedLevel>(() => LevelGenerator.generate(0));
  const [hearts, setHearts] = useState<number>(() => level.hearts);
  const [phase, setPhase] = useState<Phase>('playing');
  const [, setTick] = useState(0); // board mutates in place; bump to re-render
  const [flashArrow, setFlashArrow] = useState<ArrowPath | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const board = level.board;

  // Stable color per arrow, assigned once per level in generation order.
  const colorOf = useMemo(() => {
    const map = new Map<ArrowPath, string>();
    board.arrows().forEach((a, i) => map.set(a, PALETTE[i % PALETTE.length]));
    return map;
  }, [level]);

  const loadLevel = useCallback((index: number) => {
    const next = LevelGenerator.generate(index);
    setLevelIndex(index);
    setLevel(next);
    setHearts(next.hearts);
    setPhase('playing');
    setFlashArrow(null);
  }, []);

  const onCellPress = useCallback(
    (r: number, c: number) => {
      if (phase !== 'playing') return;
      const owner = board.ownerAt(r, c);
      if (!owner) return;

      if (board.tryRemove(owner)) {
        setTick((t) => t + 1);
        if (board.isCleared()) setPhase('won');
      } else {
        // Blocked: flash the arrow red and spend a heart.
        if (flashTimer.current) clearTimeout(flashTimer.current);
        setFlashArrow(owner);
        flashTimer.current = setTimeout(() => setFlashArrow(null), 350);
        setHearts((h) => {
          const left = h - 1;
          if (left <= 0) setPhase('lost');
          return left;
        });
      }
    },
    [board, phase],
  );

  // Fit the whole board to the viewport (the Unity build pans/zooms instead).
  const headerH = 64;
  const cell = Math.max(
    8,
    Math.min((width - 16) / board.cols, (height - headerH - 32) / board.rows, 30),
  );
  const boardW = cell * board.cols;
  const boardH = cell * board.rows;

  const arrows = board.arrows();

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {/* Header: level, difficulty, hearts */}
      <View style={[styles.header, { height: headerH }]}>
        <Text style={styles.title}>
          LEVEL {levelIndex + 1}
          <Text style={styles.subtitle}>
            {'  '}{Difficulties.displayName(level.difficulty)} · {level.shapeName} · {level.arrowCount} arrows
          </Text>
        </Text>
        <Text style={styles.hearts}>
          {'♥'.repeat(Math.max(0, hearts))}
          <Text style={styles.heartsLost}>{'♥'.repeat(Math.max(0, level.hearts - hearts))}</Text>
        </Text>
      </View>

      {/* Board */}
      <View style={styles.boardWrap}>
        <View style={{ width: boardW, height: boardH }}>
          {arrows.map((arrow) => {
            const color = flashArrow === arrow ? BLOCKED : colorOf.get(arrow) ?? INK;
            const inset = Math.max(1, cell * 0.08);
            const radius = cell * 0.28;
            const head = arrow.head;
            return (
              <View key={arrow.toLine()} pointerEvents="none">
                {/* connectors first so cells' rounded corners sit on top */}
                {arrow.cells.slice(1).map((b, i) => {
                  const a = arrow.cells[i];
                  const left = Math.min(a.c, b.c) * cell + inset;
                  const top = Math.min(a.r, b.r) * cell + inset;
                  const w = (Math.abs(a.c - b.c) + 1) * cell - inset * 2;
                  const h = (Math.abs(a.r - b.r) + 1) * cell - inset * 2;
                  return (
                    <View
                      key={i}
                      style={{ position: 'absolute', left, top, width: w, height: h, backgroundColor: color, borderRadius: radius }}
                    />
                  );
                })}
                {arrow.cells.map((p, i) => (
                  <View
                    key={`c${i}`}
                    style={{
                      position: 'absolute',
                      left: p.c * cell + inset,
                      top: p.r * cell + inset,
                      width: cell - inset * 2,
                      height: cell - inset * 2,
                      backgroundColor: color,
                      borderRadius: radius,
                    }}
                  />
                ))}
                <Text
                  style={{
                    position: 'absolute',
                    left: head.c * cell,
                    top: head.r * cell,
                    width: cell,
                    height: cell,
                    color: PAPER,
                    fontSize: cell * 0.5,
                    lineHeight: cell,
                    textAlign: 'center',
                  }}
                >
                  {HEAD_GLYPH[arrow.headDir]}
                </Text>
              </View>
            );
          })}

          {/* One tap target per cell, above the drawing. */}
          {Array.from({ length: board.rows }, (_, r) =>
            Array.from({ length: board.cols }, (_, c) => (
              <Pressable
                key={`${r}-${c}`}
                onPress={() => onCellPress(r, c)}
                style={{
                  position: 'absolute',
                  left: c * cell,
                  top: r * cell,
                  width: cell,
                  height: cell,
                }}
              />
            )),
          )}
        </View>
      </View>

      {/* Win / lose panels */}
      {phase !== 'playing' && (
        <View style={styles.overlay}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>
              {phase === 'won' ? 'Cleared!' : 'Out of hearts'}
            </Text>
            <Text style={styles.panelSub}>
              {phase === 'won'
                ? `Level ${levelIndex + 1} · ${level.shapeName}`
                : 'The shape got the better of you.'}
            </Text>
            <Pressable
              style={styles.button}
              onPress={() => loadLevel(phase === 'won' ? levelIndex + 1 : levelIndex)}
            >
              <Text style={styles.buttonText}>{phase === 'won' ? 'Next level' : 'Retry'}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PAPER,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  title: {
    color: INK,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  subtitle: {
    color: '#8b8578',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  hearts: {
    color: '#d64545',
    fontSize: 20,
    letterSpacing: 2,
  },
  heartsLost: {
    color: '#d8d2c4',
  },
  boardWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28,26,46,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    backgroundColor: PAPER,
    borderRadius: 20,
    paddingHorizontal: 32,
    paddingVertical: 28,
    alignItems: 'center',
    minWidth: 260,
  },
  panelTitle: {
    color: INK,
    fontSize: 24,
    fontWeight: '800',
  },
  panelSub: {
    color: '#8b8578',
    fontSize: 14,
    marginTop: 6,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#5b4bb7',
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
