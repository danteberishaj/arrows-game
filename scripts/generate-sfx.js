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

// Low buzzy thud: 160 Hz square, exponential decay. (AudioManager.MakeBlip)
function makeFail() {
  const samples = Math.ceil(RATE * 0.18);
  const data = new Float64Array(samples);
  for (let i = 0; i < samples; i++) {
    const t = i / RATE;
    const env = Math.exp(-t * 12);
    const wave = Math.sign(Math.sin(2 * Math.PI * 160 * t));
    data[i] = wave * env * 0.5;
  }
  return data;
}

// Band-passed noise whose filter sweeps up and back while the envelope decays
// — a quick air "whoosh", not a tone. (AudioManager.MakeSwoosh)
function makeWhoosh() {
  const duration = 0.3;
  const samples = Math.ceil(RATE * duration);
  const data = new Float64Array(samples);
  const rng = dotnetRandom(1234); // fixed seed => same clip every run
  let lp1 = 0, lp2 = 0, smooth = 0;
  const aSmooth = 1 - Math.exp((-2 * Math.PI * 900) / RATE);
  for (let i = 0; i < samples; i++) {
    const t = i / samples; // 0..1 through the clip
    const noise = rng() * 2 - 1;
    const sweep = Math.sin(t * Math.PI);
    const f = lerp(250, 1100, sweep);
    const a1 = 1 - Math.exp((-2 * Math.PI * f) / RATE);
    const a2 = 1 - Math.exp((-2 * Math.PI * (f * 0.4)) / RATE);
    lp1 += a1 * (noise - lp1);
    lp2 += a2 * (noise - lp2);
    smooth += aSmooth * (lp1 - lp2 - smooth);
    const env = smoothStep(0, 1, Math.min(1, t / 0.22)) * Math.exp(-2.6 * t);
    data[i] = smooth * env * 1.3;
  }
  return data;
}

// C-E-G-C sine arpeggio, each note decaying. (AudioManager.MakeArpeggio)
function makeWin() {
  const freqs = [523, 659, 784, 1046];
  const perNote = Math.ceil(RATE * 0.1);
  const data = new Float64Array(perNote * freqs.length);
  for (let n = 0; n < freqs.length; n++) {
    for (let i = 0; i < perNote; i++) {
      const t = i / RATE;
      const env = Math.exp(-t * 6);
      data[n * perNote + i] = Math.sin(2 * Math.PI * freqs[n] * t) * env * 0.45;
    }
  }
  return data;
}

const outDir = path.join(__dirname, '..', 'assets', 'audio');
fs.mkdirSync(outDir, { recursive: true });
writeWav(path.join(outDir, 'whoosh.wav'), makeWhoosh());
writeWav(path.join(outDir, 'fail.wav'), makeFail());
writeWav(path.join(outDir, 'win.wav'), makeWin());
