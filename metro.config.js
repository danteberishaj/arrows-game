// Expo's default Metro config plus one web-only resolver rule: the LevelPlay
// SDK is native-only (it imports react-native internals) and ads.tsx already
// skips it on web, but Metro still resolves the guarded `require` statically.
// Aliasing it to an empty module keeps `expo start --web` bundling.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const defaultResolveRequest = config.resolver.resolveRequest;
const EMPTY_MODULE = path.resolve(__dirname, 'scripts/emptyModule.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'unity-levelplay-mediation') {
    return { type: 'sourceFile', filePath: EMPTY_MODULE };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
