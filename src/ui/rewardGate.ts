import { META_REWARD_BOOK, META_REWARD_PATH } from '../featureFlags';
import { skinPickerEnabled } from './useArrowStyle';

/** The reward path runs only where the picker does (Android + picker flag) and its own flag is on. */
export function rewardPathEnabled(): boolean { return META_REWARD_PATH && skinPickerEnabled(); }
export function rewardBookEnabled(): boolean { return META_REWARD_BOOK && rewardPathEnabled(); }
