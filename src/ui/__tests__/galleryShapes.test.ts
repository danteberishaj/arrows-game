/**
 * W3-18: the gallery lists only the catalogue ids a player can currently be dealt. A shape
 * authored and appended to the catalogue (its collection bit reserved) but awaiting the owner's
 * recognition test (W3-19) is dealt by no generator and no daily, so a tile for it would be an
 * outline the player can never fill.
 */
import { EMPTY_SHAPE_MASKS, markSeen } from '../../core/collection';
import { DAILY_VERSIONS } from '../../core/dailyBoard';
import { GEN_V2_ENABLED } from '../../core/generatorVersion';
import { SHAPE_CATALOGUE, V2_ADMITTED_SHAPE_IDS } from '../../core/shapeCatalogue';
import { ShapeLibrary } from '../../core/shapeLibrary';
import { galleryWall } from '../galleryLayout';
import { galleryShapeIds } from '../galleryShapes';

const V1_POOLS = new Set(
  [...ShapeLibrary.SimplePool, ...ShapeLibrary.MediumPool, ...ShapeLibrary.ComplexPool].map((s) => s.name),
);
const DAILY = new Set(DAILY_VERSIONS.flatMap((v) => v.pool));

test('the rule: an id is listed when a v1 tier pool, a daily pool version, or (v2 on) v2 admission holds it', () => {
  for (const v2 of [false, true]) {
    const expected = SHAPE_CATALOGUE.filter(
      (id) => V1_POOLS.has(id) || DAILY.has(id) || (v2 && V2_ADMITTED_SHAPE_IDS.has(id)),
    );
    expect([v2, [...galleryShapeIds(v2)].sort()]).toEqual([v2, [...expected].sort()]);
  }
  // The default is the shipped build switch.
  expect(galleryShapeIds()).toBe(galleryShapeIds(GEN_V2_ENABLED));
});

test('today: v2 off lists the 26 v1 shapes; v2 on adds the W3-19-admitted shapes; no id awaiting W3-19 is listed', () => {
  // W3-19 (owner ruling 2026-10-06): House, Teacup, Bell and Umbrella are admitted to v2 only, so
  // they are listed only in a build with v2 on (dealt by v2, never by v1 or the daily).
  const pending = SHAPE_CATALOGUE.filter((id) => !V2_ADMITTED_SHAPE_IDS.has(id));
  const expected = {
    false: SHAPE_CATALOGUE.slice(0, 26),
    true: [...SHAPE_CATALOGUE.slice(0, 26), 'House', 'Teacup', 'Bell', 'Umbrella'],
  };
  for (const v2 of [false, true]) {
    const ids = galleryShapeIds(v2);
    expect([v2, [...ids].sort()]).toEqual([v2, [...expected[`${v2}`]].sort()]);
    expect(pending.filter((id) => ids.has(id))).toEqual([]);
  }
});

test('galleryWall: a catalogue id nobody can be dealt gets no tile and is not counted in M', () => {
  const catalogue = [...SHAPE_CATALOGUE, 'AuthoredNotDealt'];
  const wall = galleryWall(EMPTY_SHAPE_MASKS, catalogue, new Set(), galleryShapeIds(false));
  expect(wall.tiles.map((t) => t.id)).toEqual(SHAPE_CATALOGUE.filter((id) => galleryShapeIds(false).has(id)));
  expect([wall.collected, wall.total]).toEqual([0, 26]);
});

test('galleryWall applies the filter by default (GalleryScreen calls galleryWall(masks))', () => {
  const wall = galleryWall(EMPTY_SHAPE_MASKS, [...SHAPE_CATALOGUE, 'AuthoredNotDealt']);
  expect(wall.tiles.map((t) => t.id)).not.toContain('AuthoredNotDealt');
  expect(wall.total).toBe(galleryShapeIds().size);
});

test('galleryWall: a collected id is always shown, but N and M count only dealable, non-retired ids', () => {
  // A bit only a newer build could have set (it admitted the shape, then the player downgraded).
  const catalogue = [...SHAPE_CATALOGUE, 'AuthoredNotDealt'];
  let masks = markSeen(EMPTY_SHAPE_MASKS, catalogue.length - 1);
  masks = markSeen(masks, SHAPE_CATALOGUE.indexOf('Cat'));
  const wall = galleryWall(masks, catalogue, new Set(), galleryShapeIds(false));
  expect(wall.tiles.find((t) => t.id === 'AuthoredNotDealt')).toEqual({
    id: 'AuthoredNotDealt',
    name: 'AuthoredNotDealt',
    collected: true,
  });
  expect([wall.collected, wall.total]).toEqual([1, 26]);
});

test('galleryWall keeps W4-09\'s retired rule: retired and not collected is hidden, retired and collected is shown uncounted', () => {
  const masks = markSeen(EMPTY_SHAPE_MASKS, SHAPE_CATALOGUE.indexOf('Fish'));
  const wall = galleryWall(masks, SHAPE_CATALOGUE, new Set(['Bolt', 'Fish']), galleryShapeIds(false));
  const ids = wall.tiles.map((t) => t.id);
  expect(ids).not.toContain('Bolt');
  expect(ids).toContain('Fish');
  expect([wall.collected, wall.total]).toEqual([0, 24]);
});
