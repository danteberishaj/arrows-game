import { SKIN_SPECS, SKIN_SPEC_JSON, skinSpecFor } from '../skinSpecs';
import { skinContrastRows, skinPickerContrastRows } from '../contrastAudit';
import { ArrowPath, Direction } from '../../core';
import { BoardArrowArtCache } from '../arrowGeometry';

it.each(Object.values(SKIN_SPECS))('$id selection carries the complete spec once, with safe bounds', spec => {
  expect(JSON.parse(SKIN_SPEC_JSON[spec.id])).toEqual(spec);
  expect(skinSpecFor(spec.id)).toBe(spec);
  expect(spec.head.tipPastCentre).toBeLessThanOrEqual(.46);
  expect(spec.tail.radius + spec.tail.rim).toBeLessThanOrEqual(.44);
  const body = spec.layers.find(l => l.kind === 'body')!;
  for(const icing of spec.layers.filter(l => l.kind === 'ribbon')) {
    expect(icing.offset ?? [0,0]).toEqual([0,0]);
    expect((icing.amplitude ?? 0) + icing.width / 2).toBeLessThanOrEqual(body.width / 2 - .03);
  }
  expect(spec.layers.reduce((n,l) => n + (l.kind === 'bands' ? l.bands!.length : 1), 0) + Number(spec.face.eyes) + Number(spec.face.blush)).toBeLessThanOrEqual(7);
  expect(spec.lod.flatMinDp).toBeGreaterThan(0);
  expect(spec.lod.flatMinDp).toBeLessThanOrEqual(spec.lod.detailMinDp);
  expect(spec.lod.detailMinDp).toBeLessThanOrEqual(spec.lod.faceMinDp);
});
it('K4 audits the outline and the shared blocked colours against both backgrounds', () => {
  const rows = skinContrastRows();
  expect(rows.filter(row => !row.usage.id.includes('-tint-'))).toHaveLength(Object.values(SKIN_SPECS).reduce((n,s) => n + ((s.layers.find(l => l.kind === 'rim')!.colour === 'palette' ? s.palette.colours.length : 1) + 1)*2, 0));
  expect(rows.filter(r => r.required && !r.pass)).toEqual([]);
});
it('cell payload preserves exact ownership and direction independently of flat extensions', () => {
  const arrow = new ArrowPath([{r:0,c:0},{r:1,c:0},{r:1,c:1}], Direction.Right);
  const cache = new BoardArrowArtCache([arrow],40);
  expect(cache.cellsForSkin()).toBe('3,0,0,1,0,1,1');
  expect(cache.geometryForNativeView()).not.toBe(cache.cellsForSkin());
});
it('unknown selections fail closed', () => expect(skinSpecFor('unknown')).toBeNull());

it('K4 rejects a light outline even when the body is dark', () => {
  const spec = SKIN_SPECS.sherbet;
  const fixed = { ...spec, layers: spec.layers.map(layer => layer.kind === 'rim' ? { ...layer, colour: '#FFFFFF' } : layer) };
  const rows = skinContrastRows([fixed]).filter(row => row.usage.id.includes('-outline-'));
  expect(rows).toHaveLength(2);
  expect(rows.find(row => row.palette === 'Daylight')!.pass).toBe(false);
});
it('K4 allows light body fill and falls back to body contrast without a rim', () => {
  const spec = SKIN_SPECS.sherbet;
  const light = { ...spec, layers: spec.layers.map(l => l.kind === 'body' ? { ...l, colour: '#FFFFFF' } : l) };
  expect(skinContrastRows([light]).filter(r => r.required && !r.pass)).toEqual([]);
  const rimless = { ...light, layers: light.layers.filter(l => l.kind !== 'rim') };
  expect(skinContrastRows([rimless]).find(r => r.palette === 'Daylight' && r.usage.id.includes('outline'))!.pass).toBe(false);
});
it.each(Object.values(SKIN_SPECS))('K8 $id explicitly chooses a dot or no tail on one-cell arrows', spec => {
  expect(spec.tail.oneCell).toBe('none');
});

it('owner ruling: Cinnamon shaft icing is straight and its stripe is off-centre', () => {
  const icing = SKIN_SPECS.cinnamon.layers.find(l => l.kind === 'ribbon')!;
  const stripe = SKIN_SPECS.cinnamon.layers.find(l => l.kind === 'stripe')!;
  expect(icing.amplitude).toBe(0);
  expect(stripe.sideOffset! - stripe.width/2).toBeGreaterThan(icing.width/2);
  expect(icing.fadeFraction).toBe(.35);
});

it.each(Object.values(SKIN_SPECS))('owner ruling: $id white shaft accent shares the head oval axis', spec => {
  for(const layer of spec.layers.filter(layer => ['shine', 'ribbon', 'seam'].includes(layer.kind))) {
    expect(layer.offset ?? [0,0]).toEqual([0,0]);
    expect(layer.amplitude ?? 0).toBe(0);
  }
});

it('picker thumbnail rims contrast on both panel backgrounds', () => expect(skinPickerContrastRows().filter(row => !row.pass)).toEqual([]));
