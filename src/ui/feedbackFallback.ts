import type { FeedbackEvent } from '../../modules/arrows-feedback';
import { Sfx } from './audio';
import { Haptic } from './haptics';

/** Existing Expo feedback path for iOS, web, and Android Expo Go. */
export function feedback(event: FeedbackEvent, soundOn: boolean): void {
  if (soundOn) {
    if (event === 'exit') Sfx.playSuccess();
    else if (event === 'blocked') Sfx.playFail();
    else if (event === 'cleared') Sfx.playWin();
    else Sfx.playStar();
  }

  if (event === 'exit') Haptic.exit();
  else if (event === 'blocked') Haptic.blocked();
  else if (event === 'cleared') Haptic.cleared();
}
