import type { TutorialId } from '../core';

export type FtueGraceOrAssist = 'none' | 'grace' | 'assist';

export type FtueSessionLogEvent =
  | { type: 'board_mount'; board: TutorialId | number }
  | { type: 'removal' }
  | {
    type: 'blocked';
    charged: boolean;
    graceOrAssist: FtueGraceOrAssist;
  }
  | { type: 'stall_hint' }
  | { type: 'clear'; heartsLeft: number }
  | { type: 'restart' };

/** Format one local first-time-player playtest event for console capture. */
export function formatFtueSessionLog(
  event: FtueSessionLogEvent,
  elapsedMs: number,
): string {
  const t = Math.max(0, Math.trunc(elapsedMs));

  switch (event.type) {
    case 'board_mount':
      return `[ftue] board_mount ${event.board} ${t}`;
    case 'removal':
      return `[ftue] removal ${t}`;
    case 'blocked':
      return `[ftue] blocked ${event.charged} ${event.graceOrAssist} ${t}`;
    case 'stall_hint':
      return `[ftue] stall_hint ${t}`;
    case 'clear':
      return `[ftue] clear ${event.heartsLeft} ${t}`;
    case 'restart':
      return `[ftue] restart ${t}`;
  }
}
