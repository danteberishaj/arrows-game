/**
 * MENU-TWINKLE: bulb centres in the painted winter layers, as fractions of each image's width / height.
 * Measured 2026-11-19 from assets/images/winter/painted-*-night.webp (bright, saturated blobs of 150-900 px² at
 * 1440 px wide; bows above y 0.2 and baubles below y 0.8 left out). The day images share the geometry (same
 * centres within 0.005). Re-measure if codex-post.py re-crops the art.
 */
export interface Bulb { x: number; y: number; color: string }

export const GARLAND_BULBS: readonly Bulb[] = [
  { x: 0.023, y: 0.31, color: '#9af26d' }, { x: 0.101, y: 0.52, color: '#f4693c' }, { x: 0.156, y: 0.58, color: '#f6d53a' },
  { x: 0.218, y: 0.54, color: '#45a2f4' }, { x: 0.246, y: 0.46, color: '#f6d73f' }, { x: 0.397, y: 0.47, color: '#98f16a' },
  { x: 0.483, y: 0.59, color: '#f66b3e' }, { x: 0.532, y: 0.59, color: '#f7d63a' }, { x: 0.578, y: 0.54, color: '#44a0f4' },
  { x: 0.607, y: 0.45, color: '#f7da3d' }, { x: 0.756, y: 0.47, color: '#98f16a' }, { x: 0.841, y: 0.59, color: '#f4693c' },
  { x: 0.894, y: 0.54, color: '#f6d53a' }, { x: 0.947, y: 0.44, color: '#45a2f4' }, { x: 0.978, y: 0.33, color: '#9af26d' },
];

/** The warm lights on the left tree of the painted hills. */
export const TREE_BULBS: readonly Bulb[] = [
  { x: 0.0946, y: 0.186, color: '#f7dd48' }, { x: 0.1024, y: 0.256, color: '#f8d834' }, { x: 0.1246, y: 0.180, color: '#f8dc41' },
  { x: 0.1398, y: 0.279, color: '#f7d83f' }, { x: 0.1538, y: 0.161, color: '#f7d43b' }, { x: 0.1768, y: 0.291, color: '#f7d93e' },
  { x: 0.2007, y: 0.278, color: '#f7df40' },
];
