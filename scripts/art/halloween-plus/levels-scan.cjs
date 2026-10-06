// HALLOWEEN-PLUS: scan v1 campaign boards to choose the small / dense / long-arrow capture boards (read-only).
// Usage: node scripts/art/halloween-plus/levels-scan.cjs [from] [to]
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, f);
const { LevelGenerator } = require('../../../src/core/levelGenerator.ts');
const from = Number(process.argv[2] ?? 0), to = Number(process.argv[3] ?? 80);
const rows = [];
for (let i = from; i < to; i++) {
  const level = LevelGenerator.generate(i, 1); const lens = level.board.arrows().map(a => a.cells.length);
  rows.push({ index: i, rows: level.board.rows, cols: level.board.cols, arrows: lens.length, maxLen: Math.max(...lens),
    long8: lens.filter(n => n >= 8).length, oneCell: lens.filter(n => n === 1).length,
    meanLen: Number((lens.reduce((s, n) => s + n, 0) / lens.length).toFixed(2)) });
}
console.log(JSON.stringify(rows));
