import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ScrollView, useWindowDimensions } from 'react-native';
import Svg, { Path, Circle, Defs, ClipPath, G } from 'react-native-svg';
import { chooseArrowStyle } from './arrowStyleSelection';
import { ARROW_STYLES, type ArrowStyle } from './skinSpecs';
import { Palette, Type } from './theme';
import { PERF_MODE } from '../perfMode';
import { useArrowStyle } from './useArrowStyle';
import { useRewards } from './useRewards';
import { PetalIcon } from './PetalIcon';
import { CollectionBook, openSeasons } from './CollectionBook';
import { etaFor, isRewardNew, isRewardOwned, markPickerSeen } from './rewardLedger';
import { REWARD_CATALOGUE, REWARD_PATH, isStyleVisible, visibleStyleCounts } from './rewardCatalogue';

const writePickerLog = console.log.bind(console);

/** Honest look note for a spec that declares a preferred theme. */
export function preferredThemeNote(style: ArrowStyle): string | undefined {
  const theme = style.spec?.preferredTheme;
  return theme === 'dark' ? 'Best in dark mode' : theme === 'light' ? 'Best in light mode' : undefined;
}

/** Decorative thumbnail only: spec colours, static SVG, no native board or animation. */
export function StylePreview({ style, palette: p, size = 1 }: { style: ArrowStyle; palette: Palette; size?: number }) {
  // Drawn at `size`× as vector (crisp); the outline thins so a large preview reads like the board, not a scaled icon.
  const outlineWidth = size > 1 ? 2.6 / size : 2;
  const body = style.spec?.palette.colours[0] ?? p.ink;
  const rim = style.spec?.layers.find(layer => layer.kind === 'rim')?.colour;
  // Bright dark-preference rims fail on the white sheet, so their thumbnail uses ink. A light preference keeps its rim.
  const outline = style.spec?.preferredTheme === 'dark' ? p.ink : rim && rim !== 'palette' ? rim : p.ink;
  const shine = style.spec?.layers.find(layer => ['ribbon', 'shine'].includes(layer.kind))?.colour;
  const spec = style.spec;
  const silhouette = spec?.head.shape === 'step'
    ? 'M5 10H31V4H36V8H41V11H49V19H41V22H36V26H31V20H5Z'
    : spec?.head.shape === 'swept' ? 'M5 10H34L31 4L49 15L31 26L34 20H5Z' : 'M5 10H31V4L49 15L31 26V20H5Z';
  const head = spec?.head.shape === 'step' ? 'M31 4H36V8H41V11H49V19H41V22H36V26H31Z' : 'M31 4L49 15L31 26Z';
  const clip = `preview-${style.id}`;
  const colour = (value: string) => value === 'palette' ? body : value === 'tailPalette' ? spec?.tail.colours?.[0] ?? body : value;
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Svg width={54 * size} height={30 * size} viewBox="0 0 54 30">
      <Defs><ClipPath id={clip}><Path d={silhouette} /></ClipPath></Defs>
      {spec?.layers.filter(layer => layer.kind === 'glow').map((layer, i) =>
        <Path key={i} d={silhouette} fill={colour(layer.colour)} opacity={layer.opacity} stroke={colour(layer.colour)} strokeWidth={4} />)}
      <Path d={silhouette} fill={body} stroke={outline} strokeWidth={outlineWidth} strokeLinejoin={spec?.head.shape === 'step' ? 'miter' : 'round'} />
      <G clipPath={`url(#${clip})`}>
        {spec?.layers.filter(layer => layer.kind === 'bands').flatMap(layer => layer.bands!.map((bandColour, i) => {
          const ratio = (layer.bandWidths?.[i] ?? layer.width*(1-i/layer.bands!.length)) / layer.width;
          return <G key={bandColour}><Path d="M5 15H37" stroke={bandColour} strokeWidth={9*ratio} />
            <Path d={head} fill={bandColour} transform={`translate(37 15) scale(${ratio}) translate(-37 -15)`} /></G>;
        }))}
        {spec?.layers.filter(layer => layer.kind === 'lengthBands').flatMap(layer => layer.bands!.map((bandColour, i, all) => {
          const ratio = (layer.bandWidths?.[i] ?? layer.width*(1-i/all.length)) / layer.width;
          const from = 5 + 26*i/all.length;
          return <G key={bandColour}><Path d={`M${from} 10H${from + 26/all.length}V20H${from}Z`} fill={bandColour} />
            <Path d={head} fill={bandColour} transform={`translate(37 15) scale(${ratio}) translate(-37 -15)`} /></G>;
        }))}
        {spec?.bodyPattern === 'beads' && [8,15,22,29].map(x => <Circle key={x} cx={x} cy={15} r={4} fill={body} stroke={outline} />)}
        {spec?.layers.filter(layer => layer.kind === 'headFill').map((layer,i) => <Path key={i} d={head} fill={colour(layer.colour)} />)}
        {spec?.layers.filter(layer => layer.kind === 'fold').map((layer,i) => <Path key={i} d={layer.fillHalf === false ? "M31 15H49" : "M31 15H49L31 26Z"} fill={layer.fillHalf === false ? "none" : colour(layer.colour)} stroke={layer.fillHalf === false ? colour(layer.colour) : undefined} strokeWidth={1} opacity={layer.opacity} />)}
        {spec?.layers.filter(layer => layer.kind === 'seam').map((layer,i) =>
          <Path key={i} d="M9 15H30" stroke={colour(layer.colour)} strokeWidth={1.2} strokeDasharray="2 2" />)}
        {shine && shine !== 'palette' && <Path d="M10 15H29" stroke={shine} strokeWidth={2} />}
      </G>
      {spec?.tail.kind === 'marble' && <><Circle cx={7} cy={15} r={3.5} fill={spec.tail.colours?.[0]} stroke={outline} /><Circle cx={6} cy={14} r={.8} fill="#FFFFFF" /></>}
      {spec?.tail.kind === 'roll+face' && <><Circle cx={7} cy={15} r={4} fill={body} stroke={outline} /><Path d="M5 15C5 11 10 12 9 15S6 17 6 15" stroke={outline} fill="none" /></>}
      {spec?.tail.kind === 'fletch' && <Path d="M3 15L7 10H12L9 15L12 20H7Z" fill={spec.layers.find(layer => layer.kind === 'tailFill')?.colour ?? body} stroke={outline} />}
      {spec?.tail.kind === 'dot' && <Circle cx={7} cy={15} r={2.5} fill={spec.layers.find(layer => layer.kind === 'tailFill')?.colour ?? body} />}
      {spec?.face.anchor === 'head' && [13, 17].map(cy => spec.face.eyeShape === 'triangle'
        ? <Path key={cy} d={`M37 ${cy-1.1}L38 ${cy+.6}H36Z`} fill={spec.face.ink} />
        : spec.face.eyeShape === 'arc' ? <Path key={cy} d={`M36.2 ${cy-.3}Q37 ${cy+.9} 37.8 ${cy-.3}`} stroke={spec.face.ink} strokeWidth={.5} fill="none" />
        : <Circle key={cy} cx={37} cy={cy} r={.8} fill={spec.face.ink} />)}
    </Svg>
  </View>;
}

