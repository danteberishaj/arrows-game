#!/usr/bin/env node
// Same-APK shuffled, balanced OFF/ON pilot. Existing input driver and gfxinfo parser.
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildInputDriver, resolveAndroidSdkRoot } from '../perf/android/build-uiautomator.mjs';
import { findBoardBounds, cellCenter, invokeGestureDriver } from '../perf/android/benchmark.mjs';
import { parseGfxInfoFrames, summarizeFrames } from '../perf/android/parse-gfxinfo.mjs';

const root = 'artifacts/ART-SKINS-02';
const serial = process.env.ART_SKIN_SERIAL;
if (serial !== 'emulator-5556') throw new Error('ART-SKINS-02 permits only emulator-5556');
const sdk = resolveAndroidSdkRoot();
const executable = `${sdk}/platform-tools/adb`;
const app = 'com.danteb.arrows';
const adb = (...args) => execFileSync(executable, ['-s', serial, ...args], { encoding: 'utf8', timeout: 30000, maxBuffer: 32 * 1024 * 1024 });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const apk = `${root}/perf/procedural-on.apk`;
const plan = JSON.parse(readFileSync(`${root}/perf/tap.json`, 'utf8'));
mkdirSync(`${root}/perf/driver`, { recursive: true });
const driver = buildInputDriver({ sdkRoot: sdk, apiLevel: 36, outputDir: `${root}/perf/driver` });
adb('push', driver, '/data/local/tmp/art-skin-input.jar');
const context = { adbExecutable: executable, serial, remoteJar: '/data/local/tmp/art-skin-input.jar', displayHeight: 2400 };
const output = { apkSha256: createHash('sha256').update(readFileSync(apk)).digest('hex'), serial,
  levelIndex: 3827, plan, refreshHz: 60, exitDurationMs: 1000, runs: [] };
const shot = (name) => writeFileSync(`${root}/screens/${name}.png`,
  execFileSync(executable, ['-s', serial, 'exec-out', 'screencap', '-p'], { timeout: 30000, maxBuffer: 8 * 1024 * 1024 }));

// Seeded Fisher-Yates; 12 OFF and 12 ON. Order is retained in raw.json.
let seed = 20260930;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const order = Array.from({ length: 24 }, (_, i) => i % 2 === 1);
for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
output.order = order; output.seed = 20260930;
output.hostBefore = execFileSync('uptime', [], { encoding: 'utf8' }).trim();
output.emulatorsBefore = execFileSync('ps', ['-axo', 'command'], { encoding: 'utf8' }).split('\n').filter((line) => line.includes('qemu-system-') && line.includes('-avd'));
output.exitFrameGate = 'UNVERIFIED: check load <4 before/after every run and exactly one emulator';
output.hostSamples = [];
let offRuns = 0; let onCaptured = false; let offCaptured = false;
for (let i = 0; i < order.length; i++) {
  output.hostSamples.push({ i, before: execFileSync('uptime', [], { encoding: 'utf8' }).trim() });
  const textured = order[i];
  const arm = textured ? 'B' : offRuns++ < 6 ? 'A' : 'A2';
  adb('shell', 'am', 'force-stop', app);
  adb('logcat', '-c');
  adb('shell', 'am', 'start', '-W', '-n', `${app}/.MainActivity`, '--ez', 'artSkinProcedural', String(textured));
  await wait(3200);
  const bounds = findBoardBounds(context);
  const logs = adb('logcat', '-d', '-s', 'ArtSkinPerf:I');
  writeFileSync(`${root}/perf/run-${i}-build.log`, logs);
  const builds = [...logs.matchAll(/buildNs=(\d+) procedural=(true|false) strips=(\d+)/g)]
    .map((m) => ({ ns: Number(m[1]), textured: m[2] === 'true', strips: Number(m[3]) }));
  if (!builds.some((b) => b.textured === textured)) throw new Error(`Renderer selection not verified for run ${i}`);
  if (textured && !onCaptured || !textured && !offCaptured) { shot(textured ? 'on' : 'off'); if (textured) onCaptured = true; else offCaptured = true; }
  adb('shell', 'dumpsys', 'gfxinfo', app, 'reset');
  const point = cellCenter(bounds, plan.row, plan.col, plan.rows, plan.cols);
  const timing = invokeGestureDriver(context, ['tap', String(point.x), String(point.y)]);
  if (textured && i === order.indexOf(true)) { await wait(120); shot('exit-mid-flight'); }
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
  output.hostAfter = execFileSync('uptime', [], { encoding: 'utf8' }).trim();
  output.hostSamples[i].after = output.hostAfter;
  writeFileSync(`${root}/perf/run-${i}-prep.log`, adb('logcat', '-d', '-s', 'ArtSkinPrep:I', 'ArtSkinDraws:I'));
  writeFileSync(`${root}/perf/raw.json`, JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify({ i, arm, buildMs: run.buildMs, frames: frames.length, nominalSlots: 78, p50: summary.uiFrameP50Ms, p95: summary.uiFrameP95Ms }));
}
