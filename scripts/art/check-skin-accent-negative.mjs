// A straight bar can be off-axis while still fitting its cell and staying connected.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
const root=process.env.ART_SKINS_DIR??'artifacts/ART-SKINS-05';
const data=JSON.parse(readFileSync(`${root}/checks/contract-data.json`));
const [id,spec]=Object.entries(data.specs).find(([,spec])=>spec.layers.some(layer=>layer.kind==='shine'));
spec.layers.find(layer=>layer.kind==='shine').offset=[0,-.065];
const payload=Buffer.from(JSON.stringify({specs:{[id]:spec},level:data.levels.find(level=>level.index===3827)})).toString('base64');
const output=execFileSync('/Users/gentlegen/Library/Android/sdk/platform-tools/adb',[
  '-s','emulator-5556','shell','am','instrument','-w','-e','mode','after','-e','data',payload,
  'com.danteb.arrows/com.danteb.arrows.board.SkinContractInstrumentation'],{encoding:'utf8',timeout:90000,maxBuffer:8*1024*1024});
writeFileSync(`${root}/checks/accent-axis-negative.txt`,output);
if(!output.includes('shaft accent off-axis')) throw new Error(`Negative control did not reject the displaced bar: ${output}`);
console.log('Expected failure: displaced straight shaft highlight is off the head/shaft axis.');
