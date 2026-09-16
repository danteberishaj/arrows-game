import {
  EXIT_COMBO_STEPS,
  EXIT_COMBO_WINDOW_MS,
  nextExitCombo,
} from '../exitCombo';

describe('nextExitCombo', () => {
  it('starts at step 0 and climbs one step per exit inside the window', () => {
    let combo = nextExitCombo(null, 1000);
    expect(combo).toEqual({ step: 0, at: 1000 });
    for (let i = 1; i < EXIT_COMBO_STEPS + 3; i += 1) {
      combo = nextExitCombo(combo, 1000 + i * 300);
      expect(combo.step).toBe(Math.min(EXIT_COMBO_STEPS - 1, i));
    }
  });

  it('resets after a pause longer than the window, and never on a shorter one', () => {
    const third = nextExitCombo(nextExitCombo(nextExitCombo(null, 0), 300), 600);
    expect(third.step).toBe(2);
    expect(nextExitCombo(third, 600 + EXIT_COMBO_WINDOW_MS).step).toBe(3);
    expect(nextExitCombo(third, 600 + EXIT_COMBO_WINDOW_MS + 1).step).toBe(0);
  });

  it('resets if the clock runs backwards', () => {
    const combo = nextExitCombo(nextExitCombo(null, 5000), 5300);
    expect(nextExitCombo(combo, 4000).step).toBe(0);
  });
});