export function ArrowStyleOptions({ palette: p, onBack, now = new Date() }: { palette: Palette; onBack: () => void; now?: Date }) {
  const selected = useArrowStyle();
  const state = useRewards();
  const [hint, setHint] = useState<{ id: number; k: number | null } | null>(null);
  const [tab, setTab] = useState<'styles' | 'book'>('styles');
  const { height } = useWindowDimensions();
  useEffect(() => { markPickerSeen(); }, []);

  function StyleRow({ style }: { style: ArrowStyle }) {
    const isNew = !!state && isRewardNew(style.numericId);
    return <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${style.name}${isNew ? ', new' : ''}`}
      accessibilityHint={preferredThemeNote(style)}
      accessibilityState={{ checked: selected.id === style.id }}
      onPress={() => {
        if (PERF_MODE && selected.id !== style.id) writePickerLog(`[skin-picker] target=${style.id} tapEpochMs=${Date.now()}`);
        chooseArrowStyle(style.id);
      }}
      style={[styles.option, { borderTopColor: p.border }]}
    >
      <StylePreview style={style} palette={p} />
      <View style={styles.nameGroup}>
        <Text style={[styles.label, { color: p.ink }]}>{style.name}</Text>
        {preferredThemeNote(style) && <Text style={[styles.note, { color: p.inkDim }]}>{preferredThemeNote(style)}</Text>}
      </View>
      {isNew && <View accessible={false} style={[styles.newDot, { backgroundColor: p.accent }]} />}
      <Text accessible={false} style={[styles.check, { color: p.ink }]}>{selected.id === style.id ? '✓' : ''}</Text>
    </Pressable>;
  }

  // HALLOWEEN-01: only visible styles are listed or counted (seasonal ones need seasons on; flat picker never shows them).
  const seasons = state?.seasons === true;
  const visible = (id: number) => isStyleVisible(id, isRewardOwned, seasons, now);
  const owned = state ? REWARD_CATALOGUE.filter(e => e.kind === 'skin' && isRewardOwned(e.rewardId) && visible(e.rewardId))
    .map(e => ARROW_STYLES.find(s => s.id === e.refId)!) : [];
  const bookCount = state ? REWARD_PATH.filter(e => !isRewardOwned(e.rewardId)).length
    + openSeasons(state, now).reduce((n, g) => n + g.entries.length, 0) : 0;
  const allLocked = state ? REWARD_PATH.filter(e => !isRewardOwned(e.rewardId)) : [];
  // UX review: show the next two only; a long list of locked rows reads as a chore, not a goal.
  const locked = allLocked.slice(0, 2);
  const moreLocked = allLocked.length - locked.length;
  const nextEta = state?.next ? etaFor(state.next.rewardId) : null;
  return <>
    <ScrollView style={{ maxHeight: height * .58 }} showsVerticalScrollIndicator>
      {!state ? ARROW_STYLES.filter(style => isStyleVisible(style.numericId, () => true, false, now)).map(style => <StyleRow key={style.id} style={style} />) : state.petals !== null ? <>
        <View testID="petal-purse" style={styles.purse} accessibilityLabel={`${state.petals} petals`}>
          <PetalIcon size={14} />
          <Text style={[styles.note, { color: p.accentText }]}>{`${state.petals} ${state.petals === 1 ? 'petal' : 'petals'}`}</Text>
        </View>
        <View testID="tab-track" style={[styles.tabs, { backgroundColor: p.bg }]}>
          <Pressable testID="tab-styles" accessibilityRole="tab" accessibilityState={{ selected: tab === 'styles' }}
            onPress={() => setTab('styles')} style={[styles.tab, tab === 'styles' && { backgroundColor: p.surface }]}>
            <Text style={[styles.note, { color: tab === 'styles' ? p.ink : p.inkDim }]}>{`Your styles · ${owned.length}`}</Text>
          </Pressable>
          <Pressable testID="tab-book" accessibilityRole="tab" accessibilityState={{ selected: tab === 'book' }}
            onPress={() => setTab('book')} style={[styles.tab, tab === 'book' && { backgroundColor: p.surface }]}>
            <Text style={[styles.note, { color: tab === 'book' ? p.ink : p.inkDim }]}>{`Book · ${bookCount}`}</Text>
          </Pressable>
        </View>
        {tab === 'styles' ? <>
          {owned.map(style => <StyleRow key={style.id} style={style} />)}
          {state.next && <Pressable testID="next-free-line" accessibilityRole="button"
            onPress={() => setTab('book')} style={styles.nextFree}>
            <Text style={[styles.note, { color: p.inkDim }]}>{`Next free style: ${state.next.name} · ${nextEta} ${nextEta === 1 ? 'level' : 'levels'}`}</Text>
          </Pressable>}
        </> : <CollectionBook palette={p} state={state} now={now} onUse={id => { chooseArrowStyle(id); setTab('styles'); }} />}
      </> : <>
        <View testID="reward-section-owned" style={styles.section}>
          <Text style={[styles.note, { color: p.inkDim }]}>Your styles</Text>
          <Text style={[styles.note, { color: p.inkDim }]}>{owned.length} of {visibleStyleCounts(isRewardOwned, seasons, now).total}</Text>
        </View>
        {owned.map(style => <StyleRow key={style.id} style={style} />)}
        {locked.length > 0 && <View testID="reward-section-coming" style={styles.section}>
          <Text style={[styles.note, { color: p.inkDim }]}>Coming up</Text>
        </View>}
        {locked.map((entry, index) => {
          const style = ARROW_STYLES.find(s => s.id === entry.refId)!;
          const k = etaFor(entry.rewardId);
          const caption = index === 0 ? (k === null ? 'Not on the path' : `Next · ${k} ${k === 1 ? 'level' : 'levels'}`)
            : `After ${locked[index - 1].name}`;
          return <React.Fragment key={entry.rewardId}>
            <Pressable accessibilityRole="button"
              accessibilityLabel={k === null ? `${entry.name}, locked, Not on the path` : `${entry.name}, locked, unlocks in ${k} ${k === 1 ? 'level' : 'levels'}`}
              onPress={() => setHint({ id: entry.rewardId, k })}
              style={[styles.option, { borderTopColor: p.border }]}>
              <View style={{ opacity: index === 0 ? 1 : .45 }}><StylePreview style={style} palette={p} /></View>
              <View style={styles.nameGroup}>
                <Text style={[styles.label, { color: p.inkDim }]}>{entry.name}</Text>
                <Text style={[styles.note, { color: p.inkDim }]}>{caption}</Text>
                {index === 0 && <View style={[styles.bar, { backgroundColor: p.border }]}>
                  <View style={[styles.barFill, { backgroundColor: p.accent, width: `${state.progress * 100}%` }]} />
                </View>}
              </View>
              <Svg accessible={false} width={12} height={12} viewBox="0 0 12 12">
                <Path d="M3.5 5V3.5a2.5 2.5 0 0 1 5 0V5M2.5 5h7v6h-7Z" fill="none" stroke={p.inkDim} strokeWidth={1.4} strokeLinejoin="round" />
              </Svg>
            </Pressable>
            {hint?.id === entry.rewardId && <Text testID="reward-locked-hint" accessibilityLiveRegion="polite"
              style={[styles.hint, { color: p.inkDim }]}>{hint.k === null ? 'Not on the path' : `Clear ${hint.k} more ${hint.k === 1 ? 'level' : 'levels'} to unlock`}</Text>}
          </React.Fragment>;
        })}
        {moreLocked > 0 && <Text style={[styles.more, { color: p.inkDim, borderTopColor: p.border }]}>{`+${moreLocked} more to unlock`}</Text>}
      </>}
    </ScrollView>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to settings" onPress={onBack}
      style={[styles.back, { borderTopColor: p.border }]}>
      <Text style={[styles.backLabel, { color: p.ink }]}>Back</Text>
    </Pressable>
  </>;
}
const styles = StyleSheet.create({
  purse: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, paddingVertical: 12 },
  // UX review: the selected tab is a filled segment on a track, not colour alone (approved mockup B).
  tabs: { flexDirection: 'row', marginHorizontal: 12, padding: 4, borderRadius: 14 },
  tab: { flex: 1, minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
  nextFree: { minHeight: 48, paddingHorizontal: 18, paddingVertical: 14, justifyContent: 'center' },
  option: { minHeight: 60, paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1 },
  nameGroup: { flex: 1 },
  more: { ...Type.menuStats, minHeight: 48, paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1 },
  note: { ...Type.menuStats },
  label: { ...Type.menuEntry },
  check: { ...Type.menuEntry, width: 22, textAlign: 'center' },
  backLabel: { ...Type.menuEntry },
  back: { minHeight: 52, paddingHorizontal: 24, justifyContent: 'center', borderTopWidth: 1 },
  section: { paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between' },
  newDot: { width: 7, height: 7, borderRadius: 3.5 },
  bar: { height: 4, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  hint: { ...Type.menuStats, paddingHorizontal: 18, paddingBottom: 10 },
});
