import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  AccessibilityInfo, BackHandler, findNodeHandle, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation, Easing, Extrapolation, interpolate, ReduceMotion, useAnimatedStyle, useReducedMotion,
  useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { QA_SKINS_DRAWER } from '../featureFlags';
import { CAPTURE_DIAG_ENABLED } from '../perfMode';
import { SkinThumb } from './ArrowStyleOptions';
import { openSeasons, SeasonIcon } from './CollectionBook';
import { Haptic } from './haptics';
import { EASE_OUT } from './motionTokens';
import { PetalAdButton } from './PetalAdButton';
import { PetalIcon } from './PetalIcon';
import { REWARD_CATALOGUE, REWARD_PATH, isStyleVisible, rewardForSkin, type RewardEntry } from './rewardCatalogue';
import { buyReward, etaFor, isRewardOwned } from './rewardLedger';
import { chooseArrowStyle, getSavedArrowStyle, previewArrowStyle, subscribeArrowStyle } from './arrowStyleSelection';
import { seasonNow } from './seasonClock';
import { seasonTitle } from './seasons';
import { SKIN_HERO_SIZE, SkinHeroBoard, skinHeroAvailable } from './SkinHeroBoard';
import { ARROW_STYLES, type ArrowStyle } from './skinSpecs';
import { drawerAction, drawerActionCopy, drawerSnaps, releaseTarget, rubberband, targetY, type DrawerTarget } from './skinsDrawerModel';
import { Type, type Palette } from './theme';
import { useRewards } from './useRewards';

/**
 * SKINS-DRAWER (META_SKINS_DRAWER, owner picks 2026-11-19). A bottom drawer over the menu or the game board:
 * - opens at the half snap (55 % of the window), drags to full (92 %), drag down / flick / scrim tap / Back closes;
 * - one grid: your styles first (check = in use), then open seasons and the path, priced;
 * - tapping a tile previews it: in game on the real board behind the drawer (memory only, reverted on close),
 *   on the menu on the hero mini board; the bottom bar buys or equips it.
 *
 * Motion (Emil / animate-expo / design-lab rules): the drag tracks 1:1 on the UI thread, the release is a spring
 * seeded with the finger's velocity (velocity OR distance decides), button-opened motion never bounces, the scrim and
 * hero derive from the same translateY, one light haptic when a detent catches after a drag. Reduced motion
 * (ReduceMotion.System): open, close and snaps jump to their end state, so every state still changes with no
 * travel; dragging still tracks the finger (the user makes that motion).
 */

/** Button-opened: no bounce (no force was applied). design-lab drawers 200-450 ms. */
const OPEN_SPRING = { duration: 350, dampingRatio: 1 } as const;
/** Exit ≈ 0.7 × entry (design-lab `duration-tokens`), strong ease-out. */
const CLOSE_MS = 240;
/** After a drag: the snap may overshoot a touch (the finger applied force). */
const SNAP_SPRING = { duration: 300, dampingRatio: 0.85 } as const;
/** The sheet's background runs this far below the screen, so an upward overshoot never shows a gap. */
const UNDERHANG = 120;
const HEADER_H = 60;
const COLUMNS = 3;

const log = QA_SKINS_DRAWER || CAPTURE_DIAG_ENABLED ? console.log.bind(console) : () => {};

/** QA variant (taste): where the menu's hero board sits. Module state so it survives reopening. */
type HeroPlace = 'above' | 'inside';
let heroPlace: HeroPlace = 'above';

export type DrawerContext = 'menu' | 'game';

function useSavedStyle(): ArrowStyle {
  return useSyncExternalStore(subscribeArrowStyle, getSavedArrowStyle, getSavedArrowStyle);
}

const Tile = React.memo(function Tile({ style, palette: p, dark, selected, inUse, price, caption, affordable, onPress }: {
  style: ArrowStyle; palette: Palette; dark: boolean; selected: boolean; inUse: boolean;
  price: number | null; caption?: string; affordable: boolean; onPress: (id: string) => void;
}) {
  const label = `${style.name}${inUse ? ', in use' : price !== null ? `, ${price} petals` : ''}${caption ? `, ${caption}` : ''}`;
  return <Pressable testID={`drawer-tile-${style.id}`} accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ selected }} onPress={() => onPress(style.id)}
    style={({ pressed }) => [styles.tile, { backgroundColor: p.bg, borderColor: selected ? p.accent : p.border },
      selected && styles.tileSelected, pressed && styles.tilePressed]}>
    <SkinThumb style={style} palette={p} dark={dark} />
    <Text style={[styles.tileName, { color: p.ink }]} numberOfLines={2}>{style.name}</Text>
    {caption && <Text style={[styles.tileName, { color: p.inkDim }]}>{caption}</Text>}
    <View style={[styles.priceRow, styles.tileFoot]}>
      {inUse ? <Text style={[styles.tileName, { color: p.accentText }]}>✓ In use</Text>
        : price !== null ? <><PetalIcon size={11} />
          <Text style={[styles.tileName, { color: affordable ? p.accentText : p.inkDim }]}>{price}</Text></>
        : null}
    </View>
  </Pressable>;
});

