import React from 'react';
import Svg, { Path } from 'react-native-svg';

/** Decorative Halloween season mark (never an emoji): a small ribbed pumpkin with a green stem. */
export function PumpkinIcon({ size = 14 }: { size?: number }) {
  return <Svg testID="pumpkin-icon" accessible={false} width={size} height={size} viewBox="0 0 20 20">
    <Path d="M10 6.5C6.2 4.6 1.8 6.8 1.8 11.6S6 18.5 10 17.2C14 18.5 18.2 16.4 18.2 11.6S13.8 4.6 10 6.5Z" fill="#FF8A2A" stroke="#9A633F" strokeWidth={1.2} />
    <Path d="M10 6.8C8 9 8 15 10 17M10 6.8C12 9 12 15 10 17" fill="none" stroke="#E0661B" strokeWidth={1.1} />
    <Path d="M9.2 6.8C9.2 4.8 10 3.4 11.6 2.6" fill="none" stroke="#6BAA4F" strokeWidth={1.8} strokeLinecap="round" />
  </Svg>;
}
