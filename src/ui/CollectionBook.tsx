import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { StylePreview } from './ArrowStyleOptions';
import { Haptic } from './haptics';
import { PetalIcon } from './PetalIcon';
import { PressScale, pressSnapTransform } from './PressScale';
import { REWARD_PATH, type RewardEntry } from './rewardCatalogue';
import { buyReward, etaFor, isRewardOwned, type RewardState } from './rewardLedger';
import { ARROW_STYLES } from './skinSpecs';
import { Type, type Palette } from './theme';

type BookScreen = { kind: 'grid' } | { kind: 'confirm'; entry: RewardEntry } | { kind: 'bought'; entry: RewardEntry };

function PurchasePreview({ entry, palette: p }: { entry: RewardEntry; palette: Palette }) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(reducedMotion ? 1 : .92);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  useEffect(() => {
    if (!reducedMotion) scale.value = withSpring(1, { damping: 14, stiffness: 220, reduceMotion: ReduceMotion.System });
  }, [reducedMotion, scale]);
  const style = ARROW_STYLES.find(s => s.id === entry.refId)!;
  return <View style={[styles.stage, { backgroundColor: p.bg }]}>
    <Animated.View style={animatedStyle}><StylePreview style={style} palette={p} size={3} /></Animated.View>
  </View>;
}

export function CollectionBook({ palette: p, state, onUse }: { palette: Palette; state: RewardState; onUse: (id: string) => void }) {
  const [screen, setScreen] = useState<BookScreen>({ kind: 'grid' });
  const petals = state.petals ?? 0;
  if (screen.kind === 'grid') {
    const entries = REWARD_PATH.filter(e => !isRewardOwned(e.rewardId));
    if (entries.length === 0) return <View testID="book-empty" style={styles.empty}>
      <Text style={[styles.caption, { color: p.inkDim }]}>All styles collected · new ones coming soon</Text>
    </View>;
    return <View testID="book-grid" style={styles.grid}>
      {entries.map(entry => {
        const style = ARROW_STYLES.find(s => s.id === entry.refId)!;
        const nextFree = state.next?.rewardId === entry.rewardId;
        const k = etaFor(entry.rewardId);
        const price = entry.price!;
        return <Pressable key={entry.rewardId} testID={`book-tile-${entry.refId}`} accessibilityRole="button"
          accessibilityLabel={`${entry.name}, ${price} petals${nextFree && k !== null ? `, free in ${k} ${k === 1 ? 'level' : 'levels'}` : ''}`}
          onPress={() => setScreen({ kind: 'confirm', entry })}
          style={[styles.tile, { backgroundColor: p.bg, borderColor: nextFree ? p.accent : p.border, borderStyle: nextFree ? 'dashed' : 'solid' }]}>
          <View style={{ opacity: nextFree ? 1 : .45 }}><StylePreview style={style} palette={p} /></View>
          <Text style={[styles.tileName, { color: p.ink }]}>{entry.name}</Text>
          {nextFree && k !== null && <Text style={[styles.tileCaption, { color: p.inkDim }]}>{`free in ${k}`}</Text>}
          <View style={styles.priceRow}>
            <PetalIcon size={11} />
            <Text style={[styles.tileName, { color: petals >= price ? p.accentText : p.inkDim }]}>{price}</Text>
          </View>
        </Pressable>;
      })}
    </View>;
  }

  const entry = screen.entry;
  if (screen.kind === 'confirm') {
    const price = entry.price!;
    const k = etaFor(entry.rewardId);
    const disabled = !state.canBuy || petals < price;
    const balanceLine = !state.canBuy ? 'Buying is paused right now' : petals >= price
      ? `You'll have ${petals - price} left`
      : `You need ${price - petals} more ${price - petals === 1 ? 'petal' : 'petals'}`;
    const buy = () => {
      const result = buyReward(entry.rewardId);
      if (result === 'bought') {
        Haptic.cleared();
        AccessibilityInfo.announceForAccessibility(`${entry.name} added to your styles`);
        setScreen({ kind: 'bought', entry });
      } else setScreen({ kind: 'grid' });
    };
    return <View testID="book-confirm" style={styles.purchase}>
      <PurchasePreview key="confirm" entry={entry} palette={p} />
      <Text style={[styles.name, { color: p.ink }]}>{entry.name}</Text>
      <Text style={[styles.caption, { color: p.inkDim }]}>{k === null ? 'Not on the path' : `On the path in ${k} ${k === 1 ? 'level' : 'levels'} · or get it now`}</Text>
      <PressScale testID="book-buy" accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
        onPress={buy} style={({ pressed }) => [styles.primary, disabled
          // UX: clearly unavailable — no fill, a dashed outline, dimmed label (not a pale look-alike of the CTA).
          ? { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: p.border }
          : { backgroundColor: pressed ? p.accentDeep : p.accent, transform: pressSnapTransform(pressed) }]}>
        <Text style={[styles.buttonText, { color: disabled ? p.inkDim : p.inkOnAccent }]}>{`Buy for ${price} petals`}</Text>
      </PressScale>
      <Text style={[styles.caption, { color: p.inkDim }]}>{balanceLine}</Text>
      <Pressable testID="book-not-now" accessibilityRole="button" onPress={() => setScreen({ kind: 'grid' })} style={styles.secondary}>
        <Text style={[styles.caption, { color: p.inkDim }]}>Not now</Text>
      </Pressable>
    </View>;
  }

  const ownedSkins = ARROW_STYLES.filter(s => isRewardOwned(s.numericId)).length;
  return <View testID="book-bought" style={styles.purchase}>
    <View style={[styles.badge, { borderColor: p.accentText }]}>
      <Text style={[styles.badgeText, { color: p.accentText }]}>ADDED TO YOUR STYLES</Text>
    </View>
    <PurchasePreview key="bought" entry={entry} palette={p} />
    <Text style={[styles.name, { color: p.ink }]}>{entry.name}</Text>
    <Text style={[styles.caption, { color: p.inkDim }]}>{`${ownedSkins} of 18 styles collected`}</Text>
    <PressScale testID="book-use" accessibilityRole="button" onPress={() => onUse(entry.refId)}
      style={({ pressed }) => [styles.primary, { backgroundColor: pressed ? p.accentDeep : p.accent, transform: pressSnapTransform(pressed) }]}>
      <Text style={[styles.buttonText, { color: p.inkOnAccent }]}>Use it now</Text>
    </PressScale>
    <Pressable testID="book-back" accessibilityRole="button" onPress={() => setScreen({ kind: 'grid' })} style={styles.secondary}>
      <Text style={[styles.caption, { color: p.inkDim }]}>Back to the book</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, padding: 12 },
  tile: { width: '31%', minHeight: 96, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 4, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', gap: 5 },
  tileName: { ...Type.menuStats, textAlign: 'center' },
  tileCaption: { ...Type.menuStats, textAlign: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  empty: { padding: 24 },
  purchase: { padding: 12, alignItems: 'center', gap: 12 },
  stage: { width: 210, height: 104, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  name: { ...Type.panelTitle, textAlign: 'center' },
  caption: { ...Type.panelSub, textAlign: 'center' },
  primary: { minHeight: 52, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderRadius: 28, paddingHorizontal: 12 },
  buttonText: { ...Type.panelButton, textAlign: 'center' },
  secondary: { minHeight: 48, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  badge: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText: { ...Type.menuStats },
});
