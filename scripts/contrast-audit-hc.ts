/**
 * TF-02 A (META_HIGH_CONTRAST): the high-contrast target over the contrast audit's own rows (src/ui/contrastAudit.ts
 * `USAGES`), for the normal palettes (before) and the high-contrast palettes (after).
 *
 *   npx tsx scripts/contrast-audit-hc.ts            the worst row per kind and palette, before vs after (Markdown)
 *   npx tsx scripts/contrast-audit-hc.ts --all      every row of the high-contrast palettes
 *
 * Target (`highContrastTarget`): text 7:1, large text (>= 24 px, or >= 18.66 px bold) 4.5:1, graphic and boundary
 * 4.5:1. A W5-05 panel-edge row passes when its edge does (fill OR hairline at the target). Exits 1 if any
 * high-contrast row misses its target or the high-contrast palettes fail the existing AA audit.
 */
import {
  HIGH_CONTRAST_PALETTES,
  PALETTES,
  audit,
  highContrastRows,
  isLargeText,
  panelEdges,
  type TargetRow,
} from '../src/ui/contrastAudit';

type Bucket = 'text' | 'text (large)' | 'graphic' | 'boundary';
const bucketOf = (r: TargetRow): Bucket =>
  r.usage.kind === 'text' ? (isLargeText(r.usage.sizePx!, r.usage.weight!) ? 'text (large)' : 'text') : r.usage.kind;
const BUCKETS: Bucket[] = ['text', 'text (large)', 'graphic', 'boundary'];

/** The worst row of a bucket: the lowest ratio/target. Panel-edge rows are judged by their edge, so they are left out
 *  of the worst-row pick (an edge's failing alternative is not a failure) and reported on their own line. */
function worst(rows: TargetRow[], bucket: Bucket): TargetRow | undefined {
  return rows
    .filter((r) => !r.usage.edge && bucketOf(r) === bucket)
    .sort((a, b) => a.ratio / a.target - b.ratio / b.target)[0];
}

const before = highContrastRows(PALETTES);
const after = highContrastRows(HIGH_CONTRAST_PALETTES);
const fmt = (r: TargetRow | undefined) =>
  r ? `${r.usage.id} \`${r.fg}\` on \`${r.bg}\` **${r.ratio.toFixed(2)}** ${r.meets ? 'meets' : 'MISSES'} ${r.target}` : '-';

if (process.argv.includes('--all')) {
  for (const r of after) {
    console.log(
      [r.palette.padEnd(13), r.usage.id.padEnd(40), bucketOf(r).padEnd(13), `${r.usage.fgRole} ${r.fg}`.padEnd(22),
        `${r.usage.bgRole} ${r.bg}`.padEnd(22), r.ratio.toFixed(2).padStart(6), String(r.target).padStart(4),
        r.meets ? 'OK' : 'MISS'].join('  '),
    );
  }
} else {
  console.log('| Theme | Kind (target) | Before: normal palette, worst row | After: high-contrast palette, worst row |');
  console.log('|---|---|---|---|');
  PALETTES.forEach(({ name }, i) => {
    const hcName = HIGH_CONTRAST_PALETTES[i].name;
    for (const b of BUCKETS) {
      const target = b === 'text' ? 7 : 4.5;
      const w0 = worst(before.filter((r) => r.palette === name), b);
      const w1 = worst(after.filter((r) => r.palette === hcName), b);
      const misses0 = before.filter((r) => r.palette === name && bucketOf(r) === b && !r.usage.edge && !r.meets).length;
      const n = before.filter((r) => r.palette === name && bucketOf(r) === b && !r.usage.edge).length;
      console.log(`| ${name} | ${b} (${target}) | ${fmt(w0)} (${misses0}/${n} miss) | ${fmt(w1)} |`);
    }
  });
  console.log('\nW5-05 panel edges at 4.5 (fill OR hairline):');
  for (const set of [PALETTES, HIGH_CONTRAST_PALETTES]) {
    const rows = highContrastRows(set).filter((r) => r.usage.edge);
    for (const id of [...new Set(rows.map((r) => `${r.palette}|${r.usage.edge!.id}`))]) {
      const [palette, edge] = id.split('|');
      const own = rows.filter((r) => r.palette === palette && r.usage.edge!.id === edge);
      const detail = own.map((r) => `${r.usage.edge!.via} ${r.ratio.toFixed(2)}`).join(', ');
      console.log(`  ${palette.padEnd(13)} ${edge.padEnd(16)} ${own[0].meets ? 'meets' : 'MISSES'} (${detail})`);
    }
  }
}

const misses = after.filter((r) => !r.meets);
const aaFails = audit(HIGH_CONTRAST_PALETTES).filter((r) => !r.pass);
const edgeFails = panelEdges(HIGH_CONTRAST_PALETTES).filter((e) => !e.pass);
console.log(
  `\nhigh-contrast rows: ${after.length}, missing the target: ${misses.length}; ` +
    `existing AA audit on the HC palettes: ${aaFails.length} fail, panel edges: ${edgeFails.length} fail`,
);
for (const r of misses) console.log(`MISS ${r.palette} / ${r.usage.id}: ${r.ratio.toFixed(2)} < ${r.target}`);
process.exit(misses.length + aaFails.length + edgeFails.length > 0 ? 1 : 0);
