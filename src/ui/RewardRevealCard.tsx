import React, { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
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
  // Only the preview pops (scale, never opacity): the card's visibility stays with the guarded panel motion.
  const previewScale = useSharedValue(reducedMotion ? 1 : .92);
  const previewStyle = useAnimatedStyle(() => ({ transform: [{ scale: previewScale.value }] }));
  useEffect(() => {
    onShown();
    AccessibilityInfo.announceForAccessibility(`New style unlocked: ${entry.name}`);
  }, []);
  useEffect(() => {
    if (!reducedMotion) previewScale.value = withSpring(1, { damping: 14, stiffness: 220, reduceMotion: ReduceMotion.System });
  }, [reducedMotion, previewScale]);
  useEffect(() => {
    if (!reducedMotion) sparkleOpacity.value = withSequence(withTiming(1, { duration: 300, reduceMotion: ReduceMotion.System }), withTiming(.6, { duration: 300, reduceMotion: ReduceMotion.System }));
  }, [reducedMotion, sparkleOpacity]);
  return <View testID="reward-reveal" style={styles.content} accessibilityViewIsModal
    accessibilityLabel={`New style unlocked: ${entry.name}`}>
    <View style={[styles.badge, { borderColor: p.accentText }]}>
      <Text style={[styles.badgeText, { color: p.accentText }]}>NEW STYLE UNLOCKED</Text>
    </View>
    <View style={[styles.stage, { backgroundColor: skinBoardPalette(p, style.spec, dark).bg }]}>
      <Animated.View style={previewStyle}><StylePreview style={style} palette={p} size={3} /></Animated.View>
      {!reducedMotion && [{ top: 10, left: 12 }, { top: 12, right: 14 }, { bottom: 10, right: 22 }].map((position, i) =>
        <Animated.View key={i} testID="reward-sparkle" accessible={false} accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants" style={[styles.sparkle, position, sparkleStyle]}>
          <Icon name="sparkle" size={18} color={p.accent} />
        </Animated.View>)}
    </View>
    <Text style={[styles.name, { color: p.ink }]}>{entry.name}</Text>
    <Text style={[styles.caption, { color: p.inkDim }]}>{`${ownedSkins} of ${ARROW_STYLES.length} styles collected`}</Text>
    <PressScale testID="reward-use" disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
      onPress={onUse} style={({ pressed }) => [styles.primary, { backgroundColor: pressed ? p.accentDeep : p.accent, transform: pressSnapTransform(pressed) }]}>
      <Text style={[styles.buttonText, { color: p.inkOnAccent }]}>{`${mode === 'daily' ? 'Use' : 'Play with'} ${entry.name}`}</Text>
    </PressScale>
    <Pressable testID="reward-keep" disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
      onPress={onKeep} style={styles.secondary}>
      <Text style={[styles.caption, { color: p.inkDim }]}>Keep my current style</Text>
    </Pressable>
    {next && <Text style={[styles.caption, { color: p.inkDim }]}>{`Up next: ${next.name} · ${k} ${k === 1 ? 'level' : 'levels'}`}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', gap: 12, alignSelf: 'stretch' },
  badge: { borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText: { ...Type.menuStats },
  stage: { width: 210, height: 104, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sparkle: { position: 'absolute' },
  name: { ...Type.panelTitle, textAlign: 'center' },
  caption: { ...Type.panelSub, textAlign: 'center' },
  primary: { minHeight: 52, borderRadius: 28, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  buttonText: { ...Type.panelButton, textAlign: 'center' },
  secondary: { minHeight: 48, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
});
