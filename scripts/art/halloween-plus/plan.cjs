// HALLOWEEN-PLUS: board facts for the capture driver (read-only, real core). Prints JSON for one v1 campaign index:
// rows/cols and, per arrow, its cells, head direction (0 Up, 1 Down, 2 Left, 3 Right) and whether it can exit now.
// Usage: node scripts/art/halloween-plus/plan.cjs <index>
// Also: node scripts/art/halloween-plus/plan.cjs specs  -> {key: SkinSpec JSON string} for every candidate and the
// registered Halloween styles incl. the shipped Mummy and Potion Slime (the exact strings the native view parses).
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, f);
const arg = process.argv[2];
if (arg === 'specs') {
  const { SKIN_SPEC_JSON } = require('../../../src/ui/skinSpecs.ts');
  const { CANDIDATE_SPEC_JSON } = require('../../../src/ui/skinCandidates.ts');
  const out = { ...CANDIDATE_SPEC_JSON };
  for (const id of ['pumpkin', 'ghost', 'candy-corn', 'mummy', 'potion-slime']) out[id] = SKIN_SPEC_JSON[id];
  console.log(JSON.stringify(out));
} else {
  const { LevelGenerator } = require('../../../src/core/levelGenerator.ts');
  const index = Number(arg);
  if (!Number.isInteger(index) || index < 0) throw new Error('index required');
  const level = LevelGenerator.generate(index, 1); const board = level.board;
  console.log(JSON.stringify({ index, rows: board.rows, cols: board.cols, arrows: board.arrows().map(a => ({
    cells: a.cells.map(c => [c.r, c.c]), dir: a.headDir, free: board.canExit(a) })) }));
}
