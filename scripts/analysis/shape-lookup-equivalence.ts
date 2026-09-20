/**
 * Compares the cheap shape-name lookup with full v1 level generation.
 *
 * Run: npx tsx scripts/analysis/shape-lookup-equivalence.ts <first-index> <last-index>
 */
import { LevelGenerator, shapeNameForLevel } from '../../src/core';

function parseIndex(raw: string | undefined, label: string): number {
  if (raw === undefined || !/^\d+$/.test(raw)) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return Number(raw);
}

const firstIndex = parseIndex(process.argv[2], 'first-index');
const lastIndex = parseIndex(process.argv[3], 'last-index');
if (process.argv.length !== 4) {
  throw new Error('usage: shape-lookup-equivalence.ts <first-index> <last-index>');
}
if (lastIndex < firstIndex) {
  throw new Error('last-index must be greater than or equal to first-index');
}

const levelCount = lastIndex - firstIndex + 1;
const lookupNames = new Array<string>(levelCount);

const lookupStartedAt = performance.now();
for (let offset = 0; offset < levelCount; offset++) {
  lookupNames[offset] = shapeNameForLevel(firstIndex + offset);
}
const lookupDurationMs = performance.now() - lookupStartedAt;

let mismatchCount = 0;
const generationStartedAt = performance.now();
for (let offset = 0; offset < levelCount; offset++) {
  const generatedName = LevelGenerator.generate(firstIndex + offset).shapeName;
  if (generatedName !== lookupNames[offset]) mismatchCount++;
}
const generationDurationMs = performance.now() - generationStartedAt;

console.log(`range: ${firstIndex}..${lastIndex} (${levelCount} levels)`);
console.log(`mismatches: ${mismatchCount}`);
console.log(`lookup: ${lookupDurationMs.toFixed(2)} ms`);
console.log(`full generation: ${generationDurationMs.toFixed(2)} ms`);
