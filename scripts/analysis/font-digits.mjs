#!/usr/bin/env node
/**
 * W5-03 instrument calibration for the `{remaining} left` counter: parses both
 * Fredoka weights the app ships and prints, per weight,
 *   - the GSUB and GPOS feature tags (is there a `tnum` to switch on?),
 *   - the hmtx advance of every digit U+0030..U+0039 (are the digits
 *     proportional, and which one is widest?),
 *   - every GPOS `kern` pair adjustment whose two glyphs are both digits (can
 *     a pair of digits be wider than the widest digit repeated?).
 *
 * The header counter's ghost width (`WIDEST_DIGIT` in src/ui/GameScreen.tsx)
 * cites this output. No dependency: a minimal sfnt / OpenType-layout reader.
 *
 * Run: node scripts/analysis/font-digits.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FONT_DIR = join(ROOT, 'node_modules', '@expo-google-fonts', 'fredoka');
const WEIGHTS = ['600SemiBold', '700Bold'];
const DIGITS = [...'0123456789'];

function tables(buf) {
  const numTables = buf.readUInt16BE(4);
  const out = new Map();
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    out.set(buf.toString('latin1', rec, rec + 4), {
      offset: buf.readUInt32BE(rec + 8),
      length: buf.readUInt32BE(rec + 12),
    });
  }
  return out;
}

/** Unicode code point -> glyph id, from the cmap's (3,1) / (0,3) format 4 subtable. */
function cmapLookup(buf, cmap) {
  const count = buf.readUInt16BE(cmap + 2);
  for (let i = 0; i < count; i++) {
    const rec = cmap + 4 + i * 8;
    const platform = buf.readUInt16BE(rec);
    const encoding = buf.readUInt16BE(rec + 2);
    const sub = cmap + buf.readUInt32BE(rec + 4);
    const unicodeBmp = (platform === 3 && encoding === 1) || (platform === 0 && encoding === 3);
    if (!unicodeBmp || buf.readUInt16BE(sub) !== 4) continue;
    const segX2 = buf.readUInt16BE(sub + 6);
    const ends = sub + 14;
    const starts = ends + segX2 + 2;
    const deltas = starts + segX2;
    const rangeOffsets = deltas + segX2;
    return (cp) => {
      for (let s = 0; s < segX2 / 2; s++) {
        const end = buf.readUInt16BE(ends + s * 2);
        if (cp > end) continue;
        const start = buf.readUInt16BE(starts + s * 2);
        if (cp < start) return 0;
        const delta = buf.readInt16BE(deltas + s * 2);
        const ro = buf.readUInt16BE(rangeOffsets + s * 2);
        if (ro === 0) return (cp + delta) & 0xffff;
        const g = buf.readUInt16BE(rangeOffsets + s * 2 + ro + (cp - start) * 2);
        return g === 0 ? 0 : (g + delta) & 0xffff;
      }
      return 0;
    };
  }
  throw new Error('no Unicode BMP format-4 cmap subtable');
}

function advance(buf, t, glyph) {
  const numberOfHMetrics = buf.readUInt16BE(t.get('hhea').offset + 34);
  const hmtx = t.get('hmtx').offset;
  const i = Math.min(glyph, numberOfHMetrics - 1);
  return buf.readUInt16BE(hmtx + i * 4);
}

/** Feature tags of a GSUB / GPOS table, sorted and de-duplicated (one entry per script/language system). */
function featureTags(buf, table) {
  const list = table + buf.readUInt16BE(table + 6);
  const count = buf.readUInt16BE(list);
  const tags = new Set();
  for (let i = 0; i < count; i++) tags.add(buf.toString('latin1', list + 2 + i * 6, list + 6 + i * 6));
  return [...tags].sort();
}

function lookupIndicesFor(buf, table, tag) {
  const list = table + buf.readUInt16BE(table + 6);
  const count = buf.readUInt16BE(list);
  const out = new Set();
  for (let i = 0; i < count; i++) {
    const rec = list + 2 + i * 6;
    if (buf.toString('latin1', rec, rec + 4) !== tag) continue;
    const feature = list + buf.readUInt16BE(rec + 4);
    const n = buf.readUInt16BE(feature + 2);
    for (let k = 0; k < n; k++) out.add(buf.readUInt16BE(feature + 4 + k * 2));
  }
  return [...out].sort((a, b) => a - b);
}

/** Coverage table -> Map(glyph -> coverage index). */
function coverage(buf, off) {
  const format = buf.readUInt16BE(off);
  const map = new Map();
  if (format === 1) {
    const n = buf.readUInt16BE(off + 2);
    for (let i = 0; i < n; i++) map.set(buf.readUInt16BE(off + 4 + i * 2), i);
  } else if (format === 2) {
    const n = buf.readUInt16BE(off + 2);
    for (let i = 0; i < n; i++) {
      const rec = off + 4 + i * 6;
      const start = buf.readUInt16BE(rec);
      const end = buf.readUInt16BE(rec + 2);
      const startIndex = buf.readUInt16BE(rec + 4);
      for (let g = start; g <= end; g++) map.set(g, startIndex + g - start);
    }
  } else throw new Error(`coverage format ${format}`);
  return map;
}

