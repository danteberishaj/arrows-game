import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { findBoardBounds, invokeGestureDriver } from '../perf/android/benchmark.mjs';
import { buildInputDriver, resolveAndroidSdkRoot } from '../perf/android/build-uiautomator.mjs';
import { parseGfxInfoFrames, summarizeFrames } from '../perf/android/parse-gfxinfo.mjs';
const root='artifacts/ART-SKINS-04'; const spec=process.argv[2]??'cinnamon';
const serial='emulator-5556', executable='/Users/gentlegen/Library/Android/sdk/platform-tools/adb', app='com.danteb.arrows';
const adb=(...args)=>execFileSync(executable,['-s',serial,...args],{encoding:'utf8',timeout:30000,maxBuffer:32*1024*1024});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const host=()=>{
  const uptime=execFileSync('uptime',[],{encoding:'utf8'}).trim(); const load=Number(uptime.match(/load averages?:\s*([\d.]+)/)?.[1]);
  const emulators=execFileSync('ps',['-axo','command'],{encoding:'utf8'}).split('\n').filter(l=>l.includes('qemu-system-'));
  return {uptime,load,emulators,quiet:Number.isFinite(load)&&load<4&&emulators.length===1&&emulators[0].includes('fleet_floor_api31')};
};
const shot=name=>writeFileSync(`${root}/screens/${name}.png`,execFileSync(executable,['-s',serial,'exec-out','screencap','-p'],{timeout:30000,maxBuffer:32*1024*1024}));
let seed=20261001; const coin=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>0x7fffffff};
const pairs=Array.from({length:12},()=>coin()?[false,true]:[true,false]);
const data={spec,seed:20261001,order:pairs,serial,apkSha256:createHash('sha256').update(readFileSync(`${root}/perf/${spec}.apk`)).digest('hex'),
  env:JSON.parse(readFileSync(`${root}/checks/build-env-${spec}.json`)),display:{width:1440,height:3120,density:560},runs:[]};
const context={adbExecutable:executable,serial,remoteJar:'/data/local/tmp/art-skin-input.jar',displayHeight:3120};
let driverReady=false;
for(let pair=0;pair<12;pair++) for(const enabled of pairs[pair]) {
  const i=data.runs.length,before=host(); adb('shell','am','force-stop',app); adb('logcat','-c');
  adb('shell','am','start','-W','-n',`${app}/.MainActivity`,'--ez','artSkinProcedural',String(enabled)); await wait(3500);
  let logs='';
  for(let attempt=0;attempt<17;attempt++) {
    logs=adb('logcat','-d','-s','ArtSkinSelection:I','ArtSkinCells:I','ArtSkinBaseGeometry:I','ArtSkinPrep:I','ArtSkinLazy:I','ArtSkinDraws:I','ArtSkinPerf:I','ReactNativeJS:I','AndroidRuntime:E');
    if(logs.includes('unitSet=real')) { writeFileSync(`${root}/perf/${spec}-${i}-open.log`,logs); throw new Error('Rejected non-test/PERF configuration'); }
    if(logs.includes('[board-camera]') && (!enabled || logs.includes('ArtSkinDraws'))) break;
    await wait(1000);
  }
  writeFileSync(`${root}/perf/${spec}-${i}-open.log`,logs);
  const events=(tag,field)=>[...logs.matchAll(new RegExp(`${tag}[^\\n]*?${field}=(\\d+)`,'g'))].map(m=>Number(m[1])/1e6);
  const camera=[...logs.matchAll(/\[board-camera\].*?scale=([\d.e-]+) tx=([\d.e-]+) ty=([\d.e-]+)/g)].at(-1);
  if(!camera) throw new Error(`No camera: ${spec}/${i}`);
  const screenCell=Number(camera[1])*40;
  const baseGeometry=events('ArtSkinBaseGeometry','parseNs');
  const preparation=events('ArtSkinPrep','prepareNs'),selection=events('ArtSkinSelection','parseNs'),cells=events('ArtSkinCells','parseNs'),recording=events('ArtSkinPerf','buildNs'),lazy=events('ArtSkinLazy','buildNs'),lazyRecording=events('ArtSkinLazy','recordNs');
  const draws=[...logs.matchAll(/arrows=250 screenCell=([\d.]+) maxStaticDrawsPerStrip=(\d+)/g)].map(m=>({screenCell:Number(m[1]),draws:Number(m[2])}));
  if(screenCell<28 || enabled && (preparation.length!==1 || selection.length!==1 || cells.length!==1 || baseGeometry.length!==1 || !logs.includes(`spec=${spec}`) || !draws.some(d=>d.screenCell>=28&&d.draws<=8&&d.draws>2))) throw new Error(`Invalid full-detail opening: ${JSON.stringify({spec,i,preparation,screenCell,draws})}`);
  const sum=a=>a.reduce((x,y)=>x+y,0);
  const run={i,pair,enabled,screenCell,before,selection,cells,baseGeometry,preparation,recording,lazy,lazyRecording,draws,preparationMs:sum(selection)+sum(cells)+sum(baseGeometry)+sum(preparation),
    recordingMs:sum(recording)-sum(preparation)+sum(lazyRecording),firstDrawMs:sum(lazy),exitStatus:'UNVERIFIED',frames:null};
  if(pair===0) shot(`${spec}-${enabled?'on':'off'}-viewport`);
  const gate=host(); run.exitHost=gate;
  if(before.quiet&&gate.quiet&&!driverReady) {
    const jar=buildInputDriver({sdkRoot:resolveAndroidSdkRoot(),apiLevel:36,outputDir:`${root}/perf/input-driver`});
    adb('push',jar,context.remoteJar);driverReady=true;
    run.exitHost=host(); // Compilation must not silently bypass the input-time quiet gate.
  }
  if(before.quiet&&run.exitHost.quiet) {
    const bounds=findBoardBounds(context); adb('shell','dumpsys','gfxinfo',app,'reset');
    const x=Math.round((Number(camera[2])+25.5*40*Number(camera[1]))*3.5),y=Math.round((Number(camera[3])+32.5*40*Number(camera[1]))*3.5+bounds.top);
    run.timing=invokeGestureDriver(context,['tap',String(x),String(y)]); await wait(1300);
    const gfx=adb('shell','dumpsys','gfxinfo',app,'framestats');writeFileSync(`${root}/perf/${spec}-${i}-gfxinfo.txt`,gfx);
    const frames=parseGfxInfoFrames(gfx);run.frames=frames.length ? {...summarizeFrames(frames,60),completed:frames.length,nominalSlots:78} : {completed:0,nominalSlots:78};
    adb('shell','uiautomator','dump','/sdcard/art04-after.xml');const xml=adb('shell','cat','/sdcard/art04-after.xml');
    writeFileSync(`${root}/perf/${spec}-${i}-after.xml`,xml);run.acceptedExit=xml.includes('249 left');run.exitStatus=run.acceptedExit&&frames.length ? 'CAPTURED — requires pair-wide quiet gate' : 'UNVERIFIED';
  }
  run.after=host(); data.runs.push(run);writeFileSync(`${root}/perf/${spec}-raw.json`,JSON.stringify(data,null,2)+'\n');
  console.log(JSON.stringify({spec,i,pair,enabled,screenCell,preparationMs:run.preparationMs,firstDrawMs:run.firstDrawMs,load:run.after.load,exitStatus:run.exitStatus}));
}
