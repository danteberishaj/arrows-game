import { requireNativeView } from 'expo';
import * as React from 'react';

import { ArrowsBoardViewProps } from './ArrowsBoard.types';

const NativeView: React.ComponentType<ArrowsBoardViewProps> =
  requireNativeView('ArrowsBoard');

function ArrowsBoardView(props: ArrowsBoardViewProps) {
  return <NativeView {...props} />;
}

export default React.memo(ArrowsBoardView);