/** ClassDef table -> (glyph) => class (0 when absent). */
function classDef(buf, off) {
  const format = buf.readUInt16BE(off);
  const map = new Map();
  if (format === 1) {
    const start = buf.readUInt16BE(off + 2);
    const n = buf.readUInt16BE(off + 4);
    for (let i = 0; i < n; i++) map.set(start + i, buf.readUInt16BE(off + 6 + i * 2));
  } else if (format === 2) {
    const n = buf.readUInt16BE(off + 2);
    for (let i = 0; i < n; i++) {
      const rec = off + 4 + i * 6;
      const cls = buf.readUInt16BE(rec + 4);
      for (let g = buf.readUInt16BE(rec); g <= buf.readUInt16BE(rec + 2); g++) map.set(g, cls);
    }
  } else throw new Error(`classDef format ${format}`);
  return (g) => map.get(g) ?? 0;
}

const valueSize = (format) => {
  let bits = 0;
  for (let f = format; f; f >>= 1) bits += f & 1;
  return bits * 2;
};

/** The XAdvance field of a ValueRecord (0 when the format has none). */
function xAdvance(buf, rec, format) {
  if (!(format & 0x0004)) return 0;
  let at = rec;
  if (format & 0x0001) at += 2;
  if (format & 0x0002) at += 2;
  return buf.readInt16BE(at);
}

/** Every (first, second) digit pair that a PairPos subtable adjusts, with the first glyph's XAdvance change. */
function digitPairs(buf, sub, digitGlyphs, out) {
  const format = buf.readUInt16BE(sub);
  const cov = coverage(buf, sub + buf.readUInt16BE(sub + 2));
  const vf1 = buf.readUInt16BE(sub + 4);
  const vf2 = buf.readUInt16BE(sub + 6);
  if (format === 1) {
    const setOffsets = sub + 10;
    for (const first of digitGlyphs) {
      const ci = cov.get(first);
      if (ci === undefined) continue;
      const set = sub + buf.readUInt16BE(setOffsets + ci * 2);
      const n = buf.readUInt16BE(set);
      const recLen = 2 + valueSize(vf1) + valueSize(vf2);
      for (let i = 0; i < n; i++) {
        const rec = set + 2 + i * recLen;
        const second = buf.readUInt16BE(rec);
        if (!digitGlyphs.includes(second)) continue;
        const dx = xAdvance(buf, rec + 2, vf1);
        if (dx !== 0) out.push({ first, second, dx });
      }
    }
  } else if (format === 2) {
    const cls1 = classDef(buf, sub + buf.readUInt16BE(sub + 8));
    const cls2 = classDef(buf, sub + buf.readUInt16BE(sub + 10));
    const class2Count = buf.readUInt16BE(sub + 14);
    const recLen = valueSize(vf1) + valueSize(vf2);
    for (const first of digitGlyphs) {
      if (!cov.has(first)) continue;
      for (const second of digitGlyphs) {
        const rec = sub + 16 + (cls1(first) * class2Count + cls2(second)) * recLen;
        const dx = xAdvance(buf, rec, vf1);
        if (dx !== 0) out.push({ first, second, dx });
      }
    }
  } else throw new Error(`PairPos format ${format}`);
}

function kernDigitPairs(buf, gpos, digitGlyphs) {
  const lookupList = gpos + buf.readUInt16BE(gpos + 8);
  const out = [];
  for (const index of lookupIndicesFor(buf, gpos, 'kern')) {
    const lookup = lookupList + buf.readUInt16BE(lookupList + 2 + index * 2);
    const type = buf.readUInt16BE(lookup);
    const n = buf.readUInt16BE(lookup + 4);
    for (let s = 0; s < n; s++) {
      let sub = lookup + buf.readUInt16BE(lookup + 6 + s * 2);
      let subType = type;
      if (type === 9) { // Extension: the real subtable sits at a 32-bit offset
        subType = buf.readUInt16BE(sub + 2);
        sub += buf.readUInt32BE(sub + 4);
      }
      if (subType === 2) digitPairs(buf, sub, digitGlyphs, out);
    }
  }
  return out;
}

for (const weight of WEIGHTS) {
  const file = join(FONT_DIR, weight, `Fredoka_${weight}.ttf`);
  const buf = readFileSync(file);
  const t = tables(buf);
  const glyphOf = cmapLookup(buf, t.get('cmap').offset);
  const unitsPerEm = buf.readUInt16BE(t.get('head').offset + 18);
  const gsub = featureTags(buf, t.get('GSUB').offset);
  const gpos = featureTags(buf, t.get('GPOS').offset);
  const glyphs = DIGITS.map((d) => glyphOf(d.codePointAt(0)));
  const advances = glyphs.map((g) => advance(buf, t, g));
  const widest = Math.max(...advances);
  const pairs = kernDigitPairs(buf, t.get('GPOS').offset, glyphs);
  const digitOf = (g) => DIGITS[glyphs.indexOf(g)];

  console.log(`Fredoka ${weight} (${relative(ROOT, file)})`);
  console.log(`  unitsPerEm ${unitsPerEm}`);
  console.log(`  GSUB features: ${gsub.join(', ')}`);
  console.log(`  GPOS features: ${gpos.join(', ')}`);
  console.log(`  tnum: ${gsub.includes('tnum') || gpos.includes('tnum') ? 'present' : 'absent'}`);
  console.log(`  digit advances: ${DIGITS.map((d, i) => `${d}=${advances[i]}`).join(' ')}`);
  console.log(`  widest digit: ${DIGITS.filter((_, i) => advances[i] === widest).join(', ')} (${widest} units)`);
  console.log(`  GPOS kern digit-digit pairs: ${pairs.length === 0 ? 'none'
    : pairs.map((p) => `${digitOf(p.first)}${digitOf(p.second)} ${p.dx > 0 ? '+' : ''}${p.dx}`).join(', ')}`);
}
