#!/usr/bin/env node
/**
 * Generates the game's sound effects as small mono 16-bit WAV files in
 * assets/audio/. Ports the synthesizers from the Unity AudioManager.cs
 * (short sine blips with exponential decay, a band-passed noise whoosh, and
 * a C-E-G-C win arpeggio) so the RN build sounds identical without shipping
 * recordings.
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

// Same Knuth-subtractive RNG as the game core, so the whoosh's fixed seed
// (1234) reproduces the exact Unity noise sequence.
function dotnetRandom(seed) {
  const MBIG = 2147483647;
  const arr = new Array(56).fill(0);
  let mj = 161803398 - Math.abs(seed | 0);
  arr[55] = mj;
  let mk = 1;
  for (let i = 1; i < 55; i++) {
    const ii = (21 * i) % 55;
    arr[ii] = mk;
    mk = mj - mk;
    if (mk < 0) mk += MBIG;
    mj = arr[ii];
  }
  for (let k = 1; k < 5; k++)
    for (let i = 1; i < 56; i++) {
      arr[i] -= arr[1 + ((i + 30) % 55)];
      if (arr[i] < 0) arr[i] += MBIG;
    }
  let inext = 0, inextp = 21;
  return () => {
    if (++inext >= 56) inext = 1;
    if (++inextp >= 56) inextp = 1;
    let r = arr[inext] - arr[inextp];
    if (r === MBIG) r--;
    if (r < 0) r += MBIG;
    arr[inext] = r;
    return r * (1.0 / MBIG);
  };
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

// Band-passed noise whose filter sweeps up and back while the envelope decays.
// Smoother than v1: longer, deeper band (180 -> 650 Hz), softer attack and a
// lower final low-pass — a brush of air, not a hiss.
function makeWhoosh() {
  const duration = 0.42;
  const samples = Math.ceil(RATE * duration);
  const data = new Float64Array(samples);
  const rng = dotnetRandom(1234); // fixed seed => same clip every run
  let lp1 = 0, lp2 = 0, smooth = 0, smooth2 = 0;
  const aSmooth = 1 - Math.exp((-2 * Math.PI * 700) / RATE);
  for (let i = 0; i < samples; i++) {
    const t = i / samples; // 0..1 through the clip
    const noise = rng() * 2 - 1;
    const sweep = Math.sin(t * Math.PI);
    const f = lerp(180, 650, sweep);
    const a1 = 1 - Math.exp((-2 * Math.PI * f) / RATE);
    const a2 = 1 - Math.exp((-2 * Math.PI * (f * 0.45)) / RATE);
    lp1 += a1 * (noise - lp1);
    lp2 += a2 * (noise - lp2);
    // Two smoothing poles in series: rounds the top end right off.
    smooth += aSmooth * (lp1 - lp2 - smooth);
    smooth2 += aSmooth * (smooth - smooth2);
    const env = smoothStep(0, 1, Math.min(1, t / 0.3)) * Math.exp(-2.2 * t);
    data[i] = smooth2 * env * 1.6;
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

const outDir = path.join(__dirname, '..', 'assets', 'audio');
fs.mkdirSync(outDir, { recursive: true });
writeWav(path.join(outDir, 'whoosh.wav'), makeWhoosh());
writeWav(path.join(outDir, 'fail.wav'), makeFail());
writeWav(path.join(outDir, 'win.wav'), makeWin());
writeWav(path.join(outDir, 'star.wav'), makeStar());
