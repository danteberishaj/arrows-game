import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const root=`${process.env.ART_SKINS_DIR??'artifacts/ART-SKINS-04'}/checks`;
const data=JSON.parse(readFileSync(`${root}/contract-data.json`));
const adb='/Users/gentlegen/Library/Android/sdk/platform-tools/adb';
const modes=process.argv[2] ? [process.argv[2]] : ['before','after'];
if(modes.some(mode=>!['before','after','optimization','polish','halloween'].includes(mode))) throw new Error('mode must be before, after, optimization, polish or halloween');
for(const mode of modes) {
  const results=[];
  const requested=process.argv[3];
  for(const level of data.levels.filter(level => requested === undefined || level.index === Number(requested))) {
    const input=`${root}/instrumentation-input.json`;
    writeFileSync(input,JSON.stringify({specs:data.specs,level,fixture:data.fixture}));
    execFileSync(adb,['-s','emulator-5556','push',input,'/sdcard/Android/data/com.danteb.arrows/files/art07-contract.json'],{timeout:30000});
    const text=execFileSync(adb,['-s','emulator-5556','shell','am','instrument','-w','-e','mode',mode,'-e','dataFile','true','-e','render',String(level.index===3827),
      'com.danteb.arrows/com.danteb.arrows.board.SkinContractInstrumentation'],{encoding:'utf8',timeout:600000,maxBuffer:8*1024*1024});
    writeFileSync(`${root}/native-${mode}-${level.index}.txt`,text);
    const match=text.match(/INSTRUMENTATION_RESULT: result=(.+)/);
    if(!match) throw new Error(text);
    const result=JSON.parse(match[1]); results.push(result); console.log(JSON.stringify(result));
  }
  writeFileSync(`${root}/native-${mode}${requested === undefined ? "" : "-only-"+requested}.json`,JSON.stringify(results,null,2));
}
