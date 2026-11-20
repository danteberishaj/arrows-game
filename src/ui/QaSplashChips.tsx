import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QA_SPLASH_SWITCH } from '../featureFlags';
import { getQaSeason, nextQaSeason } from './splashSeason';
import { getSplashSlowmo, getSplashVariant, nextSplashVariant, SPLASH_NAMES, toggleSplashSlowmo } from './splashVariant';
import { Type, type Palette } from './theme';

/**
 * SPLASH-VARIANTS QA only (EXPO_PUBLIC_QA_SPLASH_SWITCH=1): on the menu, "Splash: <name>" picks the next intro, "▶ Replay"
 * plays it, "1×" / "8×" slows it down to study and
 * "Season: …" forces a season's decor (auto = by date). Sits under the winter QA row (QaWinterChips, top + 178). Never in store builds.
 */
export function QaSplashChips({ palette: p, onReplay }: { palette: Palette; onReplay: () => void }) {
  const insets = useSafeAreaInsets();
  const [variant, setVariant] = useState(getSplashVariant());
  const [slow, setSlow] = useState(getSplashSlowmo());
  const [season, setSeason] = useState(getQaSeason());
  if (!QA_SPLASH_SWITCH) return null;
  const chip = (label: string, onPress: () => void, testID: string) => (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={[styles.chip, { borderColor: p.border, backgroundColor: p.surface }]}>
      <Text style={[styles.text, { color: p.ink }]}>{label}</Text>
    </Pressable>
  );
  return (
    <View pointerEvents="box-none" style={[styles.row, { top: insets.top + 230 }]}>
      {chip(`Splash: ${SPLASH_NAMES[variant]}`, () => setVariant(nextSplashVariant()), 'qa-splash-next')}
      {chip('▶ Replay', onReplay, 'qa-splash-replay')}
      {chip(`${slow}×`, () => setSlow(toggleSplashSlowmo()), 'qa-splash-speed')}
      {chip(`Season: ${season}`, () => setSeason(nextQaSeason()), 'qa-splash-season')}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { position: 'absolute', left: 8, right: 8, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, opacity: 0.92 },
  text: { ...Type.menuStats },
});
