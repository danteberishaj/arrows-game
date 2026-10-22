#!/usr/bin/env node
/**
 * Generates the game's sound effects as small mono 16-bit WAV files in
 * assets/audio/ (Android reads them as uncompressed assets) and mirrors them
 * into modules/arrows-feedback/ios/Resources/ (the iOS resource bundle), so
 * both platforms play byte-identical clips. Ports the Unity AudioManager.cs
 * synths (sine blips with exponential decay, a C-E-G-C win arpeggio). The exit
 * pop ladder pop0..pop7 is a real recording, built by scripts/build-exit-pops.py.
 *
 * Run once (or after tweaking): node scripts/generate-sfx.js
 */
const fs = require('fs');
const path = require('path');

const RATE = 44100;

function writeWav(file, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(file, buf);
  console.log(`${path.basename(file)}  ${(buf.length / 1024).toFixed(1)} KB`);
}

const smoothStep = (a, b, t) => {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};
const lerp = (a, b, t) => a + (b - a) * t;

// Soft low thud with a falling pitch (170 -> 100 Hz sine + a whisper of 2nd
// harmonic). Calmer than the old square-wave buzz — a bump, not an alarm.
function makeFail() {
  const duration = 0.2;
  const samples = Math.ceil(RATE * duration);
  const data = new Float64Array(samples);
  let phase = 0;
  for (let i = 0; i < samples; i++) {
    const t = i / RATE;
    const f = lerp(170, 100, Math.min(1, t / duration));
    phase += (2 * Math.PI * f) / RATE;
    const env = Math.exp(-t * 14) * smoothStep(0, 1, Math.min(1, t / 0.008));
    data[i] = (Math.sin(phase) + 0.25 * Math.sin(2 * phase)) * env * 0.5;
  }
  return data;
}

// A kalimba pluck: fundamental + soft 2nd/3rd partials, fast decay, the tiniest
// attack ramp so it never clicks.
function pluck(data, startSample, freq, gain, decay = 7) {
  const len = Math.min(data.length - startSample, Math.ceil(RATE * 0.5));
  for (let i = 0; i < len; i++) {
    const t = i / RATE;
    const env = Math.exp(-t * decay) * smoothStep(0, 1, Math.min(1, t / 0.006));
    const w =
      Math.sin(2 * Math.PI * freq * t) +
      0.35 * Math.sin(2 * Math.PI * freq * 2 * t) * Math.exp(-t * 12) +
      0.12 * Math.sin(2 * Math.PI * freq * 3 * t) * Math.exp(-t * 16);
    data[startSample + i] += w * env * gain;
  }
}

// Cute clear chime: three quick kalimba plucks skipping up the major triad
// (E5 -> G5 -> C6) with a gentle swing, the last note ringing a touch longer
// with a soft octave shimmer. Bright, small, and over in ~0.8 s.
function makeWin() {
  const samples = Math.ceil(RATE * 0.85);
  const data = new Float64Array(samples);
  pluck(data, 0, 659.26, 0.3); // E5
  pluck(data, Math.floor(RATE * 0.095), 783.99, 0.34); // G5
  pluck(data, Math.floor(RATE * 0.21), 1046.5, 0.38, 5); // C6, rings longer
  pluck(data, Math.floor(RATE * 0.21), 2093.0, 0.08, 6); // octave shimmer
  return data;
}

// Tiny rising pop for each star on the win panel: a fast 660 -> 990 Hz chirp.
function makeStar() {
  const duration = 0.12;
  const samples = Math.ceil(RATE * duration);
  const data = new Float64Array(samples);
  let phase = 0;
  for (let i = 0; i < samples; i++) {
    const t = i / RATE;
    const f = lerp(660, 990, smoothStep(0, 1, t / duration));
    phase += (2 * Math.PI * f) / RATE;
    const env = Math.exp(-t * 24) * smoothStep(0, 1, Math.min(1, t / 0.005));
    data[i] = (Math.sin(phase) + 0.2 * Math.sin(2 * phase)) * env * 0.42;
  }
  return data;
}

const outDirs = [
  path.join(__dirname, '..', 'assets', 'audio'),
  path.join(__dirname, '..', 'modules', 'arrows-feedback', 'ios', 'Resources'),
];
const clips = {
  'fail.wav': makeFail(),
  'win.wav': makeWin(),
  'star.wav': makeStar(),
};
for (const outDir of outDirs) {
  fs.mkdirSync(outDir, { recursive: true });
  const stale = path.join(outDir, 'whoosh.wav');
  if (fs.existsSync(stale)) fs.unlinkSync(stale);
  for (const [name, samples] of Object.entries(clips)) {
    writeWav(path.join(outDir, name), samples);
  }
}
