import { createReadiness } from '../adReadiness';

describe('createReadiness', () => {
  it('starts false unless told otherwise', () => {
    expect(createReadiness().get()).toBe(false);
    expect(createReadiness(true).get()).toBe(true);
  });

  it('does not notify on an unchanged set', () => {
    const r = createReadiness(false);
    const seen: boolean[] = [];
    r.subscribe((v) => seen.push(v));
    r.set(false);
    r.set(false);
    expect(seen).toEqual([]);
  });

  it('notifies each subscriber once per real change, with the new value', () => {
    const r = createReadiness(false);
    const a: boolean[] = [];
    const b: boolean[] = [];
    r.subscribe((v) => a.push(v));
    r.subscribe((v) => b.push(v));
    r.set(true);
    r.set(true);
    r.set(false);
    r.set(false);
    r.set(true);
    expect(a).toEqual([true, false, true]);
    expect(b).toEqual([true, false, true]);
    expect(r.get()).toBe(true);
  });

  it('stops notifying after unsubscribe', () => {
    const r = createReadiness(false);
    const seen: boolean[] = [];
    const off = r.subscribe((v) => seen.push(v));
    r.set(true);
    off();
    r.set(false);
    expect(seen).toEqual([true]);
  });

  it('lets a subscriber unsubscribe during a notification without skipping others', () => {
    const r = createReadiness(false);
    const seen: string[] = [];
    const offA = r.subscribe(() => {
      seen.push('a');
      offA();
    });
    r.subscribe(() => seen.push('b'));
    r.set(true);
    r.set(false);
    expect(seen).toEqual(['a', 'b', 'b']);
  });
});
