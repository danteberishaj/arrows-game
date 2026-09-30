#!/usr/bin/env node
// Full-detail level opens with blocked OFF/ON randomisation; exit capture requires a quiet host.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolveAndroidSdkRoot } from '../perf/android/build-uiautomator.mjs';
import { findBoardBounds, invokeGestureDriver } from '../perf/android/benchmark.mjs';
import { parseGfxInfoFrames, summarizeFrames } from '../perf/android/parse-gfxinfo.mjs';
const root = 'artifacts/ART-SKINS-03';
const serial = 'emulator-5556';
const executable = `${resolveAndroidSdkRoot()}/platform-tools/adb`;
const app = 'com.danteb.arrows';
const adb = (...args) => execFileSync(executable, ['-s', serial, ...args], { encoding: 'utf8', timeout: 30000, maxBuffer: 32 * 1024 * 1024 });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const host = () => {
  const uptime = execFileSync('uptime', [], { encoding: 'utf8' }).trim();
  const load = Number(uptime.match(/load averages?:\s*([\d.]+)/)?.[1]);
  const emulators = execFileSync('ps', ['-axo', 'command'], { encoding: 'utf8' }).split('\n').filter(line => line.includes('qemu-system-') && line.includes('-avd'));
  return { uptime, load, emulators, quiet: Number.isFinite(load) && load < 4 && emulators.length === 1 && emulators[0].includes('fleet_floor_api31') };
};
const shot = name => writeFileSync(`${root}/screens/${name}.png`, execFileSync(executable, ['-s', serial, 'exec-out', 'screencap', '-p'], { timeout: 30000, maxBuffer: 12 * 1024 * 1024 }));
let state = 20260930;
const coin = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state > 0x7fffffff; };
const pairs = Array.from({ length: 12 }, () => coin() ? [false, true] : [true, false]);
const raw = { seed: 20260930, order: pairs, apkSha256: createHash('sha256').update(readFileSync(`${root}/perf/procedural-on.apk`)).digest('hex'),
  buildEnv: JSON.parse(readFileSync(`${root}/checks/build-env.json`, 'utf8')), display: { width: 1440, height: 3120, density: 560 }, exitDurationMs: 1000, refreshHz: 60, runs: [] };
const context = { adbExecutable: executable, serial, remoteJar: '/data/local/tmp/art-skin-input.jar', displayHeight: 3120 };
for (let pair = 0; pair < pairs.length; pair++) {
  for (const enabled of pairs[pair]) {
    const i = raw.runs.length; const before = host();
    adb('shell', 'am', 'force-stop', app); adb('logcat', '-c');
    adb('shell', 'am', 'start', '-W', '-n', `${app}/.MainActivity`, '--ez', 'artSkinProcedural', String(enabled));
    await wait(3500);
    const logs = adb('logcat', '-d', '-s', 'ArtSkinPrep:I', 'ArtSkinDraws:I', 'ArtSkinPerf:I', 'ReactNativeJS:I', 'AndroidRuntime:E');
    writeFileSync(`${root}/perf/run-${i}-open.log`, logs);
    const prep = [...logs.matchAll(/prepareNs=(\d+) procedural=true arrows=250 screenCell=([\d.]+) detail=(\d+)/g)].map(m => ({ ms: Number(m[1]) / 1e6, screenCell: Number(m[2]), detail: Number(m[3]) }));
    const draws = [...logs.matchAll(/arrows=250 screenCell=([\d.]+) maxStaticDrawsPerStrip=(\d+)/g)].map(m => ({ screenCell: Number(m[1]), draws: Number(m[2]) }));
    const camera = [...logs.matchAll(/\[board-camera\].*?scale=([\d.e-]+) tx=([\d.e-]+) ty=([\d.e-]+)/g)].at(-1);
    if (!camera) throw new Error(`Opening camera missing in run ${i}`);
    const screenCell = Number(camera[1]) * 40;
    if (screenCell < 28 || enabled && (prep.length !== 1 || prep[0].detail !== 2 || !draws.some(d => d.screenCell >= 28 && d.draws >= 7))) throw new Error(`Full initial detail not proven for run ${i}: ${JSON.stringify({screenCell,prep,draws})}`);
    if (pair === 0) shot(enabled ? 'dense-on' : 'dense-off');
    const run = { i, pair, enabled, screenCell, prep, draws, before, buildMs: [...logs.matchAll(/buildNs=(\d+)/g)].reduce((sum,m) => sum + Number(m[1]) / 1e6, 0), exitStatus: 'UNVERIFIED', frames: null };
    // No tap/frame experiment on a contended host. Recheck immediately before input.
    const gate = host(); run.exitHost = gate;
    if (before.quiet && gate.quiet) {
      const bounds = findBoardBounds(context); run.bounds = bounds;
      adb('shell', 'dumpsys', 'gfxinfo', app, 'reset');
      const point = { x: Math.round((Number(camera[2]) + 25.5 * 40 * Number(camera[1])) * 3.5),
        y: Math.round((Number(camera[3]) + 32.5 * 40 * Number(camera[1])) * 3.5 + bounds.top) };
      run.timing = invokeGestureDriver(context, ['tap', String(point.x), String(point.y)]);
      await wait(1300);
      const gfx = adb('shell', 'dumpsys', 'gfxinfo', app, 'framestats');
      writeFileSync(`${root}/perf/run-${i}-gfxinfo.txt`, gfx);
      const frames = parseGfxInfoFrames(gfx);
      run.frames = { ...summarizeFrames(frames, 60), completed: frames.length, nominalSlots: 78 };
      adb('shell', 'uiautomator', 'dump', '/sdcard/art03-after.xml');
      const hierarchy = adb('shell', 'cat', '/sdcard/art03-after.xml');
      writeFileSync(`${root}/perf/run-${i}-after.xml`, hierarchy);
      run.acceptedExit = hierarchy.includes('249 left');
      run.exitStatus = 'CAPTURED — verify accepted exit and pair-wide quiet prerequisites before interpretation';
    }
    run.after = host(); raw.runs.push(run);
    writeFileSync(`${root}/perf/raw.json`, JSON.stringify(raw, null, 2) + '\n');
    console.log(JSON.stringify({ i, pair, enabled, screenCell, preparationMs: prep.map(p => p.ms), exitStatus: run.exitStatus, hostLoad: run.after.load, frames: run.frames }));
  }
}
