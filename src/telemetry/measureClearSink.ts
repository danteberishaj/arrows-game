/**
 * W4-04: a dev-only console line for measuring time-to-clear.
 *
 * The original brief asked for a standalone tap/timer instrument in
 * `src/perfMode.ts` and `src/ui/GameScreen.tsx`. The controller amendments to
 * `task-W4-04-brief.md` (rulings F09/F10, binding) replace that: W6-06 already
 * emits a `level_end` event per board (`src/telemetry/levelAggregator.ts`)
 * with `taps`, `durationMs` and `heartsLost` already summed, so this task
 * becomes a `__DEV__` console sink that reads that existing event instead of
 * building a second counter set. Ruling F10 forbids a top-level `__DEV__`
 * read in a module that node-jest suites import (it would throw
 * `ReferenceError` under `ts-jest`'s node environment); this module never
 * reads `__DEV__` at all, so it is safe to import from `core`-project tests.
 * The `__DEV__` gate stays where it already lived before this task — the
 * `else if (__DEV__)` branch in `App.tsx` that installs the development
 * console sink.
 *
 * `level_end` does not carry `shapeName`/`arrowCount` (those are
 * `level_start`-only fields — see `src/telemetry/events.ts`), so this sink
 * remembers the most recent `level_start` per `levelIndex` and joins it onto
 * the matching `level_end`. `levelIndex` doubles as the daily day number when
 * `mode === 'daily'`: `LevelAggregator.start()` takes whatever number the
 * caller names the board with, and nothing else in the schema carries "which
 * day" (this is the literal meaning of ruling F09's "mode `daily` carries the
 * day in `levelIndex`").
 */
import type { EnvelopedEvent } from './events';
import type { TelemetrySink } from './telemetry';

/** Compiled in only when the env var is exactly `'1'` (Expo inlines
 * `EXPO_PUBLIC_*` at build time; unset resolves to `''`). */
export const MEASURE_CLEAR = process.env.EXPO_PUBLIC_MEASURE_CLEAR === '1';

interface StartInfo {
  readonly shapeName: string;
  readonly arrowCount: number;
}

/**
 * Wraps `sink` so every event still reaches it unchanged, and — only when
 * `MEASURE_CLEAR` is on — a cleared campaign or daily `level_end` also prints
 * one `[measure-clear]` line. Tutorial boards are excluded: they are scripted
 * FTUE content already logged by W1-08's own `[ftue]` line (ruling F09), and
 * the brief's own format names only `<campaign|daily>`.
 *
 * The fields are W6's, not the brief's original counters: `taps` is
 * `level_end.taps` (exit + blocked + ghost + miss), so on a clear
 * `taps - arrows` counts every non-removal tap, charged or free; `ms` is
 * `level_end.durationMs`, measured from `level_start` (board load, not the
 * first tap) and, after an earned continue, including the lose panel and ad.
 *
 * The `if (!MEASURE_CLEAR) return sink;` guard mirrors the proven
 * `PERF_TELEMETRY_TIMING` pattern in `src/ui/BoardView.tsx`: `MEASURE_CLEAR`
 * folds to a literal `false` in a build without the env var, so everything
 * below — the closure, the `Map`, and the `[measure-clear]` string itself —
 * is unreachable and dead-code-eliminated. W6-06 proved this exact shape
 * strips `[telemetry-tap]`/`[telemetry-perf]` from an exported bundle; see
 * `docs/next-level/reports/W6-06.md`.
 */
export function withMeasureClearLog(
  sink: TelemetrySink,
  log: (line: string) => void = console.log,
): TelemetrySink {
  if (!MEASURE_CLEAR) return sink;

  const starts = new Map<number, StartInfo>();

  return (event: EnvelopedEvent) => {
    sink(event);

    if (event.name === 'level_start') {
      const e = event as EnvelopedEvent<'level_start'>;
      starts.set(e.levelIndex, { shapeName: e.shapeName, arrowCount: e.arrowCount });
      return;
    }

    if (event.name !== 'level_end') return;
    const e = event as EnvelopedEvent<'level_end'>;
    if (e.outcome !== 'cleared' || e.mode === 'tutorial') return;

    const info = starts.get(e.levelIndex);
    log(
      `[measure-clear] mode=${e.mode} id=${e.levelIndex} ` +
        `shape=${info?.shapeName ?? 'unknown'} arrows=${info?.arrowCount ?? 0} ` +
        `taps=${e.taps} ms=${e.durationMs} heartsLost=${e.heartsLost}`,
    );
  };
}
