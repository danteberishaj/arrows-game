// Generate fixtures from the real core and the ONLY spec definitions. No copied skin data.
const fs = require('node:fs');
const ts = require('typescript');
const root = process.env.ART_SKINS_DIR ?? 'artifacts/ART-SKINS-04';
for(const folder of ['patches','screens','perf','checks']) fs.mkdirSync(`${root}/${folder}`,{recursive:true});
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText, filename);
const { ArrowPath } = require('../../src/core/arrowPath.ts');
const { LevelGenerator } = require('../../src/core/levelGenerator.ts');
const { serializeNativeBoardGeometry, BoardArrowArtCache } = require('../../src/ui/arrowGeometry.ts');
const { SKIN_SPECS } = require('../../src/ui/skinSpecs.ts');
const { skinContrastRows } = require('../../src/ui/contrastAudit.ts');
const levels = [...Array(20).keys(),3827].map(index => {
  const level = LevelGenerator.generate(index,1); const arrows = level.board.arrows();
  return { index,rows:level.board.rows,cols:level.board.cols,arrows:arrows.map(a=>({direction:a.headDir,cells:a.cells})),
    geometry:serializeNativeBoardGeometry(arrows,40),cells:new BoardArrowArtCache(arrows,40).cellsForSkin() };
});
const fixtureArrows = [
  [3,[[0,0],[0,1],[0,2],[0,3],[0,4],[0,5]]], [2,[[2,1],[2,0]]], [3,[[2,2],[2,3]]],
  [3,[[4,0],[4,1],[4,2]]], [3,[[4,3],[4,4],[4,5],[4,6]]], [0,[[6,0],[7,0],[7,1],[7,2],[6,2]]],
  ...[0,1,2,3].map((dir,c) => [dir,[[9,c]]]),
].map(([dir,cells]) => new ArrowPath(cells.map(([r,c]) => ({r,c})),dir));
const fixture = { index: -1, rows:10, cols:8, geometry:serializeNativeBoardGeometry(fixtureArrows,40),
  cells:new BoardArrowArtCache(fixtureArrows,40).cellsForSkin() };
fs.writeFileSync(`${root}/checks/contract-data.json`,JSON.stringify({specs:SKIN_SPECS,levels,fixture}));
fs.writeFileSync(`${root}/checks/contrast.json`,JSON.stringify(skinContrastRows(),null,2));
for(const [id,spec] of Object.entries(SKIN_SPECS)) fs.writeFileSync(`${root}/checks/${id}.json`,JSON.stringify(spec));
console.log(JSON.stringify({levels:levels.map(l=>[l.index,l.arrows.length]),contrast:skinContrastRows().map(r=>[r.usage.id,r.palette,r.ratio,r.pass])}));
