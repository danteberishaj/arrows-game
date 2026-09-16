import React from 'react';
import { Pressable, Text } from 'react-native';
import { Palette } from './theme';

/** Disabled glyph opacity. OWNER-PICKED STARTING VALUE (not measured). */
const DISABLED_GLYPH_OPACITY = 0.35; // OWNER-PICKED STARTING VALUE

/** Small round surface button with a glyph (sound / theme / home). */
export const HeaderButton = React.memo(function HeaderButton({
  label,
  active = true,
  disabled = false,
  palette,
  onPress,
  size = 36,
}: {
  label: string;
  active?: boolean;
  /** Not pressable; the glyph uses the same inactive colour as `active=false`. */
  disabled?: boolean;
  palette: Palette;
  onPress: () => void;
  size?: number;
}) {
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
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? palette.border : palette.surface,
        borderColor: palette.border,
        transform: [{ scale: pressed ? 0.94 : 1 }], // ButtonPress.cs press-feel
      })}
    >
      <Text
        style={{
          color: active && !disabled ? palette.accentCore : palette.heartLost,
          // Colour alone cannot mark a disabled emoji glyph (💡 renders in full
          // colour on Android whatever `color` says), so it is also dimmed.
          opacity: disabled ? DISABLED_GLYPH_OPACITY : 1,
          fontSize: size * 0.44,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
});
