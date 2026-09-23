import { Platform } from 'react-native';
import { META_BOARD_GRID } from '../featureFlags';

/**
 * POLISH-T4 (ruling R7): the board grid and its "#" toggle ship on Android and
 * web this round. The iOS grid waits for docs/IOS_BOARD_PLAN.md (a sublayer
 * would draw over the arrows), so iOS gets neither the grid props nor the
 * button: a switch that does nothing is worse than no switch.
 */
export const BOARD_GRID_ENABLED = META_BOARD_GRID && Platform.OS !== 'ios';
