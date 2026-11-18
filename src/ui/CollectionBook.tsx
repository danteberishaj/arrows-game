import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, { ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { SkinThumb, StylePreview } from './ArrowStyleOptions';
import { SKIN_HERO_SIZE, SkinHeroBoard, skinHeroAvailable } from './SkinHeroBoard';
import { Haptic } from './haptics';
import { PetalAdButton } from './PetalAdButton';
import { PetalIcon } from './PetalIcon';
import { META_MOTION_POLISH } from '../featureFlags';
import { linkPressedStyle, PressScale, pressSnapTransform, tilePressedStyle } from './PressScale';
import { useSheetBackStep } from './sheetBack';
import { PumpkinIcon } from './PumpkinIcon';
import { seasonNow } from './seasonClock';
import { REWARD_PATH, SEASONAL_REWARDS, isStyleVisible, visibleStyleCounts, type RewardEntry } from './rewardCatalogue';
import { buyReward, etaFor, isRewardOwned, type RewardState } from './rewardLedger';
import { seasonTitle, type Season } from './seasons';
import { ARROW_STYLES } from './skinSpecs';
import { Type, type Palette } from './theme';

type BookScreen = { kind: 'grid' } | { kind: 'confirm'; entry: RewardEntry } | { kind: 'bought'; entry: RewardEntry };

function PurchasePreview({ entry, palette: p, dark, demo }: { entry: RewardEntry; palette: Palette; dark: boolean; demo: boolean }) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(reducedMotion ? 1 : .92);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  useEffect(() => {
    // MOTION-AUDIT: mass 1 (Reanimated 4's default is 4, which halves the damping ratio to ~0.24). OFF: as before.
    if (!reducedMotion) scale.value = withSpring(1, { damping: 14, stiffness: 220, ...(META_MOTION_POLISH && { mass: 1 }), reduceMotion: ReduceMotion.System });
  }, [reducedMotion, scale]);
  const style = ARROW_STYLES.find(s => s.id === entry.refId)!;
  if (skinHeroAvailable()) return <Animated.View style={[SKIN_HERO_SIZE, animatedStyle]}>
    <SkinHeroBoard style={style} palette={p} dark={dark} demo={demo} />
  </Animated.View>;
  return <View style={[styles.stage, { backgroundColor: p.bg }]}>
    <Animated.View style={animatedStyle}><StylePreview style={style} palette={p} size={3} /></Animated.View>
  </View>;
}

