/**
 * - **Append-only.** An index is permanent. Never reorder, delete or reuse an index. New shapes go
 *   at the end.
 * - **Independent of pools and generator versions.** Removing a shape from a pool, or retiring
 *   it in a later generator version, does not remove it from the catalogue. Add it to
 *   `RETIRED_SHAPE_IDS` instead. The gallery shows a retired shape only if the player collected it.
 * - **A silhouette edit keeps its id** if it is still the same object, such as a thickened Bolt;
 *   the gallery draws the newest definition. If the object changes, append a new id.
 * - **Display names are not ids.** A rename changes a display-name map, never the id.
 * - **Capacity.** At most 60 ids. Past 60, add a third additive key through the P-01 migration
 *   pattern. Never repack existing bits.
 * - **Obligation on W3.** Any new generator version must provide an equivalent
 *   `shapeNameForLevel(index, version)`. It must extend this task's equivalence test to that
 *   version, and it must register every new shape id here before the shape can appear in a level.
 *   (Owners: W3-05 adds the `version` parameter and routes W4-07's fold through it, W3-10 adds the
 *   v2 branch, W3-18 appends ids.)
 */
import { ShapeDef, ShapeLibrary } from './shapeLibrary';

export const SHAPE_CATALOGUE: readonly string[] = Object.freeze([
  'Square',
  'Rectangle',
  'Circle',
  'Diamond',
  'Triangle',
  'Plus',
  'Hexagon',
  'Star',
  'Heart',
  'Trophy',
  'Crescent',
  'Flower',
  'Bolt',
  'Arrow',
  'Crown',
  'Hourglass',
  'Pentagon',
  'Octagon',
  'Ring',
  'X',
  'Butterfly',
  'Rocket',
  'Pine',
  'Cat',
  'Mushroom',
  'Fish',
]);

export const RETIRED_SHAPE_IDS: ReadonlySet<string> = new Set<string>();

// OWNER-PICKED STARTING VALUE: two 30-bit persistence keys.
export const MAX_CATALOGUE_BITS = 60;

const V1_SHAPE_DEFINITIONS: ReadonlyMap<string, ShapeDef> = new Map([
  ['Square', ShapeLibrary.Square],
  ['Rectangle', ShapeLibrary.Rectangle],
  ['Circle', ShapeLibrary.Circle],
  ['Diamond', ShapeLibrary.Diamond],
  ['Triangle', ShapeLibrary.Triangle],
  ['Plus', ShapeLibrary.Plus],
  ['Hexagon', ShapeLibrary.Hexagon],
  ['Star', ShapeLibrary.Star],
  ['Heart', ShapeLibrary.Heart],
  ['Trophy', ShapeLibrary.Trophy],
  ['Crescent', ShapeLibrary.Crescent],
  ['Flower', ShapeLibrary.Flower],
  ['Bolt', ShapeLibrary.Bolt],
  ['Arrow', ShapeLibrary.ArrowMark],
  ['Crown', ShapeLibrary.Crown],
  ['Hourglass', ShapeLibrary.Hourglass],
  ['Pentagon', ShapeLibrary.Pentagon],
  ['Octagon', ShapeLibrary.Octagon],
  ['Ring', ShapeLibrary.Ring],
  ['X', ShapeLibrary.XMark],
  ['Butterfly', ShapeLibrary.Butterfly],
  ['Rocket', ShapeLibrary.Rocket],
  ['Pine', ShapeLibrary.Pine],
  ['Cat', ShapeLibrary.Cat],
  ['Mushroom', ShapeLibrary.Mushroom],
  ['Fish', ShapeLibrary.Fish],
]);

// v1 is currently the newest generator. A later version replaces this map while
// V1_SHAPE_DEFINITIONS remains the fallback for catalogue ids it no longer defines.
const NEWEST_SHAPE_DEFINITIONS = V1_SHAPE_DEFINITIONS;

export function catalogueIndexOf(id: string): number {
  return SHAPE_CATALOGUE.indexOf(id);
}

export function shapeDefFor(id: string): ShapeDef | null {
  return NEWEST_SHAPE_DEFINITIONS.get(id) ?? V1_SHAPE_DEFINITIONS.get(id) ?? null;
}
