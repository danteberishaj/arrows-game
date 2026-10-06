import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { MARK_FACES, MARK_VIEWBOX } from './brandMark';
import { Fonts, Palette } from './theme';

/**
 * The "Arrows" wordmark with the capital A drawn as the brand mark — the
 * interlocking-arrowhead emblem (violet + magenta, colors baked in, so it
 * reads on both Daylight and Ink Night). Ported from Bootstrap.BuildLogo.
 * W5-13: the emblem is the vector `assets/images/mark.svg` (faces in
 * `brandMark.ts`), drawn in the same box the 512 px mark.png had.
 */
export function Wordmark({ size, palette }: { size: number; palette: Palette }) {
  const triW = size * 0.92; // the A's footprint in the wordmark layout
  // The emblem's frame has transparent margins (~18% per side); oversize its
  // box so the VISIBLE mark matches the triangle footprint.
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
        {/* The box is a View: react-native-svg parseInt()s numeric Svg width/height
            (80.5 -> 80), so the Svg fills an exactly sized View instead. */}
        <View style={{ width: rectW, height: rectW, marginTop: -size * 0.04 }}>
          <Svg width="100%" height="100%" viewBox={MARK_VIEWBOX}>
            {MARK_FACES.map((f) => (
              <Path key={f.id} d={f.d} fill={f.fill} />
            ))}
          </Svg>
        </View>
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
