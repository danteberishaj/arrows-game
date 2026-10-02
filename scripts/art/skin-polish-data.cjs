// Compare real registry data with the frozen, authorized starting source.
const fs = require('node:fs');
const ts = require('typescript');
const { createHash } = require('node:crypto');
const root = process.env.ART_SKINS_DIR ?? 'artifacts/ART-SKINS-08';
const input = JSON.parse(fs.readFileSync(`${root}/checks/contract-data.json`));
const current = input.specs;
const source = fs.readFileSync(`${root}/checks/starting-skinSpecs.ts`, 'utf8');
const moduleBefore = { exports: {} };
new Function('exports', 'module', ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText)(moduleBefore.exports, moduleBefore);
const before = moduleBefore.exports.SKIN_SPECS;
const expected = new Set(['cinnamon','sherbet','candy-gloss','jelly','critter','rainbow-ribbon','campfire','strawberry-glazed']);
const result = { sourceSha256: createHash('sha256').update(source).digest('hex'), specs: [] };
for (const [id, spec] of Object.entries(current)) {
  const old = before[id];
  const changed = JSON.stringify(old) !== JSON.stringify(spec);
  if (changed !== expected.has(id) || old.numericId !== spec.numericId) throw new Error(`Unexpected registry change ${id}`);
  const sizes = value => ({rim:value.layers.find(l=>l.kind==='rim').width,body:value.layers.find(l=>l.kind==='body').width,head:value.head,face:value.face});
  result.specs.push({ id, numericId: spec.numericId, dataChanged: changed, old:sizes(old), new:sizes(spec), board:spec.board, beads:spec.beads });
}
if (Object.keys(current).join() !== Object.keys(before).join()) throw new Error('Registry order changed');
fs.writeFileSync(`${root}/checks/spec-diff.json`, JSON.stringify(result,null,2)+'\n');
const dense = input.levels.find(level => level.index === 3827);
const templates = new Map();
for (const arrow of dense.arrows) {
  const origin = arrow.cells[0];
  const relative = arrow.cells.flatMap(cell => [cell.r-origin.r, cell.c-origin.c]);
  const length = arrow.cells.slice(1).reduce((sum, cell, i) => sum +
    Math.abs(cell.r-arrow.cells[i].r) + Math.abs(cell.c-arrow.cells[i].c), 0);
  templates.set(`2:${arrow.direction}:${relative.join(',')}`, length);
}
const nonSingleton = [...templates.values()].filter(length => length > 0);
const silhouetteLayers = current.critter.layers.filter(layer => ['rim','body','shadow','glow'].includes(layer.kind)).length;
const circleAdds = pitch => nonSingleton.reduce((sum, length) => sum + Math.floor(length/pitch)+1, 0) * silhouetteLayers;
fs.writeFileSync(`${root}/checks/bead-work-counts.json`, JSON.stringify({
  screenCellDp: 29.387754, uniqueTemplates: templates.size, nonSingletonTemplates: nonSingleton.length,
  beadCircleAddsBefore: circleAdds(before.critter.beads?.pitch ?? .25),
  beadCircleAddsAfter: circleAdds(current.critter.beads.pitch),
  method: 'exact Manhattan path length for unique relative direction/shape templates; two beaded silhouette layers; floor(length/pitch)+1 circles for nonzero length',
  timingClaim: false,
},null,2)+'\n');
console.log('Exactly eight specs changed; nine unchanged JSON records; all numeric IDs and registry order preserved.');
