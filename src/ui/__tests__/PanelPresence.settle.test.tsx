/**
 * PANEL-STUCK: the win / lose overlay must END at rest (opacity 1, scale 1) whichever path settles the leg.
 *
 * Root cause (proven on emulator-5556, docs/next-level/reports/PANEL-STUCK.md): Reanimated 4.5.1 runs with
 * FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS. Its PropsRegistryGarbageCollector copies the LAST props the UI
 * thread wrote for a view back into that AnimatedComponent's React state (`settledProps`), and
 * AnimatedComponent.render() appends `settledProps` AFTER the caller's styles. When the backstop timer (or an
 * AppState 'active') settled a leg before its last frame, W2-05 swapped the animated style for a static rest
 * style in the same render: the view was detached before the snap's write of 1 reached it, the registry kept
 * the mid-leg frame (e.g. 0.855), the collector synced that into `settledProps`, and it overrode the static
 * rest style for as long as the panel stayed mounted.
 *
 * This file replaces Reanimated with a MODEL of exactly those 4.5.1 semantics (every rule cites the source):
 *  - a view's animated style is attached/detached at React commit (AnimatedComponent.componentDidUpdate ->
 *    _handleAnimatedStylesUpdate -> viewDescriptors.add/remove); attaching forces one write of the current
 *    value (ViewDescriptorsSet.add -> updater(true));
 *  - JS writes to a shared value / cancelAnimation are queued for the UI thread (mutables.ts setter,
 *    animation/util.ts cancelAnimationNative -> scheduleOnUI); a mapper writes ONLY to views attached when it
 *    runs (useAnimatedStyle styleUpdater -> updateProps(viewDescriptors)); the device trace shows the detach
 *    landing before the snap's mapper write, so the model runs the React commit first, then the UI queue;
 *  - the collector copies the registry's last write into `settledProps` (PropsRegistryGarbageCollector
 *    .syncPropsBackToReact -> _syncStylePropsBackToReact), and render() puts `settledProps` last
 *    (AnimatedComponent.render, FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS branch).
 * The model is only as good as that reading; the emulator loop in artifacts/PANEL-STUCK/ is the real proof.
 */
import React, { useSyncExternalStore } from 'react';
import { act, render } from '@testing-library/react-native';
import { AppState, StyleSheet, Text } from 'react-native';

type MockStyle = Record<string, unknown>;
type MockHandle = { __modelHandle: true; compute: () => MockStyle };
type MockViewRec = { attached: Set<MockHandle>; setSettled: (s: MockStyle) => void };

const mockUi = {
  jobs: [] as (() => void)[],
  /** UI-thread requestAnimationFrame callbacks, run by the next frame. */
  frames: [] as (() => void)[],
  registry: new Map<number, MockStyle>(),
  views: new Map<number, MockViewRec>(),
  nextTag: 1,
  /** Every mapper writes to the views it is attached to right now. */
  runMappers() {
    for (const [tag, v] of mockUi.views) {
      for (const h of v.attached) mockUi.registry.set(tag, { ...(mockUi.registry.get(tag) ?? {}), ...h.compute() });
    }
  },
};

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn: (...a: unknown[]) => void, ...a: unknown[]) => fn(...a),
  // A worklet scheduled on the UI thread runs as a queued UI job; inside it, requestAnimationFrame is the UI
  // thread's (the next frame), modelled by mockUi.frames.
  scheduleOnUI: (fn: () => void) => mockUi.jobs.push(() => {
    const raf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: () => void) => { mockUi.frames.push(cb); return 0; }) as never;
    try { fn(); } finally { globalThis.requestAnimationFrame = raf; }
  }),
}));

