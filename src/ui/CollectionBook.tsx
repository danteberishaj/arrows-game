import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { StylePreview } from './ArrowStyleOptions';
import { Haptic } from './haptics';
import { PetalAdButton } from './PetalAdButton';
import { PetalIcon } from './PetalIcon';
import { PressScale, pressSnapTransform } from './PressScale';
import { PumpkinIcon } from './PumpkinIcon';
import { REWARD_PATH, SEASONAL_REWARDS, isStyleVisible, visibleStyleCounts, type RewardEntry } from './rewardCatalogue';
import { buyReward, etaFor, isRewardOwned, type RewardState } from './rewardLedger';
import { seasonTitle, type Season } from './seasons';
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

/** Unowned seasonal styles visible now, grouped by season in catalogue order (HALLOWEEN-01). */
export function openSeasons(state: RewardState, now: Date): { season: Season; entries: RewardEntry[] }[] {
  const groups: { season: Season; entries: RewardEntry[] }[] = [];
  for (const entry of SEASONAL_REWARDS) {
    if (isRewardOwned(entry.rewardId) || !isStyleVisible(entry.rewardId, isRewardOwned, state.seasons === true, now)) continue;
    const group = groups.find(g => g.season.id === entry.season!.id);
    if (group) group.entries.push(entry); else groups.push({ season: entry.season!, entries: [entry] });
  }
  return groups;
}

export function CollectionBook({ palette: p, state, onUse, now = new Date() }:
  { palette: Palette; state: RewardState; onUse: (id: string) => void; now?: Date }) {
  const [screen, setScreen] = useState<BookScreen>({ kind: 'grid' });
  const petals = state.petals ?? 0;
  if (screen.kind === 'grid') {
    const entries = REWARD_PATH.filter(e => !isRewardOwned(e.rewardId));
    const seasons = openSeasons(state, now);
    if (entries.length === 0 && seasons.length === 0) return <View testID="book-empty" style={styles.empty}>
      <Text style={[styles.caption, { color: p.inkDim }]}>All styles collected · new ones coming soon</Text>
    </View>;
    const tile = (entry: RewardEntry) => {
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
    };
    return <View testID="book-grid">
      {state.petalAds === true && <View style={styles.adSlot}><PetalAdButton palette={p} state={state} now={now} /></View>}
      {seasons.map(({ season, entries: seasonal }) => <View key={season.id} testID={`book-season-${season.id}`}>
        <View style={styles.seasonHeader} accessibilityRole="header" accessible>
          <PumpkinIcon size={16} />
          <Text style={[styles.seasonTitle, { color: p.ink }]}>{seasonTitle(season)}</Text>
        </View>
        <View style={styles.grid}>{seasonal.map(tile)}</View>
      </View>)}
      {entries.length > 0 && <View style={styles.grid}>{entries.map(tile)}</View>}
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
      const result = buyReward(entry.rewardId, now);
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
      {state.petalAds === true && state.canBuy && petals < price && <PetalAdButton palette={p} state={state} now={now} />}
      <Pressable testID="book-not-now" accessibilityRole="button" onPress={() => setScreen({ kind: 'grid' })} style={styles.secondary}>
        <Text style={[styles.caption, { color: p.inkDim }]}>Not now</Text>
      </Pressable>
    </View>;
  }

  const counts = visibleStyleCounts(isRewardOwned, state.seasons === true, now);
  return <View testID="book-bought" style={styles.purchase}>
    <View style={[styles.badge, { borderColor: p.accentText }]}>
      <Text style={[styles.badgeText, { color: p.accentText }]}>ADDED TO YOUR STYLES</Text>
    </View>
    <PurchasePreview key="bought" entry={entry} palette={p} />
    <Text style={[styles.name, { color: p.ink }]}>{entry.name}</Text>
    <Text style={[styles.caption, { color: p.inkDim }]}>{`${counts.owned} of ${counts.total} styles collected`}</Text>
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
  seasonHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingTop: 12 },
  seasonTitle: { ...Type.menuStats },
  tile: { width: '31%', minHeight: 96, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 4, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', gap: 5 },
  tileName: { ...Type.menuStats, textAlign: 'center' },
  tileCaption: { ...Type.menuStats, textAlign: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  empty: { padding: 24 },
  adSlot: { paddingHorizontal: 12, paddingTop: 12 },
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
