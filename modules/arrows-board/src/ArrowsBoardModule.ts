import { NativeModule, requireNativeModule } from 'expo';

declare class ArrowsBoardModule extends NativeModule<{}> {}

export default requireNativeModule<ArrowsBoardModule>('ArrowsBoard');
