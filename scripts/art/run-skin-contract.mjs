import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const root='artifacts/ART-SKINS-04/checks';
const data=JSON.parse(readFileSync(`${root}/contract-data.json`));
const adb='/Users/gentlegen/Library/Android/sdk/platform-tools/adb';
for(const mode of ['before','after']) {
  const results=[];
  for(const level of data.levels) {
    const payload=Buffer.from(JSON.stringify({specs:data.specs,level})).toString('base64');
    const text=execFileSync(adb,['-s','emulator-5556','shell','am','instrument','-w','-e','mode',mode,'-e','data',payload,'-e','render',String(level.index===3827),
      'com.danteb.arrows/com.danteb.arrows.board.SkinContractInstrumentation'],{encoding:'utf8',timeout:90000,maxBuffer:8*1024*1024});
    writeFileSync(`${root}/native-${mode}-${level.index}.txt`,text);
    const match=text.match(/INSTRUMENTATION_RESULT: result=(.+)/);
    if(!match) throw new Error(text);
    const result=JSON.parse(match[1]); results.push(result); console.log(JSON.stringify(result));
  }
  writeFileSync(`${root}/native-${mode}.json`,JSON.stringify(results,null,2));
}
