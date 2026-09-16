import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { SaveSystem } from '../core';
import { EXIT_COMBO_STEPS } from './exitCombo';

/**
 * Expo Audio fallback (web and Expo Go; installed builds use the native
 * ArrowsFeedback module). Plays the exit pop at the combo's pitch step, a low
 * thud on a blocked tap, a kalimba arpeggio on a win and a chirp per star.
 * The clips are synthesized by scripts/generate-sfx.js, so nothing here is a
 * recording. Honours SaveSystem.soundOn.
 */
const sources = {
  pop0: require('../../assets/audio/pop0.wav'),
  pop1: require('../../assets/audio/pop1.wav'),
  pop2: require('../../assets/audio/pop2.wav'),
  pop3: require('../../assets/audio/pop3.wav'),
  pop4: require('../../assets/audio/pop4.wav'),
  pop5: require('../../assets/audio/pop5.wav'),
  pop6: require('../../assets/audio/pop6.wav'),
  pop7: require('../../assets/audio/pop7.wav'),
  fail: require('../../assets/audio/fail.wav'),
  win: require('../../assets/audio/win.wav'),
  star: require('../../assets/audio/star.wav'),
} as const;

type SourceName = keyof typeof sources;

const players = new Map<SourceName, AudioPlayer>();

function play(name: SourceName): void {
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

function popName(step: number): SourceName {
  const clamped = Math.max(0, Math.min(EXIT_COMBO_STEPS - 1, Math.trunc(step)));
  return `pop${clamped}` as SourceName;
}

export const Sfx = {
  playSuccess: (step = 0) => play(popName(step)),
  playFail: () => play('fail'),
  playWin: () => play('win'),
  playStar: () => play('star'),
};
