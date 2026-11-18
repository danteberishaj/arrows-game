import { chooseArrowStyle, consumeSkinIntro, initializeArrowStyle } from '../arrowStyleSelection';
import { ARROW_STYLES } from '../skinSpecs';

const store = () => { const m = new Map<string, number>(); return { getInt: (k: string, d: number) => m.get(k) ?? d, setInt: (k: string, v: number) => { m.set(k, v); } }; };

it('equipping a style plays its board intro exactly once', () => {
  initializeArrowStyle(store() as never, true, false);
  const style = ARROW_STYLES.find(s => s.numericId > 0 && s.numericId < 20)!;
  expect(consumeSkinIntro(style.id)).toBe(false); // nothing equipped yet
  chooseArrowStyle(style.id);
  expect(consumeSkinIntro('classic-not-this-one')).toBe(false); // another id never consumes it
  expect(consumeSkinIntro(style.id)).toBe(true);
  expect(consumeSkinIntro(style.id)).toBe(false);
});
