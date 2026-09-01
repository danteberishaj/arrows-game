import type { SlitherPath } from './arrowGeometry';

/** One slither exit handed to the retained native board view. */
export interface NativeExitAnimation {
  id: number;
  /** Index into the board's initial arrow order; the native view owns the head path. */
  arrowIndex: number;
  durationMs: number;
  reducedMotion: boolean;
  /** Same centerline + off-board ray the web/Skia slither uses. */
  path: SlitherPath;
  /** Bead tube diameter in board points. */
  trailStrokeWidth: number;
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Compact event string parsed by ArrowsBoardView.kt / .swift:
 * `id,index,durationMs,reducedMotion,trailStrokeWidth,bodyLen,totalLen,dirX,dirY,n,x0,y0,...,x(n-1),y(n-1)`.
 * The trail polyline is sent explicitly so native never has to know the cell
 * size or re-derive the exit ray; everything stays in board point space.
 */
export function serializeNativeExitAnimation(event: NativeExitAnimation): string {
  const { path } = event;
  const values: number[] = [
    event.id,
    event.arrowIndex,
    event.durationMs,
    event.reducedMotion ? 1 : 0,
    round(event.trailStrokeWidth),
    round(path.bodyLen),
    round(path.totalLen),
    path.dir.x,
    path.dir.y,
    path.points.length,
  ];
  for (const point of path.points) values.push(round(point.x), round(point.y));
  return values.join(',');
}
