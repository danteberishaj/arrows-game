const NOT_STARTED_STAGE = 0; // OWNER-PICKED STARTING VALUE
const T1_CLEARED_STAGE = 1; // OWNER-PICKED STARTING VALUE
const ASSIST_STAGE = 2; // OWNER-PICKED STARTING VALUE
const DONE_STAGE = 3; // OWNER-PICKED STARTING VALUE
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
