import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StylePreview } from './ArrowStyleOptions';
import type { RewardState } from './rewardLedger';
import { ARROW_STYLES } from './skinSpecs';
import { Type, type Palette } from './theme';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Win-panel progress toward the next path reward (spec §5a, approved option A). */
export function RewardProgressPill({ state, earned, palette: p }: { state: RewardState; earned: number; palette: Palette }) {
  if (!state.next || state.levelsToNext === null) {
    return <View testID="reward-pill" style={[styles.pill, { backgroundColor: p.surface }]}>
      <Text style={[styles.caption, { color: p.inkDim }]}>All styles collected · new ones coming soon</Text>
    </View>;
  }
  const style = ARROW_STYLES.find(s => s.id === state.next!.refId)!;
  return <View testID="reward-pill" style={[styles.pill, { backgroundColor: p.surface }]}
    accessible accessibilityLabel={`Plus ${plural(earned, 'point', 'points')}. Next style ${style.name}, ${plural(state.levelsToNext, 'level', 'levels')} to go`}>
    <StylePreview style={style} palette={p} />
    <View style={styles.text}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: p.ink }]}>Next style: {style.name}</Text>
        <Text style={[styles.earned, { color: p.accentText }]}>{`+${earned}`}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: p.border }]}>
        <View style={[styles.fill, { width: `${Math.round(state.progress * 100)}%`, backgroundColor: p.accent }]} />
      </View>
      <Text style={[styles.caption, { color: p.inkDim }]}>
        {plural(state.levelsToNext, 'more level', 'more levels')}
      </Text>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 10, marginTop: 12, alignSelf: 'stretch' },
  text: { flex: 1 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  earned: { ...Type.menuStats, fontWeight: '700' },
  label: { ...Type.menuStats, fontWeight: '700' },
  track: { height: 7, borderRadius: 4, marginTop: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  caption: { ...Type.menuStats, marginTop: 3 },
});
