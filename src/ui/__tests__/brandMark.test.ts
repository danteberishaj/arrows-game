/**
 * W5-13: `brandMark.ts` (what the app draws) is generated from `assets/images/mark.svg`
 * (what every raster is rendered from) by scripts/art/render-mark.ts. They must not drift.
 * Also pins the two invariants the SVG's seam-free construction relies on.
 */
import * as fs from 'fs';
import * as path from 'path';
import { MARK_FACES, MARK_VIEWBOX } from '../brandMark';

const svg = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'assets', 'images', 'mark.svg'), 'utf8');

function svgFaces() {
  return [...svg.matchAll(/<path\b([^>]*)\/>/g)].map((m) => {
    const attr = (n: string) => new RegExp(`\\b${n}="([^"]*)"`).exec(m[1])?.[1];
    return { id: attr('id'), fill: attr('fill'), d: attr('d') };
  });
}

/** Signed shoelace area of each `M ... Z` subpath (absolute M/L-implicit polygons only). */
function subpathAreas(d: string): number[] {
  return d
    .split('M')
    .map((s) => s.replace('Z', '').trim())
    .filter(Boolean)
    .map((s) => {
      const n = s.split(/[\s,]+/).map(Number);
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < n.length; i += 2) pts.push([n[i], n[i + 1]]);
      let a = 0;
      pts.forEach(([x, y], i) => {
        const [x2, y2] = pts[(i + 1) % pts.length];
        a += x * y2 - x2 * y;
      });
      return a / 2;
    });
}

describe('brand mark vector', () => {
  it('brandMark.ts matches mark.svg face for face (re-run render-mark.ts if not)', () => {
    expect(MARK_FACES.map((f) => ({ ...f }))).toEqual(svgFaces());
    expect(svg).toContain(`viewBox="${MARK_VIEWBOX}"`);
  });

  it('is nine flat faces in four colours', () => {
    expect(MARK_FACES).toHaveLength(9);
    expect(new Set(MARK_FACES.map((f) => f.fill))).toEqual(new Set(['#6C49E5', '#5130C2', '#E63C7F', '#BA2469']));
    for (const f of MARK_FACES) expect(f.d).toMatch(/^M[\d.\sMZ]+$/); // polygons only: no curves, no relative commands
  });

  it('every subpath of a face winds the same way (nonzero fill keeps underlaps solid)', () => {
    for (const f of MARK_FACES) {
      const areas = subpathAreas(f.d);
      expect(areas.every((a) => a > 0) || areas.every((a) => a < 0)).toBe(true);
    }
  });

  it('stays inside its 512 frame with the old raster margins', () => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const f of MARK_FACES) {
      const n = f.d.replace(/[MZ]/g, ' ').trim().split(/\s+/).map(Number);
      for (let i = 0; i < n.length; i += 2) {
        xs.push(n[i]);
        ys.push(n[i + 1]);
      }
    }
    // old mark.png drew x 118..393, y 117..394 (alpha > 0)
    expect(Math.min(...xs)).toBeGreaterThan(117);
    expect(Math.max(...xs)).toBeLessThan(395);
    expect(Math.min(...ys)).toBeGreaterThan(116);
    expect(Math.max(...ys)).toBeLessThan(396);
  });
});
