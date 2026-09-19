/**
 * Minimal JavaScript-fatal bookkeeping for the int-only save store.
 *
 * The handler persists only a count, an FNV-1a hash and a screen enum. Raw
 * error names and messages never enter storage or telemetry. A later cold
 * start emits one aggregate for everything pending; only the latest fatal's
 * hash and screen survive.
 */
import { SaveSystem } from '../core/saveSystem';
import type { EventProps } from './events';
import { fnv1a32 } from './hash';
import { Telemetry } from './telemetry';

type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;

/** The ErrorUtils surface used here, kept injectable for node tests. */
export interface ErrorUtilsLike {
  getGlobalHandler(): GlobalErrorHandler;
  setGlobalHandler(handler: GlobalErrorHandler): void;
}

/** The three SaveSystem fields used by fatal recording and draining. */
export interface FatalStore {
  readonly telFatalPending: number;
  setTelFatalPending(value: number): void;
  readonly telFatalHash: number;
  setTelFatalHash(value: number): void;
  readonly telFatalScreen: number;
  setTelFatalScreen(value: number): void;
}

export type FatalScreen = EventProps<'error'>['screen'];
type ErrorEventProps = EventProps<'error'>;

interface InstallFatalHandlerOptions {
  readonly errorUtils: ErrorUtilsLike;
  readonly save: FatalStore;
  readonly currentScreen: () => FatalScreen;
}

interface DrainFatalsOptions {
  readonly save?: FatalStore;
  readonly emitError?: (props: ErrorEventProps) => void;
}

const SCREEN_CODES: Readonly<Record<FatalScreen, number>> = Object.freeze({
  splash: 1,
  menu: 2,
  game: 3,
});

function screenCode(screen: FatalScreen): number {
  return SCREEN_CODES[screen] ?? 0;
}

function screenName(code: number): FatalScreen {
  if (code === 2) return 'menu';
  if (code === 3) return 'game';
  // Stored 1 is splash. Stored 0 or corrupt values also fall back to splash,
  // because the public telemetry schema deliberately has no "unknown" screen.
  return 'splash';
}

function nameAndMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}:${error.message}`;
  return `Error:${String(error)}`;
}

/**
 * Wraps React Native's current global handler. Recording failures are ignored,
 * but delegation is not: the previous handler always receives the original
 * arguments exactly once, so normal fatal termination remains intact.
 */
export function installFatalHandler({
  errorUtils,
  save,
  currentScreen,
}: InstallFatalHandlerOptions): void {
  const previousHandler = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    try {
      if (isFatal === true) {
        save.setTelFatalPending(save.telFatalPending + 1);
        save.setTelFatalHash(fnv1a32(nameAndMessage(error)));
        save.setTelFatalScreen(screenCode(currentScreen()));
      }
    } catch {
      // A failed best-effort write must never replace a crash with a hang.
    }
    previousHandler(error, isFatal);
  });
}

function emitTelemetryError(props: ErrorEventProps): void {
  Telemetry.emit('error', props);
}

/** Emits one aggregate from a prior process, then marks it drained. */
export function drainFatals({
  save = SaveSystem,
  emitError = emitTelemetryError,
}: DrainFatalsOptions = {}): void {
  const pending = save.telFatalPending;
  if (pending <= 0) return;

  emitError({
    kind: 'js_fatal',
    nameMessageHash: save.telFatalHash,
    screen: screenName(save.telFatalScreen),
    count: pending,
  });
  save.setTelFatalPending(0);
}
