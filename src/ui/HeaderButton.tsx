import React from 'react';
import { Pressable, Text } from 'react-native';
import { Palette } from './theme';

/** Small round surface button with a glyph (sound / theme / home). */
export function HeaderButton({
  label,
  active = true,
  palette,
  onPress,
  size = 36,
}: {
  label: string;
  active?: boolean;
  palette: Palette;
  onPress: () => void;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
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
      <Text style={{ color: active ? palette.accentCore : palette.heartLost, fontSize: size * 0.44 }}>
        {label}
      </Text>
    </Pressable>
  );
}
