const NOT_STARTED_STAGE = 0; // OWNER-PICKED STARTING VALUE
export const T1_CLEARED_STAGE = 1; // OWNER-PICKED STARTING VALUE
export const ASSIST_STAGE = 2; // OWNER-PICKED STARTING VALUE
export const DONE_STAGE = 3; // OWNER-PICKED STARTING VALUE
const NO_PROGRESS = 0; // OWNER-PICKED STARTING VALUE

export type FtueRoute = 'T1' | 'T2' | 'real';

interface FtueRouteInput {
  enabled: boolean;
  perfMode: boolean;
  stage: number;
  currentLevel: number;
  totalSolved: number;
}

interface AssistActiveInput {
  enabled: boolean;
  assistEnabled: boolean;
  stage: number;
}

export function ftueRoute({
  enabled,
  perfMode,
  stage,
  currentLevel,
  totalSolved,
}: FtueRouteInput): FtueRoute {
  if (!enabled || perfMode) return 'real';
  if (!Number.isInteger(stage) || stage < NOT_STARTED_STAGE || stage > DONE_STAGE) {
    return 'real';
  }
  if (stage >= ASSIST_STAGE) return 'real';
  if (currentLevel > NO_PROGRESS || totalSolved > NO_PROGRESS) return 'real';
  if (stage === T1_CLEARED_STAGE) return 'T2';
  return 'T1';
}

export function assistActive({ enabled, assistEnabled, stage }: AssistActiveInput): boolean {
  return enabled && assistEnabled && stage === ASSIST_STAGE;
}

export type TutorialClearNext = 'T2' | 'campaign' | 'menu';

/**
 * What a cleared tutorial board does next. First run (W1): T1 stores T1_CLEARED_STAGE and loads T2; T2 stores
 * ASSIST_STAGE and deals the campaign level. TF-01 C replay ("How to play"): no stage is written (a finished player
 * at DONE_STAGE must never move back to ASSIST_STAGE), T1 still hands off to T2, and T2 returns to the menu.
 */
export function tutorialClearStep(
  tutorialId: 'T1' | 'T2',
  replay: boolean,
): { stage: number | null; next: TutorialClearNext } {
  if (replay) return { stage: null, next: tutorialId === 'T1' ? 'T2' : 'menu' };
  return tutorialId === 'T1'
    ? { stage: T1_CLEARED_STAGE, next: 'T2' }
    : { stage: ASSIST_STAGE, next: 'campaign' };
}
