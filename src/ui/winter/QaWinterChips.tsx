import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { QA_WINTER_SWITCH } from '../../featureFlags';
import { qaGrantPetals } from '../rewardLedger';
import { ambienceVariants, getAmbienceVariant, setAmbienceVariant } from '../ambience';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Palette } from '../theme';
import { BOARD_LOOKS, cycle, EXIT_LOOKS, LIGHTS_LOOKS, MENU_LOOKS, setWinterLook, useWinterLook } from './winterLook';

const MENU_NAMES = { 'lights-hills': '3D', painted: 'Painted', hills: 'Hills', off: 'Off' } as const;
/** Below the header (64 dp) and the garland (~105 dp at 411 dp width), above the wordmark. */
const QA_ROW_TOP = 178;
const BOARD_NAMES = { auto: 'Auto', frame: 'Frame', snow: 'Snow', off: 'Off' } as const;
const EXIT_NAMES = { full: 'Full', lite: 'Lite', off: 'Off' } as const;
const LIGHTS_NAMES = { breathe: 'On', off: 'Off' } as const;

/**
 * WINTER-01 QA only (EXPO_PUBLIC_QA_WINTER_SWITCH=1): one row of chips in the empty band under the garland, above the logo (clear of all winter art) that switch the winter menu
 * look, the board look under Winter skins, and the ambience track, instantly, for owner review. Never in store builds.
 */
export function QaWinterChips({ palette: p }: { palette: Palette; top?: number }) {
  const look = useWinterLook();
  const insets = useSafeAreaInsets();
  const [track, setTrack] = useState(getAmbienceVariant());
  if (!QA_WINTER_SWITCH) return null;
  const tracks = ambienceVariants();
  const chip = (label: string, onPress: () => void, testID: string) => (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={[styles.chip, { borderColor: p.border, backgroundColor: p.surface }]}>
      <Text style={[styles.text, { color: p.ink }]}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={[styles.row, { top: insets.top + QA_ROW_TOP }]}>
      {chip(`Menu ${MENU_NAMES[look.menu]}`, () => setWinterLook({ menu: cycle(MENU_LOOKS, look.menu) }), 'qa-winter-menu')}
      {chip(`Board ${BOARD_NAMES[look.board]}`, () => setWinterLook({ board: cycle(BOARD_LOOKS, look.board) }), 'qa-winter-board')}
      {chip(`Exit ${EXIT_NAMES[look.exit]}`, () => setWinterLook({ exit: cycle(EXIT_LOOKS, look.exit) }), 'qa-winter-exit')}
      {chip(`Lights ${LIGHTS_NAMES[look.lights]}`, () => setWinterLook({ lights: cycle(LIGHTS_LOOKS, look.lights) }), 'qa-winter-lights')}
      {tracks.length > 0 && chip(`♪ ${tracks[track] ?? 'Off'}`, () => {
        const next = (track + 1) % tracks.length;
        setAmbienceVariant(next);
        setTrack(next);
      }, 'qa-winter-music')}
      {chip('+20 ✿', () => qaGrantPetals(20), 'qa-winter-petals')}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { position: 'absolute', left: 8, right: 8, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 22, borderWidth: 1, opacity: 0.92 },
  text: { fontSize: 12, fontWeight: '600' },
});
