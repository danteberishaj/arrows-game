import { DAILY_VERSIONS } from '../core/dailyBoard';
import { GEN_V2_ENABLED } from '../core/generatorVersion';
import { SHAPE_CATALOGUE, V2_ADMITTED_SHAPE_IDS } from '../core/shapeCatalogue';
import { ShapeLibrary } from '../core/shapeLibrary';

/**
 * W3-18: the catalogue ids the shape gallery lists, as a pure function of this build: the ids a
 * player can currently be dealt. That is an id held by
 * - one of v1's tier pools (v1 deals every level below an install's switch level, and every level
 *   while `GEN_V2_ENABLED` is off), or
 * - any daily pool version (`DAILY_VERSIONS`: past days never change and a scheduled pool is a
 *   commitment to deal it), or
 * - generator v2's admission list (`V2_ADMITTED_SHAPE_IDS`), only when v2 is enabled.
 *
 * A shape appended to `SHAPE_CATALOGUE` but awaiting the owner's recognition test (W3-19) is in
 * none of them, so the gallery shows no never-obtainable outline for it. Its collection bit stays
 * reserved (60-bit keys) and folds as usual once a generator deals it. `galleryWall` still shows
 * any id the player has collected (the W4-09 retired rule, extended).
 */
export function galleryShapeIds(genV2Enabled: boolean = GEN_V2_ENABLED): ReadonlySet<string> {
  const cached = cache.get(genV2Enabled);
  if (cached !== undefined) return cached;
  const dealt = new Set<string>();
  for (const pool of [ShapeLibrary.SimplePool, ShapeLibrary.MediumPool, ShapeLibrary.ComplexPool]) {
    for (const shape of pool) dealt.add(shape.name);
  }
  for (const version of DAILY_VERSIONS) for (const id of version.pool) dealt.add(id);
  if (genV2Enabled) for (const id of V2_ADMITTED_SHAPE_IDS) dealt.add(id);
  const ids = new Set(SHAPE_CATALOGUE.filter((id) => dealt.has(id)));
  cache.set(genV2Enabled, ids);
  return ids;
}

const cache = new Map<boolean, ReadonlySet<string>>();
