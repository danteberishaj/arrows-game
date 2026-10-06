/**
 * W5-13: the wordmark's "A" moved from the mark.png Image to the mark.svg vector.
 * Its layout box must not move: the emblem slot, the mark's box, its margin and the
 * letters' margin are the numbers the PNG had. The size-56 literals are the ones in the
 * BASE snapshot (HomeScreen.compose.test.tsx.snap, written before W5-13): slot 51.52,
 * mark 80.5 x 80.5, marginTop -2.24. This file's layout cases passed against the
 * Image-based Wordmark before it was edited.
 * Layout on a device closes only on captures (jest has no layout engine).
 */
import { render } from '@testing-library/react-native';
import React from 'react';
import { Image, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { ReactTestRendererJSON } from 'react-test-renderer';
import { MARK_FACES, MARK_VIEWBOX } from '../brandMark';
import { Wordmark } from '../Wordmark';
import { Daylight, InkNight, Type } from '../theme';

type Node = ReactTestRendererJSON;

function parts(size: number, palette = Daylight) {
  const tree = render(<Wordmark size={size} palette={palette} />).toJSON() as Node;
  const row = tree;
  const slot = row.children![0] as Node;
  const mark = slot.children![0] as Node;
  const letters = row.children![1] as Node;
  return { row, slot, mark, letters };
}

/** The mark's box: flattened style, with width/height props as a fallback (Svg). */
function box(n: Node) {
  const s = StyleSheet.flatten(n.props.style) ?? {};
  return {
    width: s.width ?? n.props.width,
    height: s.height ?? n.props.height,
    marginTop: s.marginTop,
  };
}

describe('Wordmark layout box (unchanged by the vector mark)', () => {
  it('size 56 (menu and splash) keeps the BASE numbers', () => {
    const { slot, mark, letters } = parts(56);
    const slotStyle = StyleSheet.flatten(slot.props.style);
    expect(slotStyle.width).toBeCloseTo(51.52, 6);
    expect(slotStyle.height).toBeCloseTo(51.52, 6);
    expect(slotStyle.alignItems).toBe('center');
    expect(slotStyle.justifyContent).toBe('center');
    const b = box(mark);
    expect(Number(b.width)).toBeCloseTo(80.5, 6);
    expect(Number(b.height)).toBeCloseTo(80.5, 6);
    expect(b.marginTop).toBeCloseTo(-2.24, 6);
    expect(StyleSheet.flatten(letters.props.style).marginLeft).toBeCloseTo(2.24, 6);
  });

  it.each([24, 40, Type.wordmark.fontSize, 72])('size %p follows the PNG formulas', (size) => {
    const { slot, mark, letters } = parts(size);
    const triW = size * 0.92;
    const slotStyle = StyleSheet.flatten(slot.props.style);
    expect(slotStyle.width).toBeCloseTo(triW, 6);
    expect(slotStyle.height).toBeCloseTo(triW, 6);
    const b = box(mark);
    expect(Number(b.width)).toBeCloseTo(triW / 0.64, 6);
    expect(Number(b.height)).toBeCloseTo(triW / 0.64, 6);
    expect(b.marginTop).toBeCloseTo(-size * 0.04, 6);
    expect(StyleSheet.flatten(letters.props.style).marginLeft).toBeCloseTo(size * 0.04, 6);
  });

  it('the mark box does not depend on the theme (colours are baked in)', () => {
    expect(box(parts(56, Daylight).mark)).toEqual(box(parts(56, InkNight).mark));
  });
});

describe('Wordmark draws the vector mark', () => {
  it('renders the mark.svg faces, not the PNG, with the same fills in both themes', () => {
    for (const palette of [Daylight, InkNight]) {
      const r = render(<Wordmark size={56} palette={palette} />);
      expect(r.UNSAFE_queryAllByType(Image)).toHaveLength(0);
      const paths = r.UNSAFE_queryAllByType(Path);
      expect(paths.map((p) => p.props.fill)).toEqual(MARK_FACES.map((f) => f.fill));
      expect(paths.map((p) => p.props.d)).toEqual(MARK_FACES.map((f) => f.d));
      const svg = r.UNSAFE_getByType(Svg);
      expect(svg.props.viewBox).toBe(MARK_VIEWBOX);
      // react-native-svg parseInt()s numeric width/height (80.5 -> 80, measured in
      // this suite before the fix): the Svg must fill the exactly sized View instead.
      expect(svg.props.width).toBe('100%');
      expect(svg.props.height).toBe('100%');
    }
  });
});
