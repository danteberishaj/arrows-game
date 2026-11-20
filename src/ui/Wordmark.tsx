import React from 'react';
import { Image, Text, View } from 'react-native';
import { Fonts, Palette } from './theme';

/** Buddy, cut out and cropped to his art (scripts/art/render-buddy-icon.mjs: the release's costume, ACTIVE). */
export const BUDDY = require('../../assets/images/buddy/buddy-active.png');

/**
 * ICON-01 (owner pick 2026-11-20): the menu lockup is Buddy sitting above the word "Arrows", the same lockup the
 * splash ends on. Buddy fits a `size * 1.6` square (his crop is near square); his colours are baked in (dark outline), so he reads on both themes.
 */
export function Wordmark({ size, palette }: { size: number; palette: Palette }) {
  const h = size * 1.6;
  return (
    // TF-02 C: one spoken heading, "Arrows"; Buddy is decoration.
    <View style={{ alignItems: 'center' }} accessible accessibilityRole="header" accessibilityLabel="Arrows">
      <Image source={BUDDY} resizeMode="contain" style={{ width: h, height: h, marginBottom: size * 0.08 }} />
      <Text
        style={{
          fontSize: size,
          fontFamily: Fonts.bold,
          color: palette.ink,
          letterSpacing: size * 0.01,
          includeFontPadding: false,
        }}
      >
        Arrows
      </Text>
    </View>
  );
}
