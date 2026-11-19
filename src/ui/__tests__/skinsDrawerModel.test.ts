import { drawerAction, drawerActionCopy, drawerSnaps, project, releaseTarget, rubberband } from '../skinsDrawerModel';
import {
  chooseArrowStyle, getArrowStyle, getSavedArrowStyle, initializeArrowStyle, previewArrowStyle, subscribeArrowStyle,
} from '../arrowStyleSelection';

describe('drawer snaps', () => {
  // Smallest (Pixel 4a-ish 640 dp) and largest (tablet-ish 1280 dp) windows the drawer must fit.
  it.each([640, 800, 1280])('half shows 55%% and full 92%% of a %i dp window', h => {
    const s = drawerSnaps(h);
    expect(s.sheetH - s.half).toBe(Math.round(h * 0.55));
    expect(s.sheetH - s.full).toBe(Math.round(h * 0.92));
    expect(s.closed).toBe(s.sheetH);
    expect(s.full).toBeLessThan(s.half);
  });
});

describe('release', () => {
  const s = drawerSnaps(800); // sheetH 736, half 296
  it('a slow drag that stops near a snap stays there', () => {
    expect(releaseTarget(s.half + 20, 0, s)).toBe('half');
    expect(releaseTarget(30, 0, s)).toBe('full');
  });
  it('distance alone closes when dragged most of the way down', () => {
    expect(releaseTarget(s.closed - 100, 0, s)).toBe('closed');
  });
  it('a short fast flick down from half closes (velocity, not distance)', () => {
    expect(releaseTarget(s.half + 15, 1500, s)).toBe('closed');
  });
  it('a short fast flick up from half goes full', () => {
    expect(releaseTarget(s.half - 15, -1500, s)).toBe('full');
  });
  it('a gentle flick down from full lands on half, not closed', () => {
    expect(releaseTarget(40, 600, s)).toBe('half');
  });
  it('projection and rubber band have the right shape', () => {
    expect(project(0)).toBe(0);
    expect(project(1000)).toBeGreaterThan(400);
    expect(Math.abs(rubberband(-200, 736))).toBeLessThan(200);
    expect(Math.abs(rubberband(-400, 736))).toBeGreaterThan(Math.abs(rubberband(-200, 736)));
  });
});

describe('bar action', () => {
  const base = { owned: false, equipped: false, price: 20, petals: 50, canBuy: true };
  it('owned: use, or in use when equipped', () => {
    expect(drawerAction({ ...base, owned: true })).toEqual({ kind: 'use' });
    expect(drawerActionCopy(drawerAction({ ...base, owned: true, equipped: true })).enabled).toBe(false);
  });
  it('buy with the balance after', () => {
    expect(drawerActionCopy(drawerAction(base))).toEqual({ button: 'Buy for 20 petals', line: "You'll have 30 left", enabled: true });
  });
  it('short and paused are disabled, with the reason', () => {
    expect(drawerActionCopy(drawerAction({ ...base, petals: 19 }))).toEqual({ button: 'Buy for 20 petals', line: 'You need 1 more petal', enabled: false });
    expect(drawerActionCopy(drawerAction({ ...base, canBuy: false })).line).toBe('Buying is paused right now');
  });
});

describe('live preview', () => {
  const saved = new Map<string, number>();
  const store = { getInt: (k: string, d: number) => saved.get(k) ?? d, setInt: (k: string, v: number) => { saved.set(k, v); } };
  beforeEach(() => { saved.clear(); initializeArrowStyle(store as never, true, true); });

  it('shows the preview without saving it, and reverts on null', () => {
    const calls = jest.fn();
    const off = subscribeArrowStyle(calls);
    previewArrowStyle('snowman');
    expect(getArrowStyle().id).toBe('snowman');
    expect(getSavedArrowStyle().id).toBe('classic');
    expect(saved.size).toBe(0);
    previewArrowStyle(null);
    expect(getArrowStyle().id).toBe('classic');
    expect(calls).toHaveBeenCalledTimes(2);
    off();
  });
  it('equipping saves and ends the preview', () => {
    previewArrowStyle('snowman');
    chooseArrowStyle('snowman');
    expect(getSavedArrowStyle().id).toBe('snowman');
    previewArrowStyle(null);
    expect(getArrowStyle().id).toBe('snowman');
    expect(saved.get('arrows_skin')).toBeGreaterThan(0);
  });
  it('equipping another style while previewing shows the equipped one', () => {
    previewArrowStyle('snowman');
    chooseArrowStyle('critter');
    expect(getArrowStyle().id).toBe('critter');
  });
  it('a hidden seasonal style cannot be previewed with seasons off', () => {
    initializeArrowStyle(store as never, true, false);
    previewArrowStyle('snowman');
    expect(getArrowStyle().id).toBe('classic');
  });
  it('does nothing when the picker is disabled', () => {
    initializeArrowStyle(store as never, false);
    previewArrowStyle('critter');
    expect(getArrowStyle().id).toBe('classic');
  });
});
