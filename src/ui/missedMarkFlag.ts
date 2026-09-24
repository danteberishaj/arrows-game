import { Platform } from 'react-native';
import { META_MISSED_MARK } from '../featureFlags';

/**
 * POLISH-T5 (rulings R6/R7): the missed mark ships on Android and web this
 * round. The iOS board view has no mark mask, so iOS keeps today's look
 * entirely (the blocked bump settles to ink there): a bump that settled to
 * the mark and then popped back to ink would be a flicker.
 */
export const MISSED_MARK_ENABLED = META_MISSED_MARK && Platform.OS !== 'ios';
