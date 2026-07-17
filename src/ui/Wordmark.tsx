import React from 'react';
import { Image, Text, View } from 'react-native';
import { Fonts, Palette } from './theme';

/**
 * The "Arrows" wordmark with the capital A drawn as the brand mark — the
 * generated interlocking-arrowhead emblem (violet + magenta, colors baked in,
 * so it reads on both Daylight and Ink Night). Ported from Bootstrap.BuildLogo.
 */
export function Wordmark({ size, palette }: { size: number; palette: Palette }) {
  const triW = size * 0.92; // the A's footprint in the wordmark layout
  // The emblem's cutout has transparent margins (~18% per side); oversize its
  // rect so the VISIBLE mark matches the triangle footprint.
  const rectW = triW / 0.64;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View
        style={{
          width: triW,
          height: triW,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          source={require('../../assets/images/mark.png')}
          style={{ width: rectW, height: rectW, marginTop: -size * 0.04 }}
          resizeMode="contain"
        />
      </View>
      <Text
        style={{
          fontSize: size,
          fontFamily: Fonts.bold,
          color: palette.ink,
          marginLeft: size * 0.04,
          letterSpacing: size * 0.01,
          includeFontPadding: false,
        }}
      >
        rrows
      </Text>
    </View>
  );
}
