import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseGfxInfoFrames,
  parsePssCategoriesKb,
  parseTotalPssKb,
  summarizeFrames,
  summarizePss,
} from './parse-gfxinfo.mjs';

test('parses complete frames, drops flagged rows, and de-duplicates sections', () => {
  const header = 'Flags,IntendedVsync,Vsync,FrameDeadline,FrameStartTime,FrameCompleted';
  const text = [
    '---PROFILEDATA---',
    header,
    '0,1000000,1000000,17000000,1000000,9000000',
    '1,2000000,2000000,18000000,2000000,30000000',
    '0,3000000,3000000,19000000,3000000,23000000',
    '---PROFILEDATA---',
    header,
    '0,1000000,1000000,17000000,1000000,9000000',
  ].join('\n');

  const frames = parseGfxInfoFrames(text);
  assert.deepEqual(frames, [
    { durationMs: 8, missedDeadline: false },
    { durationMs: 20, missedDeadline: true },
  ]);
  assert.deepEqual(summarizeFrames(frames, 60), {
    frameCount: 2,
    uiFrameP50Ms: 8,
    uiFrameP95Ms: 20,
    uiFrameP99Ms: 20,
    uiFrameMaxMs: 20,
    jankyFramePercent: 50,
  });
});

test('parses and summarizes total PSS', () => {
  assert.equal(parseTotalPssKb(' TOTAL PSS: 123456 TOTAL RSS: 222222'), 123456);
  assert.equal(parseTotalPssKb('  TOTAL   65432  12  34'), 65432);
  assert.deepEqual(summarizePss([100, 300, 200]), {
    pssKb: 200,
    pssP95Kb: 300,
    pssPeakKb: 300,
  });
});

test('parses every App Summary PSS category without confusing RSS columns', () => {
  const text = [
    '                   Pss  Private  Private     Swap      Rss     Heap     Heap     Heap',
    '                 Total    Dirty    Clean    Dirty    Total     Size    Alloc     Free',
    '  Native Heap   174852   174772        0        0   177620   176000   170000     6000',
    ' App Summary',
    '                       Pss(KB)                        Rss(KB)',
    '           Java Heap:     7300                          34608',
    '         Native Heap:   174772                         177620',
    '                Code:    78372                         156060',
    '               Stack:      788                            804',
    '            Graphics:       42                             84',
    '       Private Other:    22056',
    '              System:     9149',
    '           TOTAL PSS:   292479            TOTAL RSS:   395548',
  ].join('\n');

  assert.deepEqual(parsePssCategoriesKb(text), {
    totalPssKb: 292479,
    totalRssKb: 395548,
    javaHeapPssKb: 7300,
    nativeHeapPssKb: 174772,
    codePssKb: 78372,
    stackPssKb: 788,
    graphicsPssKb: 42,
    privateOtherPssKb: 22056,
    systemPssKb: 9149,
    nativeHeapTablePssKb: 174852,
    nativeHeapTableRssKb: 177620,
    nativeHeapSizeKb: 176000,
    nativeHeapAllocKb: 170000,
    nativeHeapFreeKb: 6000,
  });
});

test('rejects incomplete App Summary data instead of reporting misleading categories', () => {
  assert.throws(
    () => parsePssCategoriesKb('Java Heap: 1\nTOTAL PSS: 1'),
    /meminfo App Summary omitted/,
  );
});