jest.mock('react-native-reanimated', () => {
  const R = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const AnimatedView = ({ style, children, ...rest }: { style: unknown[]; children?: React.ReactNode }) => {
    const [settled, setSettled] = R.useState({});
    const tag = R.useRef(0);
    // PropsFilter: an animated style contributes its values at FIRST render only (_initialPropsMap), later
    // renders reuse that map; a handle first seen after the first render contributes nothing.
    const initial = R.useRef(null as null | Map<MockHandle, MockStyle>);
    if (tag.current === 0) tag.current = mockUi.nextTag++;
    const flat = (Array.isArray(style) ? style : [style]).flat(Infinity) as unknown[];
    const handles = flat.filter((s): s is MockHandle => !!s && typeof s === 'object' && '__modelHandle' in s);
    if (initial.current === null) initial.current = new Map(handles.map((h) => [h, h.compute()]));
    const statics = flat.map((s) => (s && typeof s === 'object' && '__modelHandle' in s
      ? initial.current!.get(s as MockHandle) ?? {}
      : s));
    R.useLayoutEffect(() => {
      // Commit: attach new handles (forced write of the current value), detach the rest.
      const rec = mockUi.views.get(tag.current) ?? { attached: new Set<MockHandle>(), setSettled };
      mockUi.views.set(tag.current, rec);
      for (const h of [...rec.attached]) if (!handles.includes(h)) rec.attached.delete(h);
      for (const h of handles) {
        if (!rec.attached.has(h)) {
          rec.attached.add(h);
          mockUi.registry.set(tag.current, { ...(mockUi.registry.get(tag.current) ?? {}), ...h.compute() });
        }
      }
    });
    R.useEffect(() => () => {
      mockUi.views.delete(tag.current);
      mockUi.registry.delete(tag.current);
    }, []);
    // The host view React commits: the caller's non-animated styles, then settledProps (render() order).
    return R.createElement(View, { ...rest, testID: 'model-animated-view', style: [...statics, settled] }, children);
  };
  return {
    __esModule: true,
    default: { View: AnimatedView },
    Easing: { out: (e: unknown) => e, in: (e: unknown) => e, cubic: 'cubic', quad: 'quad' },
    ReduceMotion: { System: 'system' },
    withTiming: (target: number, _cfg: unknown, done?: (finished: boolean) => void) => ({ __timing: true, target, done }),
    cancelAnimation: (sv: { __cancel: () => void }) => mockUi.jobs.push(() => sv.__cancel()),
    useAnimatedStyle: (fn: () => MockStyle) => {
      const ref = R.useRef(null);
      if (ref.current === null) ref.current = { __modelHandle: true, compute: fn };
      ref.current.compute = fn;
      return ref.current;
    },
  };
});

// Imported after the mocks.
import { PanelOverlayFrame, createPanelPresence } from '../PanelPresence';
import { PANEL_BACKSTOP_MARGIN_MS, PANEL_LOSS_ENTER_MS, PANEL_WIN_ENTER_MS } from '../overlayPresence';

/** A model shared value: the UI-side value, a running timing animation, JS writes queued for the UI. */
function makePresence() {
  const sv = {
    ui: 0,
    anim: null as null | { target: number; done?: (f: boolean) => void },
    get value() {
      return sv.ui;
    },
    set value(v: unknown) {
      mockUi.jobs.push(() => {
        if (sv.anim) { const a = sv.anim; sv.anim = null; a.done?.(false); }
        if (typeof v === 'object' && v !== null && '__timing' in v) {
          sv.anim = v as unknown as { target: number; done?: (f: boolean) => void };
        } else {
          sv.ui = v as number;
          mockUi.runMappers();
        }
      });
    },
    __cancel() {
      if (sv.anim) { const a = sv.anim; sv.anim = null; a.done?.(false); }
    },
    /** One animation frame at `v` (UI thread). */
    frame(v: number) {
      sv.ui = v;
      mockUi.runMappers();
    },
    /** The animation's last frame, then its completion callback. */
    finish() {
      const a = sv.anim;
      if (!a) return;
      sv.ui = a.target;
      mockUi.runMappers();
      sv.anim = null;
      a.done?.(true);
    },
  };
  return sv;
}

/** The UI thread: run the queued jobs (JS writes, scheduled worklets). */
const runUi = () => act(() => {
  while (mockUi.jobs.length) mockUi.jobs.shift()!();
});
/** `n` UI frames: each runs the frame callbacks queued before it (they may queue callbacks for the next one). */
const frames = (n: number) => {
  for (let k = 0; k < n; k += 1) {
    act(() => {
      const due = mockUi.frames.splice(0);
      const raf = globalThis.requestAnimationFrame;
      globalThis.requestAnimationFrame = ((cb: () => void) => { mockUi.frames.push(cb); return 0; }) as never;
      try { for (const cb of due) cb(); } finally { globalThis.requestAnimationFrame = raf; }
    });
    runUi();
  }
};
/** The collector: the registry's last write becomes the view's React `settledProps`. */
const gcFlush = () => act(() => {
  for (const [tag, v] of mockUi.views) {
    const last = mockUi.registry.get(tag);
    if (last) v.setSettled({ ...last });
  }
});

function Harness({ presence, latch }: { presence: never; latch: ReturnType<typeof createPanelPresence> }) {
  const state = useSyncExternalStore(latch.subscribe, latch.getSnapshot);
  if (state === 'hidden') return null;
  return (
    <PanelOverlayFrame
      testID="frame"
      presence={presence}
      state={state}
      scrimColor="#00000073"
      overlayStyle={{ flex: 1 }}
      panelStyle={{ width: 280 }}
    >
      <Text>Out of hearts</Text>
    </PanelOverlayFrame>
  );
}

function effective(screen: ReturnType<typeof render>) {
  const [scrim, panel] = screen.getAllByTestId('model-animated-view');
  const s = StyleSheet.flatten(scrim.props.style as never) as MockStyle;
  const p = StyleSheet.flatten(panel.props.style as never) as MockStyle;
  const scale = (p.transform as { scale: number }[] | undefined)?.[0]?.scale ?? 1;
  return { scrimOpacity: s.opacity ?? 1, panelOpacity: p.opacity ?? 1, panelScale: scale };
}

