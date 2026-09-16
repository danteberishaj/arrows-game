import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { Palette } from './theme';

/** Disabled glyph opacity. OWNER-PICKED STARTING VALUE (not measured). */
const DISABLED_GLYPH_OPACITY = 0.35; // OWNER-PICKED STARTING VALUE

/** Off-state strike: diagonal from STRIKE_INSET to 1 - STRIKE_INSET of the button. */
const STRIKE_INSET = 0.27; // OWNER-PICKED STARTING VALUE
const STRIKE_WIDTH_RATIO = 0.055; // OWNER-PICKED STARTING VALUE (2.4 dp at size 44)

const BORDER_WIDTH = 1;

/** Small round surface button with a glyph (sound / theme / home). */
export const HeaderButton = React.memo(function HeaderButton({
  label,
  active = true,
  off = false,
  disabled = false,
  palette,
  onPress,
  size = 36,
}: {
  label: string;
  active?: boolean;
  /**
   * A toggle that is off (sound). Drawn by SHAPE, not colour alone: a diagonal
   * strike across the glyph, in the glyph's colour.
   */
  off?: boolean;
  /** Not pressable; the glyph uses the same inactive colour as `active=false`. */
  disabled?: boolean;
  palette: Palette;
  onPress: () => void;
  size?: number;
}) {
  const glyphColor = active && !off && !disabled ? palette.accentCore : palette.glyphOff;
  const inner = size - 2 * BORDER_WIDTH; // absolute children sit inside the border
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled }}
      hitSlop={8}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 3,
        borderWidth: BORDER_WIDTH,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? palette.heartLost : palette.surface,
        borderColor: palette.border,
        transform: [{ scale: pressed ? 0.94 : 1 }], // ButtonPress.cs press-feel
      })}
    >
      <Text
        style={{
          color: glyphColor,
          // Colour alone cannot mark a disabled emoji glyph (💡 renders in full
          // colour on Android whatever `color` says), so it is also dimmed.
          opacity: disabled ? DISABLED_GLYPH_OPACITY : 1,
          fontSize: size * 0.44,
        }}
      >
        {label}
      </Text>
      {off && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, top: 0, width: inner, height: inner }}
        >
          <Svg width={inner} height={inner}>
            <Line
              x1={inner * STRIKE_INSET}
              y1={inner * STRIKE_INSET}
              x2={inner * (1 - STRIKE_INSET)}
              y2={inner * (1 - STRIKE_INSET)}
              stroke={glyphColor}
              strokeWidth={size * STRIKE_WIDTH_RATIO}
              strokeLinecap="round"
            />
          </Svg>
        </View>
      )}
    </Pressable>
  );
});
