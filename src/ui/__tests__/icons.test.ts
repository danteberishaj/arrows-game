/**
 * W5-02 (ART_ICONS_ENABLED): the SVG icon set's path data and props. What the icons look like, whether they sit
 * centred in the buttons and whether they replace the OS emoji close only on the emulator captures in
 * artifacts/W5-02/ (a headless check never reaches the OS emoji renderer).
 *
 * `Icon` is called as a plain function (no renderer): react-native-svg is replaced by host-name strings, so the
 * returned element tree can be read in the node project.
 */
import type { ReactElement } from 'react';

jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path' }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const icons = require('../icons') as typeof import('../icons');
const { HEART_PATH, ICON_NAMES, ICON_STROKE, ICONS, Icon } = icons;

type El = ReactElement<Record<string, unknown>>;

/** The Svg element Icon returns and its Path children. */
function render(name: (typeof ICON_NAMES)[number], size = 24, color = '#123456') {
  const svg = Icon({ name, size, color }) as El;
  const kids = svg.props.children as El | El[];
  const paths = (Array.isArray(kids) ? kids : [kids]).filter(Boolean);
  return { svg, paths };
}

/** The path data's numbers, in order (commands stripped). */
const numbers = (d: string) => (d.match(/-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/gi) ?? []).map(Number);

describe('the icon record', () => {
  it('has exactly the brief\'s nine names, plus W7-04\'s settings gear', () => {
    expect([...ICON_NAMES].sort()).toEqual(
      ['back', 'heart', 'hint', 'moon', 'settings', 'soundOff', 'soundOn', 'sparkle', 'star', 'sun'],
    );
    expect(Object.keys(ICONS).sort()).toEqual([...ICON_NAMES].sort());
  });

  it('is frozen, record, part lists and parts', () => {
    expect(Object.isFrozen(ICONS)).toBe(true);
    for (const name of ICON_NAMES) {
      expect(Object.isFrozen(ICONS[name])).toBe(true);
      for (const part of ICONS[name]) expect(Object.isFrozen(part)).toBe(true);
    }
  });

  it('ICON_STROKE is 2 units of 24 (OWNER-PICKED STARTING VALUE)', () => {
    expect(ICON_STROKE).toBe(2);
  });

  it.each(ICON_NAMES.map((n) => [n]))('%s: every path d is non-empty, has no NaN and only path commands', (name) => {
    expect(ICONS[name].length).toBeGreaterThan(0);
    for (const { d } of ICONS[name]) {
      expect(d.trim().length).toBeGreaterThan(0);
      expect(d).not.toMatch(/NaN|undefined|Infinity/);
      expect(d).toMatch(/^[Mm]/);
      expect(d).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/);
      expect(numbers(d).length).toBeGreaterThan(0);
      expect(numbers(d).every(Number.isFinite)).toBe(true);
    }
  });

  it('the heart is HEART_PATH, moved from GameScreen unchanged', () => {
    expect(HEART_PATH).toBe(
      'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 ' +
      '4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 ' +
      '11.54L12 21.35z',
    );
    expect(ICONS.heart).toEqual([{ d: HEART_PATH, paint: 'fill' }]);
  });

  it('star, sparkle and heart are filled; back, hint, sun, moon, the two sound icons and settings are stroked', () => {
    for (const n of ['star', 'sparkle', 'heart'] as const) expect(ICONS[n].every((p) => p.paint === 'fill')).toBe(true);
    for (const n of ['back', 'hint', 'sun', 'moon', 'soundOn', 'soundOff', 'settings'] as const) {
      expect(ICONS[n].every((p) => p.paint === 'stroke')).toBe(true);
    }
  });

  it('sound off is a different SHAPE from sound on, not only a colour: no waves, and a slash', () => {
    const on = new Set(ICONS.soundOn.map((p) => p.d));
    const off = new Set(ICONS.soundOff.map((p) => p.d));
    const onlyOn = [...on].filter((d) => !off.has(d));
    const onlyOff = [...off].filter((d) => !on.has(d));
    expect(onlyOn.length).toBeGreaterThan(0); // the waves
    expect(onlyOff.length).toBeGreaterThan(0); // the slash
    // The speaker itself is shared, so the two read as one control in two states.
    expect([...on].filter((d) => off.has(d)).length).toBeGreaterThan(0);
  });

  it('W7-04: settings is a gear (an outline with 8 teeth) around a round hole, centred in the 24-unit box', () => {
    expect(ICONS.settings).toHaveLength(2);
    const [outline, hole] = ICONS.settings.map((p) => p.d);
    // 8 teeth: 8 valley arcs between them, each tooth 3 straight edges.
    expect(outline.match(/A/g)).toHaveLength(8);
    expect(outline.match(/L/g)).toHaveLength(24);
    const xy = numbers(outline.replace(/A[^L]*?0 0 1 /g, 'L'));
    const xs = xy.filter((_, i) => i % 2 === 0);
    const ys = xy.filter((_, i) => i % 2 === 1);
    // Inside the box with room for the stroke (half of ICON_STROKE), and centred on (12, 12).
    expect(Math.min(...xs, ...ys)).toBeGreaterThanOrEqual(ICON_STROKE / 2);
    expect(Math.max(...xs, ...ys)).toBeLessThanOrEqual(24 - ICON_STROKE / 2);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(12, 1);
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(12, 1);
    expect(hole).toBe('M15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0z');
  });
});

describe('Icon props', () => {
  it.each(ICON_NAMES.map((n) => [n]))('%s: one 24-unit Svg at the given size', (name) => {
    const { svg, paths } = render(name, 18);
    expect(svg.type).toBe('Svg');
    expect(svg.props).toMatchObject({ width: 18, height: 18, viewBox: '0 0 24 24' });
    expect(paths).toHaveLength(ICONS[name].length);
    paths.forEach((p, i) => {
      expect(p.type).toBe('Path');
      expect(p.props.d).toBe(ICONS[name][i].d);
    });
  });

  it.each(ICON_NAMES.map((n) => [n]))('%s: stroked parts use ICON_STROKE with round caps and joins; filled parts only fill', (name) => {
    const { paths } = render(name, 30, '#ABCDEF');
    paths.forEach((p, i) => {
      if (ICONS[name][i].paint === 'stroke') {
        expect(p.props).toMatchObject({
          fill: 'none',
          stroke: '#ABCDEF',
          strokeWidth: ICON_STROKE,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        });
      } else {
        expect(p.props.fill).toBe('#ABCDEF');
        expect(p.props.stroke).toBeUndefined();
        expect(p.props.strokeWidth).toBeUndefined();
      }
    });
  });
});
