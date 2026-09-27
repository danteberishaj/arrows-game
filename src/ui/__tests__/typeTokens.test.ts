/**
 * W5-08: the Type record (theme.ts) names the text sizes that existed; it changed no value. These pins are the literal
 * fontSize / fontFamily / letterSpacing each style held before W5-08 (GameScreen, HomeScreen, GalleryScreen, ads.tsx,
 * the Star glyph and the wordmark's size). A deliberate change is a W5-20 owner decision that edits this table with
 * it. Whether the screens draw the same pixels closes only on the emulator captures in artifacts/W5-08/.
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Fonts, Type } from '../theme';

const BEFORE = {
  wordmark: { fontSize: 56 },
  menuLevel: { fontSize: 24, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  menuTier: { fontSize: 15, fontFamily: Fonts.semi, letterSpacing: 0.5 },
  menuPlay: { fontSize: 22, fontFamily: Fonts.bold, letterSpacing: 1 },
  menuStats: { fontSize: 13, fontFamily: Fonts.semi },
  menuEntry: { fontSize: 15, fontFamily: Fonts.semi, letterSpacing: 0.5 },
  gameLevel: { fontSize: 24, fontFamily: Fonts.bold, letterSpacing: 1 },
  gameTutorial: { fontSize: 18, fontFamily: Fonts.bold, letterSpacing: 1 },
  gameTier: { fontSize: 12, fontFamily: Fonts.semi, letterSpacing: 0.5 },
  panelTitle: { fontSize: 24, fontFamily: Fonts.bold },
  star: { fontSize: 34 },
  starBig: { fontSize: 44 },
  panelSub: { fontSize: 14, fontFamily: Fonts.semi },
  panelButton: { fontSize: 16, fontFamily: Fonts.bold },
  panelStreak: { fontSize: 13, fontFamily: Fonts.semi },
  galleryCount: { fontSize: 15, fontFamily: Fonts.semi, letterSpacing: 0.5 },
  galleryName: { fontSize: 12, fontFamily: Fonts.semi },
  adTag: { fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 2 },
  adTitle: { fontSize: 18, fontFamily: Fonts.bold },
  adCount: { fontSize: 44, fontFamily: Fonts.bold },
  adSub: { fontSize: 12, fontFamily: Fonts.semi },
};

describe('Type', () => {
  it('holds exactly the values the styles had (same roles, same keys, same values)', () => {
    expect(Type).toStrictEqual(BEFORE);
  });

  it('is frozen, record and entries', () => {
    expect(Object.isFrozen(Type)).toBe(true);
    for (const t of Object.values(Type)) expect(Object.isFrozen(t)).toBe(true);
  });

  it('no src/ui/*.tsx file has a numeric fontSize literal left (the brief\'s grep gate)', () => {
    const dir = join(__dirname, '..');
    const hits = readdirSync(dir)
      .filter((f) => f.endsWith('.tsx'))
      .flatMap((f) => readFileSync(join(dir, f), 'utf8').split('\n').map((l, i) => [f, i + 1, l] as const))
      .filter(([, , l]) => /fontSize: [0-9]/.test(l))
      .map(([f, n]) => `${f}:${n}`);
    expect(hits).toEqual([]);
  });
});
