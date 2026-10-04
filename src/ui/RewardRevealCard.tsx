import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { StylePreview } from './ArrowStyleOptions';
import { Icon } from './icons';
import { PressScale, pressSnapTransform } from './PressScale';
import { PATH_TOTALS, REWARD_PATH } from './rewardCatalogue';
import type { ClearReward } from './rewardLedger';
import { skinBoardPalette } from './skinBoardPalette';
import { ARROW_STYLES } from './skinSpecs';
import { Type, type Palette } from './theme';

interface RewardRevealCardProps {
  unlock: NonNullable<ClearReward['unlock']>;
  mode: 'campaign' | 'daily';
  levelNumber: number;
  points: number;
  palette: Palette;
  dark: boolean;
  reducedMotion: boolean;
  disabled: boolean;
  onUse: () => void;
  onKeep: () => void;
  onShown: () => void;
}

/** Content of the existing win panel; only its decorative sparkles animate here. */
export function RewardRevealCard({ unlock, mode, levelNumber, points, palette: p, dark,
  reducedMotion, disabled, onUse, onKeep, onShown }: RewardRevealCardProps) {
  const { entry, pathIndex, ownedSkins } = unlock;
  const style = ARROW_STYLES.find(s => s.id === entry.refId)!;
  const next = REWARD_PATH[pathIndex + 1];
  const k = PATH_TOTALS[pathIndex + 1] - points;
  const sparkleOpacity = useSharedValue(0);
  const sparkleStyle = useAnimatedStyle(() => ({ opacity: sparkleOpacity.value }));
  useEffect(() => { onShown(); }, []);
  useEffect(() => {
    if (!reducedMotion) sparkleOpacity.value = withSequence(withTiming(1, { duration: 300, reduceMotion: ReduceMotion.System }), withTiming(.6, { duration: 300, reduceMotion: ReduceMotion.System }));
  }, [reducedMotion, sparkleOpacity]);
  return <View testID="reward-reveal" style={styles.content} accessibilityViewIsModal
    accessibilityLabel={`New style unlocked: ${entry.name}`}>
    <View style={[styles.badge, { backgroundColor: p.accent }]}>
      <Text style={[styles.badgeText, { color: p.inkOnAccent }]}>NEW STYLE UNLOCKED</Text>
    </View>
    <View style={[styles.stage, { backgroundColor: skinBoardPalette(p, style.spec, dark).bg }]}>
      <View style={styles.preview}><StylePreview style={style} palette={p} /></View>
      {!reducedMotion && [{ top: 10, left: 12 }, { top: 12, right: 14 }, { bottom: 10, right: 22 }].map((position, i) =>
        <Animated.View key={i} testID="reward-sparkle" accessible={false} accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants" style={[styles.sparkle, position, sparkleStyle]}>
          <Icon name="sparkle" size={18} color={p.accent} />
        </Animated.View>)}
    </View>
    <Text style={[styles.name, { color: p.ink }]}>{entry.name}</Text>
    <Text style={[styles.caption, { color: p.inkDim }]}>{`Style ${ownedSkins} of ${ARROW_STYLES.length} · unlocked on ${mode === 'daily' ? "today's daily" : `level ${levelNumber}`}`}</Text>
    <View style={styles.chips}>{entry.chips.map(chip => <View key={chip} style={[styles.chip, { backgroundColor: p.bg }]}>
      <Text style={[styles.chipText, { color: p.inkDim }]}>{chip}</Text>
    </View>)}</View>
    <PressScale testID="reward-use" disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
      onPress={onUse} style={({ pressed }) => [styles.primary, { backgroundColor: pressed ? p.accentDeep : p.accent, transform: pressSnapTransform(pressed) }]}>
      <Text style={[styles.buttonText, { color: p.inkOnAccent }]}>{`${mode === 'daily' ? 'Use' : 'Play with'} ${entry.name}`}</Text>
    </PressScale>
    <Pressable testID="reward-keep" disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
      onPress={onKeep} style={styles.secondary}>
      <Text style={[styles.caption, { color: p.inkDim }]}>{mode === 'daily' ? 'Keep current style' : 'Keep current style · Next level'}</Text>
    </Pressable>
    {next && <Text style={[styles.caption, { color: p.inkDim }]}>{`Up next: ${next.name} · ${k} ${k === 1 ? 'level' : 'levels'}`}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', gap: 12, alignSelf: 'stretch' },
  badge: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { ...Type.menuStats },
  stage: { width: 210, height: 104, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  preview: { width: 54, height: 30, transform: [{ scale: 3 }] },
  sparkle: { position: 'absolute' },
  name: { ...Type.panelTitle, textAlign: 'center' },
  caption: { ...Type.panelSub, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  chip: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  chipText: { ...Type.menuStats },
  primary: { minHeight: 52, borderRadius: 28, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  buttonText: { ...Type.panelButton, textAlign: 'center' },
  secondary: { minHeight: 44, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
});
