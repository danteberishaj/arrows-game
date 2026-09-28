import React from 'react';
import { Text, View, type AccessibilityRole } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { ART_ICONS_ENABLED } from './artConfig';
import { Icon, type IconName } from './icons';
import { PressScale, pressSnapTransform } from './PressScale';
import { Palette } from './theme';

/** Disabled glyph opacity. OWNER-PICKED STARTING VALUE (not measured). */
const DISABLED_GLYPH_OPACITY = 0.35; // OWNER-PICKED STARTING VALUE

/** Off-state strike: diagonal from STRIKE_INSET to 1 - STRIKE_INSET of the button. */
const STRIKE_INSET = 0.27; // OWNER-PICKED STARTING VALUE
const STRIKE_WIDTH_RATIO = 0.055; // OWNER-PICKED STARTING VALUE (2.4 dp at size 44)

const BORDER_WIDTH = 1;

/** W5-02 (ART_ICONS_ENABLED): the icon's edge as a fraction of the button (18 dp at 36, 22 dp at 44). */
const ICON_SIZE_RATIO = 0.5; // OWNER-PICKED STARTING VALUE

/** Small round surface button with a glyph (sound / theme / home). */
export const HeaderButton = React.memo(function HeaderButton({
  label,
  icon,
  active = true,
  off = false,
  disabled = false,
  palette,
  onPress,
  size = 36,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityHint,
  checked,
}: {
  label: string;
  /**
   * W5-02 (ART_ICONS_ENABLED only): an SVG icon drawn in the glyph's colour instead of the `label` glyph (the
   * screen-reader name is always `accessibilityLabel`). An icon carries its
   * own off shape (sound off: speaker + slash), so `off` then sets the colour and draws no strike. Ignored while
   * the flag is off.
   */
  icon?: IconName;
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
  /** 'button' unless given (toggles such as the "#" grid-lines switch pass 'switch' and `checked`). */
  accessibilityRole?: AccessibilityRole;
  /**
   * A11Y-LABELS: the screen-reader name, in plain words, for every button in both ART_ICONS arms. Required: the
   * glyph (`label`) is never a name (TalkBack read "‹" as "single left-pointing angle quotation mark").
   */
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** A switch's state for TalkBack/VoiceOver; omitted = not a switch. */
  checked?: boolean;
}) {
  const glyphColor = active && !off && !disabled ? palette.accentCore : palette.glyphOff;
  const inner = size - 2 * BORDER_WIDTH; // absolute children sit inside the border
  // W5-02: with the flag on, the icon replaces the glyph (when the caller gives one) and every button is a circle.
  const iconName = ART_ICONS_ENABLED ? icon : undefined;
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled}
      accessibilityState={checked === undefined ? { disabled } : { checked, disabled }}
      aria-checked={checked} // react-native-web reads the ARIA prop, not accessibilityState
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      hitSlop={8}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: ART_ICONS_ENABLED ? size / 2 : size / 3,
        borderWidth: BORDER_WIDTH,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? palette.heartLost : palette.surface,
        borderColor: palette.border,
        transform: pressSnapTransform(pressed), // ButtonPress.cs press-feel (POLISH-T9: eased when META_PRESS_SPRING)
      })}
    >
      {iconName !== undefined ? (
        // The icon takes the palette colour (the emoji did not), so a disabled icon is `glyphOff`, not dimmed.
        <Icon name={iconName} size={size * ICON_SIZE_RATIO} color={glyphColor} />
      ) : (
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
      )}
      {off && iconName === undefined && (
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
    </PressScale>
  );
});
