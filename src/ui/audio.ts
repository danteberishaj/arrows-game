import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { SaveSystem } from '../core';

/**
 * Plays the game's three sound effects (whoosh on a successful exit, a low
 * buzzy thud on a blocked tap, a C-E-G-C arpeggio on a win). The clips are
 * synthesized by scripts/generate-sfx.js — the same synths as the Unity
 * AudioManager — so nothing here is a recording. Honours SaveSystem.soundOn.
 */
const sources = {
  success: require('../../assets/audio/whoosh.wav'),
  fail: require('../../assets/audio/fail.wav'),
  win: require('../../assets/audio/win.wav'),
} as const;

const players = new Map<keyof typeof sources, AudioPlayer>();

function play(name: keyof typeof sources): void {
  if (!SaveSystem.soundOn) return;
  try {
    let p = players.get(name);
    if (!p) {
      p = createAudioPlayer(sources[name]);
      players.set(name, p);
    }
    p.seekTo(0);
    p.play();
  } catch {
    // Audio is decorative; never let it break gameplay.
  }
}

export const Sfx = {
  playSuccess: () => play('success'),
  playFail: () => play('fail'),
  playWin: () => play('win'),
};
