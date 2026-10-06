// HALLOWEEN-PLUS: the real K4 audit (src/ui/contrastAudit.ts skinContrastRows) for every candidate, plus the honest
// rim-vs-own-halo ratio for glow specs. Writes artifacts/HALLOWEEN-PLUS/checks/candidate-contrast.json; exits non-zero
// if any required row fails. Usage: node scripts/art/halloween-plus/contrast.cjs
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, f);
const { skinContrastRows, contrastRatio, composite } = require('../../../src/ui/contrastAudit.ts');
const { HALLOWEEN_PLUS_CANDIDATES } = require('../../../src/ui/skinCandidates.ts');
const out = {};
let failed = 0;
for (const { key, spec } of HALLOWEEN_PLUS_CANDIDATES) {
  const rows = skinContrastRows([spec]).map(r => ({ id: r.usage.id, palette: r.palette, ratio: Number(r.ratio.toFixed(2)), pass: r.pass, required: r.required }));
  failed += rows.filter(r => r.required && !r.pass).length;
  const rim = spec.layers.find(l => l.kind === 'rim').colour;
  const halo = spec.layers.filter(l => l.kind === 'glow').map(l => Object.fromEntries(Object.entries(spec.board).map(([theme, bg]) => {
    const under = composite(l.colour, l.opacity ?? 1, bg);
    return [theme, { composite: under, rimVsHalo: Number(contrastRatio(rim, under).toFixed(2)), haloVsBoard: Number(contrastRatio(under, bg).toFixed(2)) }];
  })));
  out[key] = { rows, halo };
  const pick = id => rows.filter(r => r.id.endsWith(id)).map(r => `${r.palette} ${r.ratio}`).join(' / ');
  console.log(key.padEnd(15), 'outline', pick('-outline-0'), '| missed mark', pick('tint-arrow-missed-mark'), '| blocked', pick('-blocked'), halo.length ? '| halo ' + JSON.stringify(halo) : '');
}
fs.mkdirSync('artifacts/HALLOWEEN-PLUS/checks', { recursive: true });
fs.writeFileSync('artifacts/HALLOWEEN-PLUS/checks/candidate-contrast.json', JSON.stringify(out, null, 1) + '\n');
if (failed) { console.error('required rows failing:', failed); process.exit(1); }