/** Decorative season mark beside the section heading (the heading carries the label). Explicit per season id. */
export function SeasonIcon({ id, palette: p, size = 16 }: { id: string; palette: Palette; size?: number }) {
  if (id === 'halloween') return <PumpkinIcon size={size} />;
  const svg = (testID: string, children: React.ReactNode) =>
    <Svg testID={testID} accessible={false} width={size} height={size} viewBox="0 0 20 20">{children}</Svg>;
  // New Year: a static four-point sparkle with a small companion star.
  if (id === 'new-year') return svg('season-icon-new-year', <>
    <Path d="M8 1.5L9.6 6.4L14.5 8L9.6 9.6L8 14.5L6.4 9.6L1.5 8L6.4 6.4Z" fill="#FFD24A" stroke="#9A633F" strokeWidth={1} strokeLinejoin="round" />
    <Path d="M15 11.5L15.8 14.2L18.5 15L15.8 15.8L15 18.5L14.2 15.8L11.5 15L14.2 14.2Z" fill="#B8A4EB" stroke="#8068B8" strokeWidth={.8} strokeLinejoin="round" />
  </>);
  // Winter: a six-armed snowflake with small chevrons.
  if (id === 'winter') return svg('season-icon-winter', <Path
    d="M10 1.5V18.5M2.6 5.75L17.4 14.25M2.6 14.25L17.4 5.75M8 3L10 5L12 3M8 17L10 15L12 17M3.5 8.7L6.2 9.1L5.2 6.6M16.5 11.3L13.8 10.9L14.8 13.4M3.5 11.3L6.2 10.9L5.2 13.4M16.5 8.7L13.8 9.1L14.8 6.6"
    fill="none" stroke="#5B7FB0" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />);
  // Christmas: a small pine tree with a gold star.
  if (id === 'christmas') return svg('season-icon-christmas', <>
    <Path d="M10 3.5L15.5 11H13L17 16.5H3L7 11H4.5Z" fill="#2E6B47" stroke="#1C4430" strokeWidth={1} strokeLinejoin="round" />
    <Path d="M9 16.5H11V19H9Z" fill="#8A5A3B" />
    <Circle cx={10} cy={3} r={1.8} fill="#FFD24A" stroke="#9A633F" strokeWidth={.6} />
  </>);
  return svg('season-icon-generic', <Circle cx={10} cy={10} r={4} fill={p.inkDim} />);
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

export function CollectionBook({ palette: p, state, onUse, now = seasonNow(), dark = false }:
  { palette: Palette; state: RewardState; onUse: (id: string) => void; now?: Date; dark?: boolean }) {
  const [screen, setScreen] = useState<BookScreen>({ kind: 'grid' });
  // MOTION-AUDIT M3: Android back from a confirm / bought screen returns to the grid (sheetBack.ts).
  useSheetBackStep(screen.kind !== 'grid', () => setScreen({ kind: 'grid' }));
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
        style={({ pressed }) => [styles.tile, { backgroundColor: p.bg, borderColor: nextFree ? p.accent : p.border, borderStyle: nextFree ? 'dashed' : 'solid' }, tilePressedStyle(pressed)]}>
        <SkinThumb style={style} palette={p} dark={dark} />
        <Text style={[styles.tileName, { color: p.ink }]}>{entry.name}</Text>
        {nextFree && k !== null && <Text style={[styles.tileCaption, { color: p.inkDim }]}>{`free in ${k}`}</Text>}
        <View style={[styles.priceRow, styles.tilePrice]}>
          <PetalIcon size={11} />
          <Text style={[styles.tileName, { color: petals >= price ? p.accentText : p.inkDim }]}>{price}</Text>
        </View>
      </Pressable>;
    };
    // A short last row keeps its tiles left-aligned under space-between: invisible, tile-wide
    // spacers fill it to the three columns (owner, 2026-10-07: Mummy | gap | Potion Slime).
    const gridRow = (list: readonly RewardEntry[]) => [...list.map(tile),
      ...Array.from({ length: (BOOK_COLUMNS - (list.length % BOOK_COLUMNS)) % BOOK_COLUMNS }, (_, i) =>
        <View key={`spacer-${i}`} testID="book-spacer" style={styles.spacer} pointerEvents="none"
          accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />)];
    return <View testID="book-grid">
      {state.petalAds === true && <View style={styles.adSlot}><PetalAdButton palette={p} state={state} now={now} /></View>}
      {seasons.map(({ season, entries: seasonal }) => <View key={season.id} testID={`book-season-${season.id}`}>
        <View style={styles.seasonHeader} accessibilityRole="header" accessible>
          <SeasonIcon id={season.id} palette={p} />
          <Text style={[styles.seasonTitle, { color: p.ink }]}>{seasonTitle(season)}</Text>
        </View>
        <View style={styles.grid}>{gridRow(seasonal)}</View>
      </View>)}
      {entries.length > 0 && <View style={styles.grid}>{gridRow(entries)}</View>}
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
      <PurchasePreview key="confirm" entry={entry} palette={p} dark={dark} demo />
      <Text style={[styles.name, { color: p.ink }]}>{entry.name}</Text>
      <Text style={[styles.caption, { color: p.inkDim }]}>{k === null ? 'Not on the path' : `On the path in ${k} ${k === 1 ? 'level' : 'levels'} · or get it now`}</Text>
      <PressScale testID="book-buy" accessibilityRole="button" accessibilityLabel={`Buy for ${price} petals`}
        accessibilityState={{ disabled }} disabled={disabled}
        onPress={buy} style={({ pressed }) => [styles.primary, disabled
          // UX: clearly unavailable — no fill, a dashed outline, dimmed label (not a pale look-alike of the CTA).
          ? { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: p.border }
          : { backgroundColor: pressed ? p.accentDeep : p.accent, transform: pressSnapTransform(pressed) }]}>
        <Text style={[styles.buttonText, { color: disabled ? p.inkDim : p.inkOnAccent }]}>{`Buy for ${price} petals`}</Text>
      </PressScale>
      <Text style={[styles.caption, { color: p.inkDim }]}>{balanceLine}</Text>
      {state.petalAds === true && state.canBuy && petals < price && <PetalAdButton palette={p} state={state} now={now} />}
      <Pressable testID="book-not-now" accessibilityRole="button" accessibilityLabel="Not now" onPress={() => setScreen({ kind: 'grid' })} style={({ pressed }) => [styles.secondary, linkPressedStyle(pressed)]}>
        <Text style={[styles.caption, { color: p.inkDim }]}>Not now</Text>
      </Pressable>
    </View>;
  }

  const counts = visibleStyleCounts(isRewardOwned, state.seasons === true, now);
  return <View testID="book-bought" style={styles.purchase}>
    <View style={[styles.badge, { borderColor: p.accentText }]}>
      <Text style={[styles.badgeText, { color: p.accentText }]}>ADDED TO YOUR STYLES</Text>
    </View>
    <PurchasePreview key="bought" entry={entry} palette={p} dark={dark} demo />
    <Text style={[styles.name, { color: p.ink }]}>{entry.name}</Text>
    <Text style={[styles.caption, { color: p.inkDim }]}>{`${counts.owned} of ${counts.total} styles collected`}</Text>
    <PressScale testID="book-use" accessibilityRole="button" accessibilityLabel="Use it now" onPress={() => onUse(entry.refId)}
      style={({ pressed }) => [styles.primary, { backgroundColor: pressed ? p.accentDeep : p.accent, transform: pressSnapTransform(pressed) }]}>
      <Text style={[styles.buttonText, { color: p.inkOnAccent }]}>Use it now</Text>
    </PressScale>
    <Pressable testID="book-back" accessibilityRole="button" accessibilityLabel="Back to the book" onPress={() => setScreen({ kind: 'grid' })} style={({ pressed }) => [styles.secondary, linkPressedStyle(pressed)]}>
      <Text style={[styles.caption, { color: p.inkDim }]}>Back to the book</Text>
    </Pressable>
  </View>;
}

const BOOK_COLUMNS = 3;

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, padding: 12 },
  seasonHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingTop: 12 },
  seasonTitle: { ...Type.menuStats },
  tile: { width: '31%', minHeight: 112, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 4, paddingVertical: 10, alignItems: 'center', justifyContent: 'flex-start', gap: 5 },
  spacer: { width: '31%' },
  tileName: { ...Type.menuStats, textAlign: 'center' },
  tileCaption: { ...Type.menuStats, textAlign: 'center' },
  /** Pinned to the tile bottom so prices line up across a row whatever the name's line count. */
  tilePrice: { marginTop: 'auto' },
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
