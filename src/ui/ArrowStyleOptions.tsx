import React from 'react';
import { Pressable, StyleSheet, Text, View, ScrollView, useWindowDimensions } from 'react-native';
import Svg, { Path, Circle, Defs, ClipPath, G } from 'react-native-svg';
import { chooseArrowStyle } from './arrowStyleSelection';
import { ARROW_STYLES, type ArrowStyle } from './skinSpecs';
import { Palette, Type } from './theme';
import { PERF_MODE } from '../perfMode';
import { useArrowStyle } from './useArrowStyle';

const writePickerLog = console.log.bind(console);

/** Honest look note for a spec that declares a preferred theme. */
export function preferredThemeNote(style: ArrowStyle): string | undefined {
  const theme = style.spec?.preferredTheme;
  return theme === 'dark' ? 'Best in dark mode' : theme === 'light' ? 'Best in light mode' : undefined;
}

/** Decorative thumbnail only: spec colours, static SVG, no native board or animation. */
function StylePreview({ style, palette: p }: { style: ArrowStyle; palette: Palette }) {
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
    <Svg width={54} height={30} viewBox="0 0 54 30">
      <Defs><ClipPath id={clip}><Path d={silhouette} /></ClipPath></Defs>
      {spec?.layers.filter(layer => layer.kind === 'glow').map((layer, i) =>
        <Path key={i} d={silhouette} fill={colour(layer.colour)} opacity={layer.opacity} stroke={colour(layer.colour)} strokeWidth={4} />)}
      <Path d={silhouette} fill={body} stroke={outline} strokeWidth={2} strokeLinejoin={spec?.head.shape === 'step' ? 'miter' : 'round'} />
      <G clipPath={`url(#${clip})`}>
        {spec?.layers.filter(layer => layer.kind === 'bands').flatMap(layer => layer.bands!.map((bandColour, i) => {
          const ratio = (layer.bandWidths?.[i] ?? layer.width*(1-i/layer.bands!.length)) / layer.width;
          return <G key={bandColour}><Path d="M5 15H37" stroke={bandColour} strokeWidth={9*ratio} />
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
      {spec?.face.anchor === 'head' && <><Circle cx={37} cy={13} r={.8} fill={spec.face.ink} /><Circle cx={37} cy={17} r={.8} fill={spec.face.ink} /></>}
    </Svg>
  </View>;
}

export function ArrowStyleOptions({ palette: p, onBack }: { palette: Palette; onBack: () => void }) {
  const selected = useArrowStyle();
  const { height } = useWindowDimensions();
  return <>
    <ScrollView style={{ maxHeight: height * .58 }} showsVerticalScrollIndicator>
    {ARROW_STYLES.map(style => <Pressable
      key={style.id}
      accessibilityRole="radio"
      accessibilityLabel={style.name}
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
      <Text accessible={false} style={[styles.check, { color: p.ink }]}>{selected.id === style.id ? '✓' : ''}</Text>
    </Pressable>)}
    </ScrollView>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to settings" onPress={onBack}
      style={[styles.back, { borderTopColor: p.border }]}>
      <Text style={[styles.backLabel, { color: p.ink }]}>Back</Text>
    </Pressable>
  </>;
}
const styles = StyleSheet.create({
  option: { minHeight: 60, paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1 },
  nameGroup: { flex: 1 },
  note: { ...Type.menuStats },
  label: { ...Type.menuEntry },
  check: { ...Type.menuEntry, width: 22, textAlign: 'center' },
  backLabel: { ...Type.menuEntry },
  back: { minHeight: 52, paddingHorizontal: 24, justifyContent: 'center', borderTopWidth: 1 },
});
