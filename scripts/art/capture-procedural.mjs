#!/usr/bin/env node
// Diagnostic fixture uses the real native view. This does not replace real-game latency verification.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolveAndroidSdkRoot } from '../perf/android/build-uiautomator.mjs';
const root = 'artifacts/ART-SKINS-02';
const adbPath = `${resolveAndroidSdkRoot()}/platform-tools/adb`;
const adb = (...args) => execFileSync(adbPath, ['-s', 'emulator-5556', ...args], { encoding: 'utf8', timeout: 20000, maxBuffer: 16 * 1024 * 1024 });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const app = 'com.danteb.arrows';
const launch = (...extras) => adb('shell', 'am', 'start', '-W', '-n', `${app}/.ProceduralSkinFixtureActivity`, ...extras);
const shot = (name) => writeFileSync(`${root}/screens/${name}.png`, execFileSync(adbPath,
  ['-s', 'emulator-5556', 'exec-out', 'screencap', '-p'], { timeout: 20000, maxBuffer: 8 * 1024 * 1024 }));
for (const folder of ['screens', 'recordings', 'checks']) mkdirSync(`${root}/${folder}`, { recursive: true });
adb('shell', 'am', 'force-stop', app);
adb('logcat', '-c');
adb('shell', 'am', 'start', '-W', '-n', `${app}/.MainActivity`, '--ez', 'artSkinProcedural', 'true');
await wait(3500);
for (const cell of [38, 24, 12]) {
  launch('--ef', 'cell', String(cell), '--ei', 'count', '14', '--ez', 'artSkinProcedural', 'true');
  await wait(700); shot(`fixture-${cell}`);
  adb('shell', 'am', 'force-stop', app);
  adb('shell', 'am', 'start', '-W', '-n', `${app}/.MainActivity`, '--ez', 'artSkinProcedural', 'true');
  await wait(2500);
}
for (const count of [10, 100, 250]) {
  for (const marks of [false, true]) {
    launch('--ef', 'cell', '38', '--ei', 'count', String(count), '--ez', 'marks', String(marks), '--ez', 'artSkinProcedural', 'true');
    await wait(500);
    writeFileSync(`${root}/checks/draws-${count}-${marks ? 'marked' : 'plain'}.txt`, adb('logcat', '-d', '-s', 'ArtSkinDraws:I', 'ArtSkinPerf:I', 'ArtSkinPrep:I'));
    adb('shell', 'am', 'force-stop', app);
    adb('shell', 'am', 'start', '-W', '-n', `${app}/.MainActivity`, '--ez', 'artSkinProcedural', 'true');
    await wait(2500);
  }
}
for (const reduced of [false, true]) {
  const name = reduced ? 'reduced' : 'motion';
  adb('logcat', '-c');
  // Native fixture selection is explicit. Real-game OS preference routing is checked separately.
  const recording = spawn(adbPath, ['-s', 'emulator-5556', 'shell', 'screenrecord', '--bit-rate', '6000000', '--time-limit', '10', `/sdcard/art02-${name}.mp4`]);
  const finished = new Promise((resolve, reject) => { recording.on('error', reject); recording.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`screenrecord exited ${code}`))); });
  await wait(250);
  launch('--ef', 'cell', '38', '--ei', 'count', '14', '--ez', 'replay', 'true', '--ez', 'reduced', String(reduced), '--ez', 'artSkinProcedural', 'true');
  await finished;
  adb('pull', `/sdcard/art02-${name}.mp4`, `${root}/recordings/${name}.mp4`);
  writeFileSync(`${root}/recordings/${name}-events.txt`, adb('logcat', '-d', '-s', 'ArtSkinMotion:I', 'AndroidRuntime:E'));
  adb('shell', 'am', 'force-stop', app);
  adb('shell', 'am', 'start', '-W', '-n', `${app}/.MainActivity`, '--ez', 'artSkinProcedural', 'true');
  await wait(2500);
}
console.log('Native fixtures, draw audits and two 10-second diagnostic recordings saved.');
