#!/usr/bin/env python3
"""
Builds the arrow-exit pop ladder pop0..pop7.wav from one real recording and
writes it to assets/audio/ (Android assets) and modules/arrows-feedback/ios/Resources/.

Source: scripts/sfx-source/ppop-freesound-527522.ogg, "ppop.wav" by Narjara,
https://freesound.org/people/Narjara/sounds/527522/ (CC0, licence read on the item page 2026-10-18).
Picked by the owner in an A/B (candidate C) after earshot ranked 26 CC0 pops;
it replaced a synthesized pop that earshot read as "a cheap synthesized beep" (p_real 0.03).

Each step is the recording resampled (pitch and speed move together, like tape), on the same
major-pentatonic intervals as before, so adjacent combo steps stay consonant. Pre-rendered because
AVAudioPlayer's rate is a pitch-preserving time stretch.

Needs numpy, soundfile and soxr (e.g. the earshot venv):
  ~/.claude/tools/earshot/.venv/bin/python -I scripts/build-exit-pops.py
"""
import os
import numpy as np
import soundfile as sf
import soxr

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SOURCE = os.path.join(ROOT, 'scripts', 'sfx-source', 'ppop-freesound-527522.ogg')
OUT_DIRS = [os.path.join(ROOT, 'assets', 'audio'),
            os.path.join(ROOT, 'modules', 'arrows-feedback', 'ios', 'Resources')]
RATE = 44100
LADDER = [0, 2, 4, 7, 9, 12, 14, 16]  # semitones, major pentatonic
BASE = -5  # whole ladder sits 5 semitones under the recording, so step 7 isn't a 2.5x chipmunk
PEAK = 10 ** (-6 / 20)  # -6 dBFS, same as the blocked thud so reward >= punishment


def step(x, semitones):
    k = 2 ** (semitones / 12)
    y = soxr.resample(x, RATE * k, RATE)
    fade_in, fade_out = min(44, len(y)), min(int(0.012 * RATE), len(y))
    y[:fade_in] *= np.linspace(0, 1, fade_in)  # 1 ms: no click where the file starts on the attack
    y[-fade_out:] *= np.linspace(1, 0, fade_out)
    return y * (PEAK / np.max(np.abs(y)))


def main():
    x, sr = sf.read(SOURCE, dtype='float64', always_2d=True)
    x = x.mean(axis=1)
    if sr != RATE:
        x = soxr.resample(x, sr, RATE)
    clips = [step(x, BASE + s) for s in LADDER]
    lengths = [len(c) for c in clips]
    assert lengths == sorted(lengths, reverse=True), 'higher steps must be shorter'
    assert all(abs(np.max(np.abs(c)) - PEAK) < 1e-6 for c in clips)
    for d in OUT_DIRS:
        for i, c in enumerate(clips):
            sf.write(os.path.join(d, f'pop{i}.wav'), c, RATE, subtype='PCM_16')
    print('pop0..pop7 ms:', [round(n / RATE * 1000) for n in lengths])


if __name__ == '__main__':
    main()
