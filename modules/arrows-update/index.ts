import { requireOptionalNativeModule } from 'expo';

/** Play's InstallStatus, named. */
export type InstallStatus =
  | 'unknown' | 'pending' | 'downloading' | 'downloaded' | 'installing' | 'installed' | 'failed' | 'canceled';

export interface UpdateInfo {
  available: boolean;
  flexibleAllowed: boolean;
  versionCode: number;
  installStatus: InstallStatus;
}

export interface ArrowsUpdateNativeModule {
  /** Asks Play whether a newer version exists. `fake` = QA FakeAppUpdateManager. Rejects off Play / offline. */
  check(fake: boolean): Promise<UpdateInfo>;
  /** Opens Play's flexible-update confirmation; true if the flow started. */
  startFlexible(): Promise<boolean>;
  /** Installs a downloaded update (Play restarts the app). */
  completeUpdate(): Promise<void>;
  addListener(event: 'onState', cb: (e: { status: InstallStatus }) => void): { remove(): void };
}

/** null on iOS / web / builds without the module. */
export const ArrowsUpdate = requireOptionalNativeModule<ArrowsUpdateNativeModule>('ArrowsUpdate');
