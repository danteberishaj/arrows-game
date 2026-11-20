/**
 * UPDATE-PROMPT (META_UPDATE_PROMPT): when to show the Buddy "New version ready" card and the "Restart to update"
 * chip. Play decides whether an update exists (modules/arrows-update); this file only paces the ask:
 * - one check per app process, UPDATE_CHECK_DELAY_MS after the intro hands over to the menu (after the deferred
 *   ad init, so the check never lands on the splash or on the ad-init hitch);
 * - the card shows at most once per SNOOZE_MS for a given Play versionCode; a newer versionCode asks again at once;
 * - Update starts Play's flexible flow (Play shows its own confirm sheet, then downloads in the background);
 *   when Play reports 'downloaded', the menu shows the restart chip, also on a later launch.
 * Every failure (sideloaded build, no Play, offline) is silent: no card, nothing persisted.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { ArrowsUpdate, type UpdateInfo } from '../../modules/arrows-update';
import { QA_UPDATE_FAKE } from '../featureFlags';

export const UPDATE_CHECK_DELAY_MS = 2500; // OWNER-PICKED STARTING VALUE
export const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000; // owner 2026-11-20: "at most once every 3 days per version"
export const SNOOZE_KEY = 'arrows_update_snooze';

export interface Snooze { vc: number; at: number }

export function shouldOfferUpdate(info: UpdateInfo, snooze: Snooze | null, now: number): boolean {
  if (!info.available || !info.flexibleAllowed) return false;
  if (info.installStatus === 'downloading' || info.installStatus === 'downloaded' || info.installStatus === 'pending') return false;
  return snooze === null || snooze.vc !== info.versionCode || now - snooze.at >= SNOOZE_MS;
}

async function readSnooze(): Promise<Snooze | null> {
  try {
    const raw = await AsyncStorage.getItem(SNOOZE_KEY);
    const s = raw ? JSON.parse(raw) : null;
    return s && typeof s.vc === 'number' && typeof s.at === 'number' ? s : null;
  } catch { return null; }
}

const session = { checked: false };
export function resetAppUpdateForTests() { session.checked = false; }

/** `active`: flag on, menu showing, intro over. Returns what the menu should draw and its handlers. */
export function useAppUpdate(active: boolean) {
  const [offer, setOffer] = useState<UpdateInfo | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ArrowsUpdate) return;
    const sub = ArrowsUpdate.addListener('onState', ({ status }) => setReady(status === 'downloaded'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!active || !ArrowsUpdate || session.checked) return;
    const t = setTimeout(async () => {
      session.checked = true;
      try {
        const info = await ArrowsUpdate!.check(QA_UPDATE_FAKE);
        if (info.installStatus === 'downloaded') return setReady(true);
        // QA fake builds re-show the card every launch (the snooze was verified on device with build1, 2026-11-20).
        if (shouldOfferUpdate(info, QA_UPDATE_FAKE ? null : await readSnooze(), Date.now())) setOffer(info);
      } catch { /* not a Play install, offline, or Play busy: say nothing */ }
    }, UPDATE_CHECK_DELAY_MS);
    return () => clearTimeout(t);
  }, [active]);

  // Play: a download can finish while the app is in the background; re-read the status on resume.
  useEffect(() => {
    if (!ArrowsUpdate) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' || !session.checked) return;
      ArrowsUpdate!.check(QA_UPDATE_FAKE).then((i) => setReady(i.installStatus === 'downloaded'), () => {});
    });
    return () => sub.remove();
  }, []);

  const snooze = useCallback(() => {
    if (offer) AsyncStorage.setItem(SNOOZE_KEY, JSON.stringify({ vc: offer.versionCode, at: Date.now() })).catch(() => {});
    setOffer(null);
  }, [offer]);
  const onUpdate = useCallback(() => {
    snooze(); // a cancelled Play sheet must not re-ask straight away
    ArrowsUpdate?.startFlexible().catch(() => {});
  }, [snooze]);
  const onRestart = useCallback(() => {
    ArrowsUpdate?.completeUpdate().catch(() => {});
  }, []);

  return { offer: offer !== null, ready, onUpdate, onLater: snooze, onRestart };
}
