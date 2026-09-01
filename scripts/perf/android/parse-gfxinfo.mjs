const NANOS_PER_MILLISECOND = 1_000_000;

/**
 * Parses the `PROFILEDATA` CSV emitted by `dumpsys gfxinfo ... framestats`.
 * Only complete, non-dropped frames are retained. Multiple profile sections
 * can describe the same frame, so timestamps are de-duplicated.
 */
export function parseGfxInfoFrames(text) {
  const lines = text.split(/\r?\n/);
  const frames = [];
  const seen = new Set();
  let columns = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('Flags,')) {
      columns = line.split(',');
      continue;
    }
    if (!columns || line === '---PROFILEDATA---' || line === '') continue;

    const values = line.split(',');
    if (values.length < columns.length) continue;
    const row = Object.fromEntries(columns.map((name, index) => [name, Number(values[index])]));
    if (row.Flags !== 0 || row.IntendedVsync <= 0 || row.FrameCompleted <= 0) continue;

    const durationNs = row.FrameCompleted - row.IntendedVsync;
    if (!Number.isFinite(durationNs) || durationNs <= 0) continue;

    const key = `${row.IntendedVsync}:${row.FrameCompleted}`;
    if (seen.has(key)) continue;
    seen.add(key);

    frames.push({
      durationMs: durationNs / NANOS_PER_MILLISECOND,
      missedDeadline:
        Number.isFinite(row.FrameDeadline) && row.FrameDeadline > 0
          ? row.FrameCompleted > row.FrameDeadline
          : null,
    });
  }

  return frames;
}

export function summarizeFrames(frames, refreshRateHz = 60) {
  if (frames.length === 0) throw new Error('gfxinfo contained no complete frames');
  const durations = frames.map((frame) => frame.durationMs).sort((a, b) => a - b);
  const thresholdMs = 1000 / refreshRateHz;
  const janky = frames.filter((frame) =>
    frame.missedDeadline === null
      ? frame.durationMs > thresholdMs
      : frame.missedDeadline,
  ).length;

  return {
    frameCount: frames.length,
    uiFrameP50Ms: percentile(durations, 0.5),
    uiFrameP95Ms: percentile(durations, 0.95),
    uiFrameP99Ms: percentile(durations, 0.99),
    uiFrameMaxMs: durations[durations.length - 1],
    jankyFramePercent: (janky / frames.length) * 100,
  };
}

export function parseTotalPssKb(text) {
  const labelled = text.match(/\bTOTAL PSS:\s*(\d+)/);
  if (labelled) return Number(labelled[1]);

  for (const line of text.split(/\r?\n/)) {
    const row = line.match(/^\s*TOTAL\s+(\d+)\b/);
    if (row) return Number(row[1]);
  }
  throw new Error('meminfo contained no total PSS value');
}

const PSS_SUMMARY_LABELS = new Map([
  ['Java Heap', 'javaHeapPssKb'],
  ['Native Heap', 'nativeHeapPssKb'],
  ['Code', 'codePssKb'],
  ['Stack', 'stackPssKb'],
  ['Graphics', 'graphicsPssKb'],
  ['Private Other', 'privateOtherPssKb'],
  ['System', 'systemPssKb'],
]);

/** Parses the stable `App Summary` PSS categories from `dumpsys meminfo`. */
export function parsePssCategoriesKb(text) {
  const categories = {};
  for (const line of text.split(/\r?\n/)) {
    const row = line.match(/^\s*([^:]+):\s+(\d+)\b/);
    if (!row) continue;
    const key = PSS_SUMMARY_LABELS.get(row[1].trim());
    if (key) categories[key] = Number(row[2]);
  }
  const missing = [...PSS_SUMMARY_LABELS.values()].filter((key) => categories[key] === undefined);
  if (missing.length > 0) {
    throw new Error(`meminfo App Summary omitted: ${missing.join(', ')}`);
  }
  const totalRss = text.match(/\bTOTAL RSS:\s*(\d+)/);
  const nativeHeap = text.match(
    /^\s*Native Heap\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/m,
  );
  if (!totalRss || !nativeHeap) {
    throw new Error('meminfo omitted total RSS or the Native Heap table row');
  }
  return {
    totalPssKb: parseTotalPssKb(text),
    totalRssKb: Number(totalRss[1]),
    ...categories,
    nativeHeapTablePssKb: Number(nativeHeap[1]),
    nativeHeapTableRssKb: Number(nativeHeap[5]),
    nativeHeapSizeKb: Number(nativeHeap[6]),
    nativeHeapAllocKb: Number(nativeHeap[7]),
    nativeHeapFreeKb: Number(nativeHeap[8]),
  };
}

export function summarizePss(values) {
  if (values.length === 0) throw new Error('Cannot summarize an empty PSS sample');
  const sorted = [...values].sort((a, b) => a - b);
  return {
    pssKb: percentile(sorted, 0.5),
    pssP95Kb: percentile(sorted, 0.95),
    pssPeakKb: sorted[sorted.length - 1],
  };
}

function percentile(sorted, fraction) {
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}
