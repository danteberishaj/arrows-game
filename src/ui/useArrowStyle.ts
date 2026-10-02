import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { META_SKIN_PICKER } from '../featureFlags';
import { getArrowStyle, subscribeArrowStyle } from './arrowStyleSelection';
import { CLASSIC_STYLE } from './skinSpecs';

export function skinPickerEnabled(): boolean { return META_SKIN_PICKER && Platform.OS === 'android'; }
const noSubscription = () => () => {};
const classicSnapshot = () => CLASSIC_STYLE;
export function useArrowStyle() {
  const enabled = skinPickerEnabled();
  return useSyncExternalStore(enabled ? subscribeArrowStyle : noSubscription, enabled ? getArrowStyle : classicSnapshot, classicSnapshot);
}
