/**
 * ICON-01: the menu lockup is Buddy above the word "Arrows". Layout on a device closes only on captures (jest has no
 * layout engine); this pins the structure and the size formula.
 */
import { render } from '@testing-library/react-native';
import React from 'react';
import { Image, StyleSheet, Text } from 'react-native';
import { BUDDY, Wordmark } from '../Wordmark';
import { Daylight, InkNight, Type } from '../theme';

describe('Wordmark: Buddy above "Arrows"', () => {
  it.each([24, Type.wordmark.fontSize, 72])('size %p: Buddy is 1.6x the letters tall, above the full word', (size) => {
    const r = render(<Wordmark size={size} palette={Daylight} />);
    const img = r.UNSAFE_getByType(Image);
    expect(img.props.source).toBe(BUDDY);
    expect(StyleSheet.flatten(img.props.style).height).toBeCloseTo(size * 1.6, 6);
    const text = r.UNSAFE_getByType(Text);
    expect(text.props.children).toBe('Arrows');
    expect(StyleSheet.flatten(text.props.style).fontSize).toBe(size);
  });

  it('is one "Arrows" heading and the letters follow the theme ink', () => {
    for (const palette of [Daylight, InkNight]) {
      const r = render(<Wordmark size={56} palette={palette} />);
      expect(r.getByRole('header', { name: 'Arrows' })).toBeTruthy();
      expect(StyleSheet.flatten(r.UNSAFE_getByType(Text).props.style).color).toBe(palette.ink);
    }
  });
});
