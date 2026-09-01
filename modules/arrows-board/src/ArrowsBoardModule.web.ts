import { registerWebModule, NativeModule } from 'expo';

// ArrowsBoardModule is not available on the web platform.
class ArrowsBoardModule extends NativeModule<{}> {}

export default registerWebModule(ArrowsBoardModule, 'ArrowsBoardModule');
