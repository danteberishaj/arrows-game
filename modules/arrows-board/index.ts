// Re-export the native module. On web, it will be resolved to ArrowsBoardModule.web.ts
// and on native platforms to ArrowsBoardModule.ts
export { default } from './src/ArrowsBoardModule';
export { default as ArrowsBoardView } from './src/ArrowsBoardView';
export * from './src/ArrowsBoard.types';
