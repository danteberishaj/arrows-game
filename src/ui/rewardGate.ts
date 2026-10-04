import { META_PETAL_ADS, META_REWARD_BOOK, META_REWARD_PATH, META_SEASONS } from '../featureFlags';
import { skinPickerEnabled } from './useArrowStyle';

/** The reward path runs only where the picker does (Android + picker flag) and its own flag is on. */
export function rewardPathEnabled(): boolean { return META_REWARD_PATH && skinPickerEnabled(); }
export function rewardBookEnabled(): boolean { return META_REWARD_BOOK && rewardPathEnabled(); }
/** Seasonal styles are book-only: they need the book (and so the path and picker). */
export function seasonsEnabled(): boolean { return META_SEASONS && rewardBookEnabled(); }
/** PETAL-ADS-01: rewarded ads for petals live in the book, so they need it (and so the path and picker). */
export function petalAdsEnabled(): boolean { return META_PETAL_ADS && rewardBookEnabled(); }
