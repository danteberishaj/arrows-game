import React from 'react';
import Svg, { Circle, G } from 'react-native-svg';

/** Decorative petal mark (never an emoji): four petals and a sunny centre. */
export function PetalIcon({ size = 14 }: { size?: number }) {
  return <Svg testID="petal-icon" accessible={false} width={size} height={size} viewBox="0 0 20 20">
    <G fill="#F5A3C7"><Circle cx={10} cy={5} r={4} /><Circle cx={15} cy={10} r={4} /><Circle cx={10} cy={15} r={4} /><Circle cx={5} cy={10} r={4} /></G>
    <Circle cx={10} cy={10} r={3} fill="#FFD36E" />
  </Svg>;
}
