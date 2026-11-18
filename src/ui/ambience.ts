import { useEffect } from 'react';
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import type { AudioPlayer } from 'expo-audio';
import { ArrowsFeedback } from '../../modules/arrows-feedback';
import { META_AMBIENCE } from '../featureFlags';
import { seasonNow } from './seasonClock';
import { inSeason, type Season } from './seasons';

/**
 * WINTER-01 (META_AMBIENCE): one quiet looping winter bed under the menu and play. It plays only while the flag is
 * on, a winter season is on for seasonNow() (QA date honoured) and the player's sound toggle is on, and only while
 * the app is in the foreground. Credits and edits: assets/audio/ambience/CREDITS.md.
 *
 * expo-audio is required lazily: installed Android builds exclude it from autolinking (package.json), where its
 * import throws; ambience then stays silent instead of breaking anything. Flag OFF = no player, no require.
 */
const WINTER: Season = { id: 'winter-ambience', name: 'Winter', start: '12-01', end: '02-29' };

// `file` is the native asset path (the ArrowsFeedback module packs assets/audio as Android assets); `source` is the
// Metro asset for the expo-audio fallback.
const VARIANTS = [
  // 0 = recommended: steady, non-melodic, never clashes with the pitched SFX.
  { label: 'Fireside', file: 'ambience/winter-fireside.m4a', source: require('../../assets/audio/ambience/winter-fireside.m4a') },
  { label: 'Music box', file: 'ambience/winter-musicbox.m4a', source: require('../../assets/audio/ambience/winter-musicbox.m4a') },
  { label: 'Wind & bells', file: 'ambience/winter-wind-bells.m4a', source: require('../../assets/audio/ambience/winter-wind-bells.m4a') },
] as const;

type Bed = Pick<AudioPlayer, 'play' | 'pause' | 'volume' | 'loop'> & { replace(source: unknown): void };

/** The native looping player in ArrowsFeedback (installed Android builds, where expo-audio is not linked). */
function nativeBed(): Bed | null {
  const m = ArrowsFeedback;
  if (!m?.ambiencePlay || !m.ambienceVolume || !m.ambiencePause) return null;
  let vol = 0;
  return {
    loop: true,
    get volume() {
      return vol;
    },
    set volume(v: number) {
      vol = v;
      m.ambienceVolume!(v);
    },
    play: () => m.ambiencePlay!(VARIANTS[variant].file),
    pause: () => m.ambiencePause!(),
    replace: () => m.ambiencePlay!(VARIANTS[variant].file),
  };
}

export const AMBIENCE_VOLUME = 0.35;
const FADE_IN_MS = 1500;
const FADE_OUT_MS = 600;
const STEP_MS = 50;

let player: Bed | null = null;
let broken = false;
let variant = 0;
let soundWanted = false;
let appActive = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
let appStateSub: NativeEventSubscription | null = null;
let fadeTimer: ReturnType<typeof setInterval> | null = null;
let playing = false;

function shouldPlay(): boolean {
  return META_AMBIENCE && soundWanted && appActive && inSeason(WINTER, seasonNow());
}

function getPlayer(): Bed | null {
  if (player || broken) return player;
  player = nativeBed();
  if (player) return player;
  try {
    const audio = require('expo-audio') as typeof import('expo-audio');
    // Mix with the player's own music; never take audio focus from it.
    audio.setAudioModeAsync({ interruptionMode: 'mixWithOthers' }).catch(() => {});
    player = audio.createAudioPlayer(VARIANTS[variant].source);
    player.loop = true;
    player.volume = 0;
  } catch {
    broken = true;
    player = null;
  }
  return player;
}

function stopFade(): void {
  if (fadeTimer) clearInterval(fadeTimer);
  fadeTimer = null;
}

/** Linear volume ramp to `target`; pauses at the end of a fade to 0. */
function fadeTo(p: Bed, target: number, ms: number): void {
  stopFade();
  const from = p.volume;
  const steps = Math.max(1, Math.round(ms / STEP_MS));
  let i = 0;
  fadeTimer = setInterval(() => {
    i += 1;
    try {
      p.volume = from + (target - from) * Math.min(1, i / steps);
      if (i >= steps) {
        stopFade();
        if (target === 0) p.pause();
      }
    } catch {
      stopFade();
    }
  }, STEP_MS);
}

function sync(): void {
  if (!META_AMBIENCE) return;
  try {
    const want = shouldPlay();
    if (want === playing) return;
    const p = getPlayer();
    if (!p) return;
    playing = want;
    if (want) {
      p.play();
      fadeTo(p, AMBIENCE_VOLUME, FADE_IN_MS);
    } else if (!appActive) {
      // Backgrounded: JS timers may not run, so pause now rather than fade.
      stopFade();
      p.volume = 0;
      p.pause();
    } else {
      fadeTo(p, 0, FADE_OUT_MS);
    }
  } catch {
    // Ambience is decorative; never let it reach gameplay.
  }
}

function onAppState(state: AppStateStatus): void {
  appActive = state === 'active';
  sync();
}

/** Follows the sound toggle (App's `soundOn` state, which mirrors SaveSystem.soundOn) and the app's foreground. */
export function syncAmbience(soundOn: boolean): void {
  if (!META_AMBIENCE) return;
  soundWanted = soundOn;
  if (!appStateSub) {
    try {
      appStateSub = AppState.addEventListener('change', onAppState);
    } catch {
      // No AppState events: ambience simply keeps the last foreground state.
    }
  }
  sync();
}

/** QA chip: display names of the candidate beds, in order; index 0 is the recommended default. */
export function ambienceVariants(): string[] {
  return VARIANTS.map((v) => v.label);
}

export function getAmbienceVariant(): number {
  return variant;
}

/** QA chip: swaps the bed live (keeps play state and volume). */
export function setAmbienceVariant(index: number): void {
  const next = ((Math.trunc(index) % VARIANTS.length) + VARIANTS.length) % VARIANTS.length;
  if (next === variant) return;
  variant = next;
  if (!player) return;
  try {
    player.replace(VARIANTS[variant].source);
    player.loop = true;
    if (playing) player.play();
  } catch {
    // Decorative.
  }
}

/** Mount once at the app root with `ready && soundOn`. */
export function useAmbience(soundOn: boolean): void {
  useEffect(() => {
    syncAmbience(soundOn);
  }, [soundOn]);
}

/** Tests only. */
export function resetAmbienceForTests(): void {
  stopFade();
  appStateSub?.remove();
  appStateSub = null;
  player = null;
  broken = false;
  variant = 0;
  soundWanted = false;
  playing = false;
  appActive = true;
}
