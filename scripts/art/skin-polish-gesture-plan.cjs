// Derive accepted/blocked inputs from the real board and the measured current camera.
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{
  compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
}).outputText,filename);
const {ArrowPath}=require('../../src/core/arrowPath.ts');
const {BoardLogic}=require('../../src/core/boardLogic.ts');
const root=process.env.ART_SKINS_DIR??'artifacts/ART-SKINS-08';
const level=JSON.parse(fs.readFileSync(`${root}/checks/contract-data.json`)).levels.at(-1);
const [scale,tx,ty,top,bottom]=process.argv.slice(2).map(Number);
if (![scale,tx,ty,top,bottom].every(Number.isFinite)) throw new Error('Measured camera and tint bounds required');
const board=new BoardLogic(level.rows,level.cols);
const arrows=level.arrows.map(a=>new ArrowPath(a.cells,a.direction));arrows.forEach(a=>board.add(a));
const point=a=>({x:Math.round((tx+(a.head.c+.5)*40*scale)*3.5),y:Math.round((ty+(a.head.r+.5)*40*scale)*3.5+top)});
const visible=a=>{const p=point(a);return p.x>60&&p.x<1380&&p.y>top+60&&p.y<bottom-60};
const entry=a=>({index:arrows.indexOf(a),head:a.head,direction:a.headDir,length:a.length,point:point(a)});
const blocked=arrows.find(a=>visible(a)&&!board.canExit(a));if(!blocked)throw new Error('No visible blocked head');
const exits=[];
for(let i=0;i<5;i++) {
  const available=board.arrows().filter(a=>visible(a)&&board.canExit(a));
  const selected=i===0?available.find(a=>a.length===1):[...available].sort((a,b)=>b.length-a.length)[0];
  if(!selected)throw new Error('Required visible exit unavailable');
  exits.push(entry(selected));if(!board.tryRemove(selected))throw new Error('Rejected simulated exit');
}
const plan={index:3827,screenCellDp:scale*40,camera:{scale,tx,ty,top,bottom},blocked:entry(blocked),exits,remaining:board.count()};
fs.writeFileSync(`${root}/checks/phone-gesture-plan.json`,JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify(plan));
