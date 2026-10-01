// Generate fixtures from the real core and the ONLY spec definitions. No copied skin data.
const fs = require('node:fs');
const ts = require('typescript');
const root = process.env.ART_SKINS_DIR ?? 'artifacts/ART-SKINS-04';
for(const folder of ['patches','screens','perf','checks']) fs.mkdirSync(`${root}/${folder}`,{recursive:true});
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText, filename);
const { LevelGenerator } = require('../../src/core/levelGenerator.ts');
const { serializeNativeBoardGeometry, BoardArrowArtCache } = require('../../src/ui/arrowGeometry.ts');
const { SKIN_SPECS } = require('../../src/ui/skinSpecs.ts');
const { skinContrastRows } = require('../../src/ui/contrastAudit.ts');
const levels = [...Array(20).keys(),3827].map(index => {
  const level = LevelGenerator.generate(index,1); const arrows = level.board.arrows();
  return { index,rows:level.board.rows,cols:level.board.cols,arrows:arrows.map(a=>({direction:a.headDir,cells:a.cells})),
    geometry:serializeNativeBoardGeometry(arrows,40),cells:new BoardArrowArtCache(arrows,40).cellsForSkin() };
});
fs.writeFileSync(`${root}/checks/contract-data.json`,JSON.stringify({specs:SKIN_SPECS,levels}));
fs.writeFileSync(`${root}/checks/contrast.json`,JSON.stringify(skinContrastRows(),null,2));
for(const [id,spec] of Object.entries(SKIN_SPECS)) fs.writeFileSync(`${root}/checks/${id}.json`,JSON.stringify(spec));
console.log(JSON.stringify({levels:levels.map(l=>[l.index,l.arrows.length]),contrast:skinContrastRows().map(r=>[r.usage.id,r.palette,r.ratio,r.pass])}));
