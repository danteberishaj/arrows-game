import { useSyncExternalStore } from 'react';
import { rewardPathEnabled } from './rewardGate';
import { getRewardState, subscribeRewards, type RewardState } from './rewardLedger';

const none = () => () => {};
const nullSnapshot = () => null;
export function useRewards(): RewardState | null {
  const enabled = rewardPathEnabled();
  return useSyncExternalStore(enabled ? subscribeRewards : none, enabled ? getRewardState : nullSnapshot, nullSnapshot);
}
