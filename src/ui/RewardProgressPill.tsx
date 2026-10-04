import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StylePreview } from './ArrowStyleOptions';
import { PetalIcon } from './PetalIcon';
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
    accessible accessibilityLabel={`Plus ${plural(earned, state.petals !== null ? 'petal' : 'point', state.petals !== null ? 'petals' : 'points')}. Next style ${style.name}, ${plural(state.levelsToNext, 'level', 'levels')} to go`}>
    <StylePreview style={style} palette={p} />
    <View style={styles.text}>
      {/* UX: the name gets the whole row; "+N" moves to the caption row so long names don't wrap. */}
      <View testID="pill-label-row">
        <Text style={[styles.label, { color: p.ink }]}>Next style: {style.name}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: p.border }]}>
        <View style={[styles.fill, { width: `${Math.round(state.progress * 100)}%`, backgroundColor: p.accent }]} />
      </View>
      <View testID="pill-caption-row" style={styles.captionRow}>
        <Text style={[styles.caption, { color: p.inkDim }]}>
          {plural(state.levelsToNext, 'more level', 'more levels')}
        </Text>
        <View style={styles.earnedGroup}>
          <Text style={[styles.earned, { color: p.accentText }]}>{`+${earned}`}</Text>
          {state.petals !== null && <PetalIcon size={12} />}
        </View>
      </View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 10, marginTop: 12, alignSelf: 'stretch' },
  text: { flex: 1 },
  captionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3, gap: 8 },
  earnedGroup: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  earned: { ...Type.menuStats, fontWeight: '700' },
  label: { ...Type.menuStats, fontWeight: '700' },
  track: { height: 7, borderRadius: 4, marginTop: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  caption: { ...Type.menuStats },
});