export function SkinsDrawer({ palette: p, dark, context, onClose }: {
  palette: Palette; dark: boolean; context: DrawerContext; onClose: () => void;
}) {
  const { height: windowH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const snaps = useMemo(() => drawerSnaps(windowH), [windowH]);
  const reduced = useReducedMotion();
  const rewards = useRewards();
  const saved = useSavedStyle();
  const [now] = useState(seasonNow);
  const [selectedId, setSelectedId] = useState(saved.id);
  const [snap, setSnap] = useState<DrawerTarget>('half');
  const [closing, setClosing] = useState(false);
  const [justBought, setJustBought] = useState<string | null>(null);
  const [place, setPlace] = useState<HeroPlace>(heroPlace);

  const y = useSharedValue(snaps.closed);
  const ctx = useSharedValue(0);
  /** The last snap the sheet came to rest on (0 = full, 1 = half): one detent per flick counts from here, not from
   *  wherever a finger caught the sheet mid-flight. */
  const restAt = useSharedValue(1);
  const closedRef = useRef(false);
  const titleRef = useRef<Text>(null);

  // ---- data -------------------------------------------------------------------------------------------------
  const seasons = rewards?.seasons === true;
  const visible = (id: number) => isStyleVisible(id, isRewardOwned, seasons, now);
  const owned: ArrowStyle[] = rewards
    ? REWARD_CATALOGUE.filter(e => e.kind === 'skin' && isRewardOwned(e.rewardId) && visible(e.rewardId))
      .map(e => ARROW_STYLES.find(s => s.id === e.refId)!)
    : ARROW_STYLES.filter(s => isStyleVisible(s.numericId, () => true, false, now));
  const seasonGroups = rewards ? openSeasons(rewards, now) : [];
  const path = rewards ? REWARD_PATH.filter(e => !isRewardOwned(e.rewardId)) : [];
  const petals = rewards?.petals ?? 0;
  const selected = ARROW_STYLES.find(s => s.id === selectedId) ?? saved;
  const selectedEntry = rewardForSkin(selected.numericId);
  const selectedOwned = !rewards || !selectedEntry || isRewardOwned(selectedEntry.rewardId);

  // ---- open / close -----------------------------------------------------------------------------------------
  useEffect(() => {
    log(`[drawer] open ctx=${context} windowH=${windowH} half=${snaps.half} sheetH=${snaps.sheetH} reduced=${reduced}`);
    y.set(withSpring(snaps.half, { ...OPEN_SPRING, reduceMotion: ReduceMotion.System }));
    // Screen readers land on the drawer's title, not on whatever was focused behind it.
    const t = setTimeout(() => {
      const node = titleRef.current && findNodeHandle(titleRef.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, 400);
    // The preview never outlives the drawer (unmount by any path reverts the board).
    return () => { clearTimeout(t); previewArrowStyle(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    previewArrowStyle(null);
    onClose();
  }, [onClose]);

  const close = useCallback((reason: string) => {
    if (closedRef.current || closing) return;
    log(`[drawer] close reason=${reason}`);
    setClosing(true);
    // Backstop: an invisible drawer left mounted would swallow every touch underneath.
    setTimeout(finish, CLOSE_MS + 120);
    y.set(withTiming(snaps.closed, { duration: CLOSE_MS, easing: EASE_OUT, reduceMotion: ReduceMotion.System },
      finished => { if (finished) scheduleOnRN(finish); }));
  }, [closing, finish, y, snaps.closed]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { close('back'); return true; });
    return () => sub.remove();
  }, [close]);

  // ---- drag -------------------------------------------------------------------------------------------------
  const settled = useCallback((t: DrawerTarget, from: DrawerTarget, endY: number) => {
    log(`[drawer] settle target=${t} from=${from} releaseY=${endY.toFixed(0)}`);
    if (t === 'closed') {
      setClosing(true);
      // Same backstop as close(): if the dismiss spring is interrupted, never leave an invisible drawer mounted.
      setTimeout(finish, 420);
      return;
    }
    setSnap(t);
  }, [finish]);
  const toggleSnap = useCallback(() => {
    const t: DrawerTarget = snap === 'full' ? 'half' : 'full';
    log(`[drawer] settle target=${t} from=${snap} releaseY=button`);
    restAt.set(t === 'full' ? 0 : 1);
    setSnap(t);
    y.set(withSpring(targetY(t, snaps), { ...OPEN_SPRING, reduceMotion: ReduceMotion.System }));
  }, [restAt, snap, snaps, y]);

  const makePan = useCallback(() => Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onStart(() => {
      cancelAnimation(y);
      ctx.set(y.get());
    })
    .onUpdate(e => {
      const next = ctx.get() + e.translationY;
      y.set(next < snaps.full ? snaps.full + rubberband(next - snaps.full, snaps.sheetH) : next);
    })
    .onEnd(e => {
      const from: DrawerTarget = restAt.get() === 0 ? 'full' : 'half';
      const t = releaseTarget(y.get(), e.velocityY, snaps, from, e.translationY);
      const endY = y.get();
      if (t !== 'closed') restAt.set(t === 'full' ? 0 : 1);
      scheduleOnRN(settled, t, from, endY);
      if (t === 'closed') {
        y.set(withSpring(snaps.closed, { duration: 300, dampingRatio: 1, velocity: e.velocityY, overshootClamping: true,
          reduceMotion: ReduceMotion.System }, finished => { if (finished) scheduleOnRN(finish); }));
      } else {
        // The haptic lands with the detent (spring done), not at release ~300 ms earlier.
        y.set(withSpring(targetY(t, snaps), { ...SNAP_SPRING, velocity: e.velocityY, reduceMotion: ReduceMotion.System },
          finished => { if (finished && t !== from) scheduleOnRN(Haptic.snap); }));
      }
    }), [ctx, finish, restAt, settled, snaps, y]);
  // At half the whole sheet drags (the grid does not scroll there); at full only the header does, so the grid scrolls.
  const sheetPan = useMemo(() => makePan().enabled(snap !== 'full'), [makePan, snap]);
  const headerPan = useMemo(() => makePan(), [makePan]);

  // ---- styles derived from the one translateY ---------------------------------------------------------------
  const scrimMax = context === 'game' ? 0.18 : 0.6;
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.get(), [snaps.half, snaps.closed], [scrimMax, 0], Extrapolation.CLAMP),
  }));
  // The bar stays on the screen's bottom edge at both snaps and rides down with the sheet when it closes.
  const barStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -Math.min(Math.max(y.get(), 0), snaps.half) }] }));
  const heroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.get(), [snaps.full, snaps.half, snaps.closed], [0, 1, 0], Extrapolation.CLAMP),
  }));

  // ---- actions ----------------------------------------------------------------------------------------------
  const onTile = useCallback((id: string) => {
    setSelectedId(id);
    setJustBought(null);
    if (context === 'game') previewArrowStyle(id);
    log(`[drawer] preview id=${id} ctx=${context}`);
  }, [context]);

  const action = drawerAction({
    owned: selectedOwned, equipped: saved.id === selected.id, price: selectedEntry?.price ?? null,
    petals, canBuy: rewards?.canBuy ?? false,
  });
  const copy = drawerActionCopy(action);
  const buttonLabel = action.kind === 'use' && justBought === selected.id ? 'Use it now' : copy.button;
  const onAction = () => {
    if (!copy.enabled) return;
    if (action.kind === 'use') {
      chooseArrowStyle(selected.id);
      log(`[drawer] use id=${selected.id}`);
      AccessibilityInfo.announceForAccessibility(`${selected.name} in use`);
      return;
    }
    if (action.kind === 'buy' && selectedEntry) {
      const result = buyReward(selectedEntry.rewardId, now);
      log(`[drawer] buy id=${selected.id} result=${result}`);
      if (result === 'bought') {
        Haptic.cleared();
        setJustBought(selected.id);
        AccessibilityInfo.announceForAccessibility(`${selected.name} added to your styles`);
      }
    }
  };

  // ---- layout -----------------------------------------------------------------------------------------------
  const tile = (style: ArrowStyle, entry?: RewardEntry) => {
    const isOwned = !entry || !rewards || isRewardOwned(entry.rewardId);
    const k = entry && rewards?.next?.rewardId === entry.rewardId ? etaFor(entry.rewardId) : null;
    return <Tile key={style.id} style={style} palette={p} dark={dark} selected={style.id === selected.id}
      inUse={isOwned && style.id === saved.id} price={isOwned ? null : entry?.price ?? null}
      caption={k !== null ? `free in ${k}` : undefined} affordable={petals >= (entry?.price ?? 0)} onPress={onTile} />;
  };
  const grid = (children: React.ReactNode[]) => <View style={styles.grid}>{[...children,
    ...Array.from({ length: (COLUMNS - (children.length % COLUMNS)) % COLUMNS }, (_, i) =>
      <View key={`spacer-${i}`} style={styles.spacer} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />)]}</View>;

  const showHero = context === 'menu' && skinHeroAvailable();
  const hero = showHero ? <SkinHeroBoard key={selected.id} style={selected} palette={p} dark={dark} demo /> : null;
  const heroAboveTop = insets.top + Math.max(0, (windowH - (snaps.sheetH - snaps.half) - insets.top - SKIN_HERO_SIZE.height) / 2);
  const barH = 92 + insets.bottom;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={closing ? 'none' : 'box-none'} testID="skins-drawer">
      <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]}>
        {/* Hidden from screen readers: "Done" is the accessible close, and this would be read first. */}
        <Pressable accessible={false} importantForAccessibility="no" onPress={() => close('scrim')}
          style={[StyleSheet.absoluteFill, { backgroundColor: p.bg }]} />
      </Animated.View>

      {hero && place === 'above' && <Animated.View pointerEvents="none" style={[styles.heroAbove, { top: heroAboveTop }, heroStyle]}>{hero}</Animated.View>}

      <GestureDetector gesture={sheetPan}>
        <Animated.View accessibilityViewIsModal testID="skins-drawer-sheet"
          style={[styles.sheet, { height: snaps.sheetH + UNDERHANG, bottom: -UNDERHANG, backgroundColor: p.surface, borderColor: p.border }, sheetStyle]}>
          <GestureDetector gesture={headerPan}>
            <View style={styles.header}>
              {/* The grabber is also a button (44 dp), so expanding never needs a drag (TalkBack, switch access). */}
              <Pressable testID="drawer-grabber" accessibilityRole="button" onPress={toggleSnap}
                accessibilityLabel={snap === 'full' ? 'Collapse styles' : 'Expand styles'} style={styles.grabberHit}>
                <View style={[styles.grabber, { backgroundColor: p.border }]} />
              </Pressable>
              <View style={styles.titleRow}>
                <Text ref={titleRef} accessibilityRole="header" style={[styles.title, { color: p.ink }]}>Styles</Text>
                {rewards?.petals !== null && rewards?.petals !== undefined && <View style={styles.purse} accessibilityLabel={`${petals} petals`}>
                  <PetalIcon size={14} />
                  <Text style={[styles.small, { color: p.accentText }]}>{petals}</Text>
                </View>}
                {QA_SKINS_DRAWER && showHero && <Pressable testID="qa-drawer-hero" accessibilityRole="button" accessibilityLabel="QA hero place"
                  onPress={() => { heroPlace = place === 'above' ? 'inside' : 'above'; setPlace(heroPlace); }}
                  style={[styles.qaChip, { borderColor: p.border }]}>
                  <Text style={[styles.small, { color: p.ink }]}>{`Hero ${place}`}</Text>
                </Pressable>}
                <Pressable testID="drawer-done" accessibilityRole="button" accessibilityLabel="Close styles" onPress={() => close('done')}
                  hitSlop={8} style={({ pressed }) => [styles.done, pressed && styles.tilePressed]}>
                  <Text style={[styles.small, { color: p.inkDim }]}>Done</Text>
                </Pressable>
              </View>
            </View>
          </GestureDetector>
          <ScrollView scrollEnabled={snap === 'full'} contentContainerStyle={{ paddingBottom: barH + UNDERHANG + 12 }}
            showsVerticalScrollIndicator={snap === 'full'}>
            {hero && place === 'inside' && <View style={styles.heroInside}>{hero}</View>}
            <Text style={[styles.section, { color: p.inkDim }]}>{`Your styles · ${owned.length}`}</Text>
            {grid(owned.map(s => tile(s)))}
            {seasonGroups.map(({ season, entries }) => <View key={season.id}>
              <View style={styles.seasonHeader} accessibilityRole="header" accessible>
                <SeasonIcon id={season.id} palette={p} />
                <Text style={[styles.sectionInline, { color: p.ink }]}>{seasonTitle(season)}</Text>
              </View>
              {grid(entries.map(e => tile(ARROW_STYLES.find(s => s.id === e.refId)!, e)))}
            </View>)}
            {path.length > 0 && <>
              <Text style={[styles.section, { color: p.inkDim }]}>More styles</Text>
              {grid(path.map(e => tile(ARROW_STYLES.find(s => s.id === e.refId)!, e)))}
            </>}
            {rewards?.petalAds === true && <View style={styles.adSlot}><PetalAdButton palette={p} state={rewards} now={now} /></View>}
          </ScrollView>
          <Animated.View style={[styles.bar, { bottom: UNDERHANG, height: barH, paddingBottom: insets.bottom + 10,
            backgroundColor: p.surface, borderTopColor: p.border }, barStyle]}>
            <View style={styles.barText}>
              <Text style={[styles.barName, { color: p.ink }]} numberOfLines={1}>{selected.name}</Text>
              {copy.line !== '' && <Text style={[styles.small, { color: p.inkDim }]} numberOfLines={1}>{copy.line}</Text>}
            </View>
            <Pressable testID="drawer-action" accessibilityRole="button" accessibilityLabel={buttonLabel}
              accessibilityState={{ disabled: !copy.enabled }} disabled={!copy.enabled} onPress={onAction}
              style={({ pressed }) => [styles.primary, copy.enabled
                ? { backgroundColor: pressed ? p.accentDeep : p.accent }
                : { borderWidth: 1.5, borderStyle: 'dashed', borderColor: p.border }, pressed && styles.tilePressed]}>
              <Text style={[styles.buttonText, { color: copy.enabled ? p.inkOnAccent : p.inkDim }]} numberOfLines={1}>{buttonLabel}</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {QA_SKINS_DRAWER && <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {/* Draw the invisible: where each snap puts the sheet's top edge. */}
        {([['full', snaps.full], ['half', snaps.half]] as const).map(([name, ty]) =>
          <View key={name} style={[styles.qaLine, { top: windowH - snaps.sheetH + ty }]}>
            <Text style={styles.qaText}>{`${name} ${Math.round(snaps.sheetH - ty)}dp`}</Text>
          </View>)}
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', left: 0, right: 0, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderWidth: 1, borderBottomWidth: 0, overflow: 'hidden',
  },
  header: { height: HEADER_H, paddingHorizontal: 16, justifyContent: 'flex-end', paddingBottom: 6 },
  grabberHit: { position: 'absolute', top: 0, alignSelf: 'center', width: 88, height: 44, alignItems: 'center', paddingTop: 8, zIndex: 1 },
  grabber: { width: 36, height: 4, borderRadius: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { ...Type.menuEntry, flex: 1 },
  purse: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  done: { minHeight: 44, minWidth: 56, alignItems: 'center', justifyContent: 'center' },
  small: { ...Type.menuStats },
  section: { ...Type.menuStats, paddingHorizontal: 16, paddingTop: 10 },
  sectionInline: { ...Type.menuStats },
  seasonHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12, paddingTop: 8 },
  spacer: { width: '31%' },
  tile: { width: '31%', minHeight: 112, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 4, paddingVertical: 10, alignItems: 'center', gap: 5 },
  tileSelected: { borderWidth: 2.5 },
  tilePressed: { transform: [{ scale: 0.97 }] },
  tileName: { ...Type.menuStats, textAlign: 'center' },
  tileFoot: { marginTop: 'auto' },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  adSlot: { paddingHorizontal: 12, paddingTop: 12 },
  heroAbove: { position: 'absolute', alignSelf: 'center' },
  heroInside: { alignItems: 'center', paddingVertical: 6 },
  bar: {
    position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1,
  },
  barText: { flex: 1 },
  barName: { ...Type.menuEntry },
  primary: { minHeight: 52, minWidth: 140, maxWidth: '62%', alignItems: 'center', justifyContent: 'center', borderRadius: 28, paddingHorizontal: 18 },
  buttonText: { ...Type.panelButton, textAlign: 'center' },
  qaChip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8, borderRadius: 22, borderWidth: 1 },
  qaLine: { position: 'absolute', left: 0, right: 0, height: 0, borderTopWidth: 1, borderColor: '#FF2D55', borderStyle: 'dashed' },
  qaText: { ...Type.menuStats, color: '#FF2D55', marginLeft: 4, marginTop: -18 },
});
