#!/usr/bin/env node
// Same-APK alternating OFF/ON pilot. Existing input driver and gfxinfo parser.
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildInputDriver, resolveAndroidSdkRoot } from '../perf/android/build-uiautomator.mjs';
import { findBoardBounds, cellCenter, invokeGestureDriver } from '../perf/android/benchmark.mjs';
import { parseGfxInfoFrames, summarizeFrames } from '../perf/android/parse-gfxinfo.mjs';

const root = 'artifacts/ART-SKINS-01';
const serial = process.env.ART_SKIN_SERIAL;
if (!serial) throw new Error('Set ART_SKIN_SERIAL to an emulator reserved for this experiment');
const sdk = resolveAndroidSdkRoot();
const executable = `${sdk}/platform-tools/adb`;
const app = 'com.danteb.arrows';
const adb = (...args) => execFileSync(executable, ['-s', serial, ...args], { encoding: 'utf8', timeout: 30000, maxBuffer: 32 * 1024 * 1024 });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const apk = `${root}/perf/skin-spike.apk`;
const plan = JSON.parse(readFileSync(`${root}/perf/tap.json`, 'utf8'));
mkdirSync(`${root}/perf/driver`, { recursive: true });
const driver = buildInputDriver({ sdkRoot: sdk, apiLevel: 36, outputDir: `${root}/perf/driver` });
adb('push', driver, '/data/local/tmp/art-skin-input.jar');
const context = { adbExecutable: executable, serial, remoteJar: '/data/local/tmp/art-skin-input.jar', displayHeight: 2400 };
const output = { apkSha256: createHash('sha256').update(readFileSync(apk)).digest('hex'), serial,
  levelIndex: 3827, plan, refreshHz: 60, exitDurationMs: 1000, runs: [] };
const shot = (name) => writeFileSync(`${root}/screens/${name}.png`,
  execFileSync(executable, ['-s', serial, 'exec-out', 'screencap', '-p'], { timeout: 30000, maxBuffer: 8 * 1024 * 1024 }));

for (let i = 0; i < 48; i++) {
  const textured = i % 2 === 1;
  const arm = textured ? 'B' : i < 24 ? 'A' : 'A2';
  adb('shell', 'am', 'force-stop', app);
  adb('logcat', '-c');
  adb('shell', 'am', 'start', '-W', '-n', `${app}/.MainActivity`, '--ez', 'artSkinTextured', String(textured));
  await wait(3200);
  const bounds = findBoardBounds(context);
  const logs = adb('logcat', '-d', '-s', 'ArtSkinPerf:I');
  writeFileSync(`${root}/perf/run-${i}-build.log`, logs);
  const builds = [...logs.matchAll(/buildNs=(\d+) textured=(true|false) strips=(\d+)/g)]
    .map((m) => ({ ns: Number(m[1]), textured: m[2] === 'true', strips: Number(m[3]) }));
  if (!builds.some((b) => b.textured === textured)) throw new Error(`Renderer selection not verified for run ${i}`);
  if (i < 2) shot(textured ? 'on' : 'off');
  adb('shell', 'dumpsys', 'gfxinfo', app, 'reset');
  const point = cellCenter(bounds, plan.row, plan.col, plan.rows, plan.cols);
  const timing = invokeGestureDriver(context, ['tap', String(point.x), String(point.y)]);
  if (i === 1) { await wait(120); shot('exit-mid-flight'); }
  await wait(1300);
  const gfx = adb('shell', 'dumpsys', 'gfxinfo', app, 'framestats');
  writeFileSync(`${root}/perf/run-${i}-gfxinfo.txt`, gfx);
  const frames = parseGfxInfoFrames(gfx);
  const summary = summarizeFrames(frames, 60);
  const afterLogs = adb('logcat', '-d', '-s', 'ArtSkinPerf:I');
  writeFileSync(`${root}/perf/run-${i}-after.log`, afterLogs);
  const run = { i, arm, textured, builds, buildMs: builds.reduce((sum, b) => sum + b.ns / 1e6, 0),
    bounds, point, timing, windowMs: 1300, expectedDisplayFrames: 78,
    ...summary, deadlineMisses: frames.filter((f) => f.missedDeadline).length };
  output.runs.push(run);
  writeFileSync(`${root}/perf/raw.json`, JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify({ i, arm, buildMs: run.buildMs, frames: frames.length, p95: summary.uiFrameP95Ms }));
}