let appStateListener: ((s: string) => void) | null = null;
beforeEach(() => {
  jest.useFakeTimers();
  mockUi.jobs = []; mockUi.frames = []; mockUi.registry.clear(); mockUi.views.clear();
  appStateListener = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, l) => {
    appStateListener = l as (s: string) => void;
    return { remove: () => { appStateListener = null; } } as never;
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function enter(ms: number) {
  const presence = makePresence();
  const latch = createPanelPresence(presence as never);
  let screen!: ReturnType<typeof render>;
  act(() => { latch.show(ms); });
  screen = render(<Harness presence={presence as never} latch={latch} />);
  runUi(); // snap(0), then withTiming starts
  return { presence, latch, screen };
}

const REST = { scrimOpacity: 1, panelOpacity: 1, panelScale: 1 };

describe('PANEL-STUCK: the overlay ends at rest on every settle path', () => {
  it.each([
    ['lose', PANEL_LOSS_ENTER_MS],
    ['win', PANEL_WIN_ENTER_MS],
  ])('%s: the backstop timer settles mid-leg -> rest after the collector sync (W5-19 anomaly)', (_n, ms) => {
    const { presence, latch, screen } = enter(ms);
    act(() => presence.frame(0.8548)); // the device trace's last frame before the backstop
    act(() => { jest.advanceTimersByTime(ms + PANEL_BACKSTOP_MARGIN_MS); }); // settle: snap(1) + 'shown' commit
    expect(latch.state).toBe('shown');
    runUi(); // cancel + value 1 reach the UI thread after the commit
    frames(3);
    gcFlush();
    expect(effective(screen)).toEqual(REST);
  });

  it('lose: AppState active after a mid-leg background settles -> rest after the collector sync', () => {
    const { presence, latch, screen } = enter(PANEL_LOSS_ENTER_MS);
    act(() => presence.frame(0.6));
    act(() => { appStateListener?.('background'); appStateListener?.('active'); });
    expect(latch.state).toBe('shown');
    runUi();
    frames(3);
    gcFlush();
    expect(effective(screen)).toEqual(REST);
  });

  it('the animation completes (callback path) -> rest', () => {
    const { presence, latch, screen } = enter(PANEL_LOSS_ENTER_MS);
    act(() => presence.frame(0.5));
    act(() => presence.finish());
    expect(latch.state).toBe('shown');
    runUi();
    frames(3);
    gcFlush();
    act(() => { jest.advanceTimersByTime(1000); });
    expect(effective(screen)).toEqual(REST);
  });

  it('reduce motion (0 ms) mounts at rest on its first render, before any UI-thread work', () => {
    const presence = makePresence();
    const latch = createPanelPresence(presence as never);
    act(() => { latch.show(0); });
    const screen = render(<Harness presence={presence as never} latch={latch} />);
    expect(effective(screen)).toEqual(REST); // no runUi / gcFlush: React alone puts it at rest
    runUi();
    gcFlush();
    expect(effective(screen)).toEqual(REST);
  });

  it('a later mid-leg settle after a completed entrance (continue exit turned around) still ends at rest', () => {
    const { presence, latch, screen } = enter(PANEL_LOSS_ENTER_MS);
    act(() => presence.finish());
    runUi();
    act(() => { latch.hide(180); });
    runUi();
    act(() => presence.frame(0.4));
    act(() => { latch.show(PANEL_LOSS_ENTER_MS); });
    runUi();
    act(() => presence.frame(0.7));
    act(() => { jest.advanceTimersByTime(PANEL_LOSS_ENTER_MS + PANEL_BACKSTOP_MARGIN_MS); });
    expect(latch.state).toBe('shown');
    runUi();
    frames(3);
    gcFlush();
    expect(effective(screen)).toEqual(REST);
  });

  it.each([
    ['lose', PANEL_LOSS_ENTER_MS],
    ['win', PANEL_WIN_ENTER_MS],
  ])('%s: settled, then the app is backgrounded before the collector syncs: the React props alone are at rest', (_n, ms) => {
    // The device case (artifacts/PANEL-STUCK/repro2): the collector drops registry entries 2 s old unsynced, so
    // whatever React holds is what the view shows after the return. No gcFlush here.
    const { presence, latch, screen } = enter(ms);
    act(() => presence.frame(0.5));
    act(() => presence.finish());
    expect(latch.state).toBe('shown');
    runUi();
    frames(3);
    expect(effective(screen)).toEqual(REST);
  });

  it('until the UI thread confirms the settle, the animated style stays attached (a mid-leg settle writes 1 to the views)', () => {
    const { presence, latch } = enter(PANEL_LOSS_ENTER_MS);
    act(() => presence.frame(0.8548));
    act(() => { jest.advanceTimersByTime(PANEL_LOSS_ENTER_MS + PANEL_BACKSTOP_MARGIN_MS); });
    expect(latch.state).toBe('shown');
    runUi();
    expect([...mockUi.registry.values()].map((r) => r.opacity)).toEqual([1, 1]); // scrim and panel got the snap
  });
});
