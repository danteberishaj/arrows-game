#!/usr/bin/env node
// Real gesture route supplements the native fixture; sparse recordings cannot certify latency.
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolveAndroidSdkRoot } from '../perf/android/build-uiautomator.mjs';
import { findBoardBounds, cellCenter, invokeGestureDriver } from '../perf/android/benchmark.mjs';
const root = 'artifacts/ART-SKINS-02/recordings';
const executable = `${resolveAndroidSdkRoot()}/platform-tools/adb`;
const serial = 'emulator-5556';
const app = 'com.danteb.arrows';
const adb = (...args) => execFileSync(executable, ['-s', serial, ...args], { encoding: 'utf8', timeout: 25000, maxBuffer: 16 * 1024 * 1024 });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const plan = JSON.parse(readFileSync(`${root}/game-plan.json`, 'utf8'));
const context = { adbExecutable: executable, serial, remoteJar: '/data/local/tmp/art-skin-input.jar', displayHeight: 2400 };
const before = adb('shell', 'settings', 'get', 'global', 'transition_animation_scale').trim();
const evidence = { transitionAnimationScaleBefore: before, observations: [] };
try {
  for (const reduced of [false, true]) {
    const name = reduced ? 'game-reduced' : 'game-motion';
    // Reanimated reads this preference when the process starts (NativeProxy.getIsReducedMotion).
    adb('shell', 'settings', 'put', 'global', 'transition_animation_scale', reduced ? '0' : '1');
    adb('shell', 'am', 'force-stop', app);
    adb('shell', 'am', 'start', '-W', '-n', `${app}/.MainActivity`, '--ez', 'artSkinProcedural', 'true');
    await wait(3000);
    const bounds = findBoardBounds(context);
    const points = plan.exits.map(({r,c}) => cellCenter(bounds, r, c, plan.rows, plan.cols));
    const blocked = cellCenter(bounds, plan.blocked.r, plan.blocked.c, plan.rows, plan.cols);
    const record = spawn(executable, ['-s', serial, 'shell', 'screenrecord', '--bit-rate', '6000000', '--time-limit', '10', `/sdcard/art02-${name}.mp4`]);
    const finished = new Promise((resolve, reject) => { record.on('error', reject); record.on('exit', code => code === 0 ? resolve() : reject(new Error(`screenrecord ${code}`))); });
    const events = [];
    await wait(400);
    const first = points[0];
    events.push({ event: 'press-hold-release', hostMs: Date.now(), point: first });
    adb('shell', 'input', 'swipe', String(first.x), String(first.y), String(first.x), String(first.y), '800');
    await wait(500);
    events.push({ event: 'five-exit-chain', hostMs: Date.now(), timing: invokeGestureDriver(context, ['tap-sequence', '400', ...points.slice(1).flatMap(p => [String(p.x), String(p.y)])]) });
    await wait(700);
    events.push({ event: 'blocked', hostMs: Date.now(), timing: invokeGestureDriver(context, ['tap', String(blocked.x), String(blocked.y)]) });
    await wait(700);
    // Header hint centre observed in the 1080x2400 dense-board capture.
    events.push({ event: 'hint', hostMs: Date.now(), timing: invokeGestureDriver(context, ['tap', '1018', '185']) });
    await finished;
    adb('pull', `/sdcard/art02-${name}.mp4`, `${root}/${name}.mp4`);
    adb('shell', 'uiautomator', 'dump', '/sdcard/art02-game.xml');
    const hierarchy = adb('shell', 'cat', '/sdcard/art02-game.xml');
    writeFileSync(`${root}/${name}-hierarchy.xml`, hierarchy);
    evidence.observations.push({ name, reduced, bounds, events, preferenceReadback: adb('shell', 'settings', 'get', 'global', 'transition_animation_scale').trim(), remainingLabel: hierarchy.match(/\d+ left/g) });
  }
} finally {
  if (before === 'null') adb('shell', 'settings', 'delete', 'global', 'transition_animation_scale');
  else adb('shell', 'settings', 'put', 'global', 'transition_animation_scale', before);
  evidence.transitionAnimationScaleRestored = adb('shell', 'settings', 'get', 'global', 'transition_animation_scale').trim();
  writeFileSync(`${root}/game-events.json`, JSON.stringify(evidence, null, 2) + '\n');
}
