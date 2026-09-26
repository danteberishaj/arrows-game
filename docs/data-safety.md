# Data safety evidence pack (Android) — DRAFT — NOT LEGAL ADVICE

This file is the single place for the Google Play **Data safety** answers, the **ads**,
**content rating** and **target audience** declarations, and the evidence behind each one.
RELEASE.md points here. Nothing in this file has been entered into Play Console, and nothing
here has been reviewed by anyone legally qualified: that is W7-07 (owner). Where a line says
DRAFT, it is a proposal, not a statement that the app complies with anything.

- Written 2026-09-26 by W7-06 from the built release artifact below, not from `app.json`.
- Ads are **Google AdMob directly** (`react-native-google-mobile-ads` 17.1.0). LevelPlay /
  Unity / ironSource were removed (commits e58a525, c7e2d55, 15b452a) and are absent from the
  artifact (section 2.6).
- Labels: **EXECUTED** (run and output seen), **INFERRED** (read, not run), **VENDOR DOC**
  (read from the vendor's page on the date given; the vendor can change it).

## 1. The artifact

| Field | Value |
|---|---|
| File | `artifacts/final-2026-09-24/arrows-87ec519-vc10.aab` (gitignored; never copied into the repo) |
| SHA-256 | `b0b4545ce76e3a437807b7f254b90982d33d5a2590bf30d1bd726cbd2c52ddd2` (55,893,916 bytes) |
| Commit | `87ec5196717116a49b2d6053838ca911728b1678` (2026-09-25) |
| Identity | `com.danteb.arrows`, versionCode 10, versionName 1.0.0, minSdk 24, targetSdk 36 (section 2.2) |
| Signer | `CN=Arrows`, SHA-256 `24:F7:FA:0B:…:50:F8` = the Play upload certificate (`keytool -printcert -jarfile`, EXECUTED) |
| Ad units in its JS bundle | the owner's units `…/6706292920`, `…/7549521178`, `…/3505414519`, `…/5508761320` and publisher `9813131856455133` each found (1 ASCII line; `grep -a -c` on `base/assets/index.android.bundle`, EXECUTED): a real-ads build |
| Dumped with | bundletool 1.18.1, 2026-09-26 |

**Why an AAB and not a fresh APK (deviation from the brief, controller ruling).** The brief
asks for a new release APK and `aapt2`/`gradlew` dumps. The disk was below the 5 GB build gate
(it touched 117 MiB free during this task because of another process), and the controller ruled
no native build. The AAB is what Play receives and cross-checks, so the dumps below are
`bundletool dump manifest` on it, and the dependency list is read from the AAB's own
`BUNDLE-METADATA/com.android.tools.build.libraries/dependencies.pb` (the resolved release
runtime classpath that AGP recorded at build time) instead of `gradlew :app:dependencies`.

**What changed after this artifact.** 12 commits, `87ec519..b082532`. EXECUTED
`git diff --stat 87ec519..HEAD -- package.json package-lock.json app.json eas.json plugins modules metro.config.js`:
only `package.json` / `package-lock.json`, adding `expo-store-review ~57.0.3` (W4-11). Every
other change is JS. EXECUTED: the added JS lines contain no `fetch(`, URL, `XMLHttpRequest`,
`WebSocket`, `Linking.` or `Share.` call (the only hits are three Jest snapshot headers). What
expo-store-review adds is in section 3.

## 2. Dumps (verbatim, 2026-09-26, AAB SHA-256 `b0b4545c…2ddd2`)

### 2.1 Permissions

```text
$ bundletool dump manifest --bundle arrows-87ec519-vc10.aab --xpath /manifest/uses-permission/@android:name
android.permission.INTERNET
android.permission.READ_EXTERNAL_STORAGE
android.permission.VIBRATE
android.permission.WRITE_EXTERNAL_STORAGE
com.google.android.gms.permission.AD_ID
android.permission.WAKE_LOCK
android.permission.ACCESS_NETWORK_STATE
android.permission.ACCESS_ADSERVICES_AD_ID
android.permission.ACCESS_ADSERVICES_ATTRIBUTION
android.permission.ACCESS_ADSERVICES_TOPICS
android.permission.FOREGROUND_SERVICE
com.danteb.arrows.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION
```

`READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` carry `android:maxSdkVersion="32"` in the
full dump (2.5). EXECUTED: no location, account, phone, camera, microphone, notification,
billing or `QUERY_ALL_PACKAGES` permission (`grep -c -E 'ACCESS_FINE_LOCATION|ACCESS_COARSE_LOCATION|BILLING|GET_ACCOUNTS|READ_PHONE_STATE|CAMERA|RECORD_AUDIO|POST_NOTIFICATIONS|QUERY_ALL_PACKAGES'` = 0).

### 2.2 Identity (the `aapt2 dump badging` equivalent; cross-reference P-04a)

```text
$ bundletool dump manifest --bundle arrows-87ec519-vc10.aab --xpath /manifest/@package
com.danteb.arrows
$ … --xpath /manifest/@android:versionCode
10
$ … --xpath /manifest/@android:versionName
1.0.0
$ … --xpath /manifest/uses-sdk/@android:minSdkVersion
24
$ … --xpath /manifest/uses-sdk/@android:targetSdkVersion
36
```

P-04a's proof in RELEASE.md ("Target SDK proof", versionCode 6, 2026-09-16) also read
targetSdk 36 / minSdk 24. This artifact agrees; the EAS-built AAB is still unread (W7-07).

### 2.3 Backup attributes

```text
$ … --xpath /manifest/application/@android:allowBackup
true
$ … --xpath /manifest/application/@android:dataExtractionRules

$ … --xpath /manifest/application/@android:fullBackupContent

```

`allowBackup` is `true` and neither rules attribute exists, so Android Auto Backup and
device-to-device transfer include the app's data with the platform defaults (row ev-15).

### 2.4 Dependencies (ad, identifier and Play artifacts)

Decoded from the AAB's `dependencies.pb` with a 63-line zero-dependency protobuf reader
(`python3 artifacts/W7-06/decode_deps.py <(unzip -p <aab> BUNDLE-METADATA/com.android.tools.build.libraries/dependencies.pb)`,
EXECUTED, exit 0; the unfiltered output, 153 libraries plus the module's 36 direct
dependencies, is `artifacts/W7-06/dependencies-decoded.txt`; both files are gitignored). Below
are the decoder's own lines, filtered to `gms|android.play|ump|privacysandbox|androidx.work|androidx.room`
and grouped under three headings of mine. The edge list keeps only the edges out of
`play-services-ads`, `play-services-ads-api` and `work-runtime`, minus their edge into
`play-services-basement` (the full edge list is in the artifacts file).

```text
# libraries: 153
androidx.privacysandbox.ads:ads-adservices-java:1.0.0-beta05
androidx.privacysandbox.ads:ads-adservices:1.0.0-beta05
androidx.room:room-common:2.2.5
androidx.room:room-runtime:2.2.5
androidx.work:work-runtime:2.7.0
com.google.android.gms:play-services-ads-api:25.4.0
com.google.android.gms:play-services-ads-identifier:18.0.0
com.google.android.gms:play-services-ads:25.4.0
com.google.android.gms:play-services-appset:16.0.1
com.google.android.gms:play-services-base:18.0.0
com.google.android.gms:play-services-basement:18.9.0
com.google.android.gms:play-services-measurement-base:20.1.2
com.google.android.gms:play-services-measurement-sdk-api:20.1.2
com.google.android.gms:play-services-tasks:18.2.0
com.google.android.play:hsdp:2.0.1
com.google.android.ump:user-messaging-platform:4.0.0
# module 'base' direct deps (filtered)
  direct: com.google.android.ump:user-messaging-platform:4.0.0
  direct: com.google.android.gms:play-services-ads:25.4.0
# edges (dependent -> dependency, filtered)
  com.google.android.gms:play-services-ads:25.4.0 -> androidx.privacysandbox.ads:ads-adservices-java:1.0.0-beta05
  com.google.android.gms:play-services-ads:25.4.0 -> androidx.privacysandbox.ads:ads-adservices:1.0.0-beta05
  com.google.android.gms:play-services-ads:25.4.0 -> com.google.android.gms:play-services-ads-api:25.4.0
  com.google.android.gms:play-services-ads:25.4.0 -> com.google.android.gms:play-services-ads-identifier:18.0.0
  com.google.android.gms:play-services-ads:25.4.0 -> com.google.android.gms:play-services-appset:16.0.1
  com.google.android.gms:play-services-ads:25.4.0 -> com.google.android.gms:play-services-tasks:18.2.0
  com.google.android.gms:play-services-ads-api:25.4.0 -> androidx.work:work-runtime:2.7.0
  com.google.android.gms:play-services-ads-api:25.4.0 -> com.google.android.gms:play-services-measurement-sdk-api:20.1.2
  com.google.android.gms:play-services-ads-api:25.4.0 -> com.google.android.play:hsdp:2.0.1
  com.google.android.gms:play-services-ads-api:25.4.0 -> com.google.android.ump:user-messaging-platform:4.0.0
  androidx.work:work-runtime:2.7.0 -> androidx.room:room-runtime:2.2.5
```

The library version stamps in the AAB agree (EXECUTED, `unzip -p <aab> base/root/<name>.properties | grep version=`):
`hsdp` 2.0.1, `play-services-ads-api` 25.4.0, `play-services-ads-identifier` 18.0.0,
`play-services-ads` 25.4.0, `play-services-appset` 16.0.1, `play-services-base` 18.0.0,
`play-services-basement` 18.9.0, `play-services-measurement-base` 20.1.2,
`play-services-measurement-sdk-api` 20.1.2, `play-services-tasks` 18.2.0,
`user-messaging-platform` 4.0.0.

EXECUTED: the unfiltered list has no `firebase`, `crashlytics`, `sentry`, `auth`, `billing` or
`location` library (`grep -c -i` = 0). The only non-Google, non-framework libraries are React
Native / Expo / Fresco / OkHttp / Kotlin runtime pieces.

### 2.5 Full manifest

`bundletool dump manifest --bundle arrows-87ec519-vc10.aab | grep -v '^[[:space:]]*$'` (blank
lines removed, nothing else; exit 0; 140 lines; a second dump was byte-identical, EXECUTED `cmp`).

<details><summary>AndroidManifest.xml as bundled (click to open)</summary>

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android" android:compileSdkVersion="36" android:compileSdkVersionCodename="16" android:versionCode="10" android:versionName="1.0.0" package="com.danteb.arrows" platformBuildVersionCode="36" platformBuildVersionName="16">
  <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="36"/>
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:maxSdkVersion="32" android:name="android.permission.READ_EXTERNAL_STORAGE"/>
  <uses-permission android:name="android.permission.VIBRATE"/>
  <uses-permission android:maxSdkVersion="32" android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
  <uses-permission android:name="com.google.android.gms.permission.AD_ID"/>
  <queries>
    <intent>
      <action android:name="android.intent.action.VIEW"/>
      <category android:name="android.intent.category.BROWSABLE"/>
      <data android:scheme="https"/>
    </intent>
    <intent>
      <action android:name="android.intent.action.OPEN_DOCUMENT_TREE"/>
    </intent>
    <intent>
      <action android:name="android.support.customtabs.action.CustomTabsService"/>
    </intent>
    <intent>
      <action android:name="android.intent.action.INSERT"/>
      <data android:mimeType="vnd.android.cursor.dir/event"/>
    </intent>
    <intent>
      <action android:name="android.intent.action.VIEW"/>
      <data android:scheme="sms"/>
    </intent>
    <intent>
      <action android:name="android.intent.action.DIAL"/>
      <data android:path="tel:"/>
    </intent>
    <package android:name="com.android.vending"/>
  </queries>
  <uses-permission android:name="android.permission.WAKE_LOCK"/>
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
  <uses-permission android:name="android.permission.ACCESS_ADSERVICES_AD_ID"/>
  <uses-permission android:name="android.permission.ACCESS_ADSERVICES_ATTRIBUTION"/>
  <uses-permission android:name="android.permission.ACCESS_ADSERVICES_TOPICS"/>
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
  <permission android:name="com.danteb.arrows.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION" android:protectionLevel="0x00000002"/>
  <uses-permission android:name="com.danteb.arrows.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION"/>
  <application android:allowBackup="true" android:appComponentFactory="androidx.core.app.CoreComponentFactory" android:enableOnBackInvokedCallback="false" android:extractNativeLibs="false" android:icon="@mipmap/ic_launcher" android:label="@string/app_name" android:name="com.danteb.arrows.MainApplication" android:roundIcon="@mipmap/ic_launcher_round" android:supportsRtl="true" android:theme="@style/AppTheme">
    <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="ca-app-pub-9813131856455133~9332456261"/>
    <meta-data android:name="com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT" android:value="true"/>
    <meta-data android:name="com.google.android.gms.ads.flag.OPTIMIZE_AD_LOADING" android:value="true"/>
    <meta-data android:name="com.google.android.gms.ads.flag.OPTIMIZE_INITIALIZATION" android:value="true"/>
    <meta-data android:name="expo.modules.updates.ENABLED" android:value="false"/>
    <meta-data android:name="expo.modules.updates.ENABLE_BSDIFF_PATCH_SUPPORT" android:value="true"/>
    <meta-data android:name="expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH" android:value="ALWAYS"/>
    <meta-data android:name="expo.modules.updates.EXPO_UPDATES_LAUNCH_WAIT_MS" android:value="0"/>
    <activity android:configChanges="0x80000fb0" android:exported="true" android:launchMode="2" android:name="com.danteb.arrows.MainActivity" android:screenOrientation="1" android:theme="@style/Theme.App.SplashScreen" android:windowSoftInputMode="0x00000010">
      <intent-filter>
        <action android:name="android.intent.action.MAIN"/>
        <category android:name="android.intent.category.LAUNCHER"/>
      </intent-filter>
    </activity>
    <meta-data android:name="org.unimodules.core.AppLoader#react-native-headless" android:value="expo.modules.adapters.react.apploader.RNHeadlessAppLoader"/>
    <meta-data android:name="com.facebook.soloader.enabled" android:value="true"/>
    <provider android:authorities="com.danteb.arrows.FileSystemFileProvider" android:exported="false" android:grantUriPermissions="true" android:name="expo.modules.filesystem.FileSystemFileProvider">
      <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/file_system_provider_paths"/>
    </provider>
    <activity android:configChanges="0x00000fb0" android:enableOnBackInvokedCallback="false" android:exported="false" android:name="com.google.android.gms.ads.AdActivity" android:theme="@android:style/Theme.Translucent"/>
    <provider android:authorities="com.danteb.arrows.mobileadsinitprovider" android:exported="false" android:initOrder="100" android:name="com.google.android.gms.ads.MobileAdsInitProvider"/>
    <service android:enabled="true" android:exported="false" android:name="com.google.android.gms.ads.AdService"/>
    <activity android:configChanges="0x00000fb0" android:exported="false" android:name="com.google.android.gms.ads.OutOfContextTestingActivity"/>
    <activity android:excludeFromRecents="true" android:exported="false" android:launchMode="2" android:name="com.google.android.gms.ads.NotificationHandlerActivity" android:taskAffinity="" android:theme="@android:style/Theme.Translucent.NoTitleBar"/>
    <activity android:configChanges="0x000005a0" android:excludeFromRecents="true" android:exported="false" android:launchMode="1" android:name="com.google.android.play.core.hsdp.service.HsdpShimActivity" android:theme="@style/Theme.HsdpServiceTransparent">
        </activity>
    <uses-library android:name="android.ext.adservices" android:required="false"/>
    <uses-library android:name="androidx.window.extensions" android:required="false"/>
    <uses-library android:name="androidx.window.sidecar" android:required="false"/>
    <activity android:exported="false" android:name="com.google.android.gms.common.api.GoogleApiActivity" android:theme="@android:style/Theme.Translucent.NoTitleBar"/>
    <meta-data android:name="com.google.android.gms.version" android:value="@integer/google_play_services_version"/>
    <provider android:authorities="com.danteb.arrows.androidx-startup" android:exported="false" android:name="androidx.startup.InitializationProvider">
      <meta-data android:name="androidx.emoji2.text.EmojiCompatInitializer" android:value="androidx.startup"/>
      <meta-data android:name="androidx.work.WorkManagerInitializer" android:value="androidx.startup"/>
      <meta-data android:name="androidx.lifecycle.ProcessLifecycleInitializer" android:value="androidx.startup"/>
      <meta-data android:name="androidx.profileinstaller.ProfileInstallerInitializer" android:value="androidx.startup"/>
    </provider>
    <service android:directBootAware="false" android:enabled="@bool/enable_system_alarm_service_default" android:exported="false" android:name="androidx.work.impl.background.systemalarm.SystemAlarmService"/>
    <service android:directBootAware="false" android:enabled="@bool/enable_system_job_service_default" android:exported="true" android:name="androidx.work.impl.background.systemjob.SystemJobService" android:permission="android.permission.BIND_JOB_SERVICE"/>
    <service android:directBootAware="false" android:enabled="@bool/enable_system_foreground_service_default" android:exported="false" android:name="androidx.work.impl.foreground.SystemForegroundService"/>
    <receiver android:directBootAware="false" android:enabled="true" android:exported="false" android:name="androidx.work.impl.utils.ForceStopRunnable$BroadcastReceiver"/>
    <receiver android:directBootAware="false" android:enabled="false" android:exported="false" android:name="androidx.work.impl.background.systemalarm.ConstraintProxy$BatteryChargingProxy">
      <intent-filter>
        <action android:name="android.intent.action.ACTION_POWER_CONNECTED"/>
        <action android:name="android.intent.action.ACTION_POWER_DISCONNECTED"/>
      </intent-filter>
    </receiver>
    <receiver android:directBootAware="false" android:enabled="false" android:exported="false" android:name="androidx.work.impl.background.systemalarm.ConstraintProxy$BatteryNotLowProxy">
      <intent-filter>
        <action android:name="android.intent.action.BATTERY_OKAY"/>
        <action android:name="android.intent.action.BATTERY_LOW"/>
      </intent-filter>
    </receiver>
    <receiver android:directBootAware="false" android:enabled="false" android:exported="false" android:name="androidx.work.impl.background.systemalarm.ConstraintProxy$StorageNotLowProxy">
      <intent-filter>
        <action android:name="android.intent.action.DEVICE_STORAGE_LOW"/>
        <action android:name="android.intent.action.DEVICE_STORAGE_OK"/>
      </intent-filter>
    </receiver>
    <receiver android:directBootAware="false" android:enabled="false" android:exported="false" android:name="androidx.work.impl.background.systemalarm.ConstraintProxy$NetworkStateProxy">
      <intent-filter>
        <action android:name="android.net.conn.CONNECTIVITY_CHANGE"/>
      </intent-filter>
    </receiver>
    <receiver android:directBootAware="false" android:enabled="false" android:exported="false" android:name="androidx.work.impl.background.systemalarm.RescheduleReceiver">
      <intent-filter>
        <action android:name="android.intent.action.BOOT_COMPLETED"/>
        <action android:name="android.intent.action.TIME_SET"/>
        <action android:name="android.intent.action.TIMEZONE_CHANGED"/>
      </intent-filter>
    </receiver>
    <receiver android:directBootAware="false" android:enabled="@bool/enable_system_alarm_service_default" android:exported="false" android:name="androidx.work.impl.background.systemalarm.ConstraintProxyUpdateReceiver">
      <intent-filter>
        <action android:name="androidx.work.impl.background.systemalarm.UpdateProxies"/>
      </intent-filter>
    </receiver>
    <receiver android:directBootAware="false" android:enabled="true" android:exported="true" android:name="androidx.work.impl.diagnostics.DiagnosticsReceiver" android:permission="android.permission.DUMP">
      <intent-filter>
        <action android:name="androidx.work.diagnostics.REQUEST_DIAGNOSTICS"/>
      </intent-filter>
    </receiver>
    <receiver android:directBootAware="false" android:enabled="true" android:exported="true" android:name="androidx.profileinstaller.ProfileInstallReceiver" android:permission="android.permission.DUMP">
      <intent-filter>
        <action android:name="androidx.profileinstaller.action.INSTALL_PROFILE"/>
      </intent-filter>
      <intent-filter>
        <action android:name="androidx.profileinstaller.action.SKIP_FILE"/>
      </intent-filter>
      <intent-filter>
        <action android:name="androidx.profileinstaller.action.SAVE_PROFILE"/>
      </intent-filter>
      <intent-filter>
        <action android:name="androidx.profileinstaller.action.BENCHMARK_OPERATION"/>
      </intent-filter>
    </receiver>
    <service android:directBootAware="true" android:exported="false" android:name="androidx.room.MultiInstanceInvalidationService"/>
  </application>
</manifest>
```

</details>

### 2.6 LevelPlay / Unity / ironSource are gone (positive control included)

EXECUTED on the AAB: `ironsource|unity3d|levelplay` in the manifest dump 0, in the dependency
list 0; class descriptors in `base/dex/classes.dex` / `classes2.dex`: `Lcom/ironsource/` 0 / 0,
`Lcom/unity3d/` 0 / 0, and the same grep finds `Lcom/google/android/gms/ads/` 51 / 25, so the
detector sees ad classes when they are there.

## 3. What expo-store-review adds (W4-11, after the artifact)

No AAB has been built since `87ec519`, so this delta is **INFERRED from source** and corroborated
by one built test APK.

- **Source (INFERRED, read 2026-09-26):** `node_modules/expo-store-review` 57.0.3.
  - `android/src/main/AndroidManifest.xml` is an empty `<manifest>`: no permission, no component.
  - `android/build.gradle` dependencies: `com.google.android.play:review:2.0.1`,
    `com.google.android.play:review-ktx:2.0.0`, `api com.google.android.gms:play-services-base:17.3.0`
    (the app already resolves `play-services-base` 18.0.0, section 2.4).
  - The cached AARs (`~/.gradle/caches/modules-2/…/com.google.android.play/`) show:
    `review-2.0.1.pom` depends on `play-services-basement` 18.1.0, `play-services-tasks` 18.0.2 and
    `com.google.android.play:core-common` 2.0.2; the `review` and `review-ktx` AAR manifests
    declare nothing; `core-common-2.0.2.aar` declares one activity,
    `com.google.android.play.core.common.PlayCoreDialogWrapperActivity` (`exported="false"`),
    and no permission.
- **Corroboration (EXECUTED on a test build, not the shipping artifact):**
  `artifacts/W4-11/apk/arrows-testads-W4-11.apk` (SHA-256 `dac06858…518d0`, gradle release
  build of `e9e9950` plus the W4-11 diff, test ad units, versionCode 6).
  - `aapt2 dump permissions`: the same 12 `uses-permission` lines as 2.1, in the same order.
  - `aapt2 dump xmltree --file AndroidManifest.xml`: `allowBackup=true`, no
    `dataExtractionRules`, no `fullBackupContent`.
  - Every `android:name` in its manifest vs the vc10 dump (`sort | diff`): the only difference
    is `+ com.google.android.play.core.common.PlayCoreDialogWrapperActivity`.
  - Its version stamps add exactly `core-common` 2.0.2, `review` 2.0.1, `review-ktx` 2.0.0 to
    the 11 in 2.4.
- **Unverified:** the next shipping AAB. W7-07 re-dumps the EAS AAB; any difference from 2.1
  plus this section reopens W7-06.

## 4. Mapping: artifact evidence → data type → draft answer

"Collected" and "shared" use Play's meaning (data leaving the device; transfer to a third
party). Purposes for the ad SDK rows are the vendor's list. **Flags-default build** means every
`EXPO_PUBLIC_*` flag unset and the literal constants as committed (`src/featureFlags.ts`:
`REMOTE_KILL_SWITCH = false`, `TELEMETRY_TRANSPORT = false`, `CONSENT_GATE`, `META_BANNER`,
`META_REVIEW_PROMPT` and every other `META_*` off).

VENDOR DOC = <https://developers.google.com/admob/android/privacy/play-data-disclosure>, read
2026-09-26 (page "last updated 2026-09-25"). It says the Google Mobile Ads SDK (Legacy) collects
and shares automatically, for advertising, analytics and fraud prevention: the IP address ("may
be used to estimate the general location"), user product interactions (app launch, taps, video
views), diagnostic information (app and SDK performance), and device and account identifiers
(Android ad ID, app set ID); all encrypted in transit with TLS; ad ID collection is optional for
the developer through the manifest. The app uses the classic (Legacy) SDK (`androidSdk: "classic"`
in app.json, ADMOB-A).

| id | Artifact evidence | Comes from | Data type (Play form) | Collected / shared | Purpose | Optional | Draft answer |
|---|---|---|---|---|---|---|---|
| ev-01 | `play-services-ads` 25.4.0 + `play-services-ads-api` 25.4.0 (2.4); `INTERNET`, `ACCESS_NETWORK_STATE` (2.1); `AdActivity`, `MobileAdsInitProvider`, `AdService`, `OutOfContextTestingActivity`, `NotificationHandlerActivity`, meta-data `com.google.android.gms.ads.APPLICATION_ID` = the owner's app ID (2.5) | react-native-google-mobile-ads 17.1.0 (direct dep) | Location → **Approximate location** (from the IP address) | Yes / Yes | Advertising or marketing; Analytics; Fraud prevention, security, and compliance | No | Declare |
| ev-02 | same as ev-01 | GMA SDK | App activity → **App interactions** (app launch, taps, ad views and clicks, video views) | Yes / Yes | same as ev-01 | No | Declare |
| ev-03 | same as ev-01 | GMA SDK | App info and performance → **Diagnostics** (app and SDK performance) | Yes / Yes | same as ev-01 | No | Declare |
| ev-04 | `play-services-ads-identifier` 18.0.0 (2.4); `com.google.android.gms.permission.AD_ID` (2.1; also `android.permissions` in app.json) | GMA SDK | Device or other IDs → **Android advertising ID** | Yes / Yes | same as ev-01 | No (the app has no in-app switch; the OS reset/delete is not an app choice) | Declare; Advertising ID declaration: **Yes** |
| ev-05 | `play-services-appset` 16.0.1 (2.4) | GMA SDK | Device or other IDs → **app set ID** (same Play data type as ev-04) | Yes / Yes | same as ev-01 | No | Covered by the ev-04 declaration |
| ev-06 | `ACCESS_ADSERVICES_AD_ID`, `ACCESS_ADSERVICES_ATTRIBUTION`, `ACCESS_ADSERVICES_TOPICS` (2.1); `androidx.privacysandbox.ads:ads-adservices(-java)` 1.0.0-beta05 (2.4); `uses-library android.ext.adservices required=false` (2.5) | `play-services-ads-api` AAR manifest declares the three permissions (INFERRED from the cached AAR, read 2026-09-26) | Privacy Sandbox on Android (AdServices ad ID, attribution reporting, Topics). Mapped to **Device or other IDs** (ev-04) and **App interactions** (ev-02); the vendor page lists no separate type | covered by ev-02 / ev-04 | same as ev-01 | No | No extra type drafted. **OWNER/LEGAL CHECK** whether Topics needs its own entry |
| ev-07 | `play-services-measurement-base` / `-measurement-sdk-api` 20.1.2 (2.4), pulled by `play-services-ads-api`; meta-data `DELAY_APP_MEASUREMENT_INIT=true` (2.5) | GMA SDK | none beyond ev-01..ev-05: no Firebase / Analytics SDK is in the build (2.4, no `firebase-*`, no full `play-services-measurement`) | — | — | — | Nothing extra |
| ev-08 | `com.google.android.ump:user-messaging-platform` 4.0.0 (2.4, direct dep) | react-native-google-mobile-ads | none in the flags-default build: UMP is reached only when `CONSENT_GATE` is on (`initAds(CONSENT_GATE ? playerConsentSource() : undefined)` in App.tsx; the gather branch in `initAdMobOnce`, src/ui/ads.tsx; INFERRED from source, jest-pinned in ADMOB-C). The app shows **no consent message** in this build | Not collected (not invoked) | — | — | Nothing now; pending P-1 |
| ev-09 | `com.google.android.play:hsdp` 2.0.1 (2.4), `HsdpShimActivity` and `<queries><package com.android.vending/>` (2.5) | pulled by `play-services-ads-api` (edge in 2.4); the cached `hsdp-2.0.1.aar` manifest declares exactly these (INFERRED) | Not documented in anything read here. Treated as part of the GMA SDK, so its data is whatever ev-01..ev-05 cover | — | — | — | **UNVERIFIED** — owner/legal check against Google's SDK disclosure |
| ev-10 | `play-services-base` 18.0.0, `-basement` 18.9.0, `-tasks` 18.2.0 (2.4); `GoogleApiActivity`, meta-data `com.google.android.gms.version` (2.5) | Google Play services client libraries | none on their own | — | — | — | Nothing extra |
| ev-11 | `WAKE_LOCK`, `FOREGROUND_SERVICE`, `ACCESS_NETWORK_STATE` (2.1); `androidx.work:work-runtime` 2.7.0, `androidx.room:room-runtime` 2.2.5 (2.4); WorkManager services and receivers (2.5) | `play-services-ads-api` → `work-runtime` (edge in 2.4); the cached `work-runtime-2.7.0.aar` declares these permissions (INFERRED) | none: background job scheduling | — | — | — | Nothing extra |
| ev-12 | `INTERNET` (2.1); meta-data `expo.modules.updates.ENABLED=false` (2.5) | the app's own code | The app's own JS makes **no network request** in the flags-default build: `TELEMETRY_TRANSPORT = false` and `REMOTE_KILL_SWITCH = false` are literal constants (src/featureFlags.ts); `expo-updates` is not a dependency (package.json) and OTA updates are disabled in the manifest. Only the ad SDK (ev-01) uses the network | Not collected | — | — | Nothing extra |
| ev-13 | `VIBRATE` (2.1) | the Expo prebuild main manifest (`android/app/src/main/AndroidManifest.xml:5`, generated; INFERRED) | none: haptic feedback | — | — | — | Nothing |
| ev-14 | `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` (`maxSdkVersion 32`) (2.1); `OPEN_DOCUMENT_TREE` query and `FileSystemFileProvider` (2.5) | `expo-file-system` 57.0.6 (a dependency of `expo`) declares all of them in its manifest; the prebuild main manifest repeats the two permissions (INFERRED) | none: the app never requests them and reads no user files (EXECUTED: `grep -rn -E "PermissionsAndroid|expo-file-system|requestPermission" src App.tsx index.ts` finds nothing) | Not collected | — | — | Nothing. Owner option: add both to `blockedPermissions` in app.json (next native build) |
| ev-15 | `android:allowBackup="true"`, no `dataExtractionRules`, no `fullBackupContent` (2.3) | Expo prebuild default | **Android Auto Backup / device-to-device transfer** can copy the app's data (ev-16, ev-17, and the ad SDK's own app-private files) to the user's Google account backup and restore it on reinstall or a new device. The developer has no access to it | Not declared (DRAFT: the transfer is made by Android into the user's own account, and the developer never receives it) | — | — | **OWNER/LEGAL TO CONFIRM** against Play's Data safety help. Excluding the save file would also drop progress backups (ruling W6-2) |
| ev-16 | on-device save: AsyncStorage keys in `Keys` (src/core/saveSystem.ts): level, totals, streaks, sound and theme, the interstitial counter, tutorial stage, daily / collection / review / consent / kill-switch ints | the app | App activity (game progress, settings) that **never leaves the device** except through ev-15 | Not collected | — | — | Nothing |
| ev-17 | on-device telemetry identity: a random install id (`arrows_tel_install_hi/lo`), a cold-start count, JS-fatal counters (`arrows_tel_*`, src/core/saveSystem.ts; W6-05, W6-07) | the app | stored only; with `TELEMETRY_TRANSPORT = false` nothing is sent (ev-12) | Not collected | — | — | Nothing now; pending P-4 |
| ev-18 | **not in the vc10 artifact:** `com.google.android.play:review` 2.0.1, `review-ktx` 2.0.0, `core-common` 2.0.2, `PlayCoreDialogWrapperActivity` (section 3) | expo-store-review 57.0.3 (W4-11) | none in the flags-default build: with `META_REVIEW_PROMPT` off the module is never loaded (src/ui/reviewPrompt.ts lazy `require`; W4-11 device runs: 0 `ReviewService` lines with the flag off). When on, VENDOR DOC <https://developer.android.com/guide/playcore/in-app-review> (last updated 2026-01-30) lists "user-entered data (rating and free-text review)", used for a public Play review | Not collected now | — | — | Nothing now; pending P-6 |
| ev-19 | `<queries>`: `VIEW` + `BROWSABLE` + `https`, `CustomTabsService`, `INSERT` calendar event, `VIEW sms:`, `DIAL tel:` (2.5) | the `play-services-ads-api` AAR manifest declares exactly these (INFERRED) | none: package visibility for opening an ad's link. No `QUERY_ALL_PACKAGES` (2.1) | — | — | — | Nothing |
| ev-20 | absences (2.1, 2.4): no account, sign-in, billing, location, crash-reporting or analytics SDK and no permission for them | — | the app has **no accounts, no sign-in, no purchases**, and no data collection of its own | — | — | — | Supports "no deletion URL needed" and the content rating answers |

### 4.1 Both directions (acceptance 2)

- **Every ad / identifier / Play line in the dumps has a row.** `com.google.android.gms.permission.AD_ID`
  → ev-04. `play-services-ads` → ev-01; `-ads-api` → ev-01 (and ev-06, ev-07, ev-09, ev-11,
  ev-19 for what it pulls in); `-ads-identifier` → ev-04; `-appset` → ev-05; `-base`,
  `-basement`, `-tasks` → ev-10; `-measurement-base`, `-measurement-sdk-api` → ev-07;
  `com.google.android.ump` → ev-08; `com.google.android.play:hsdp` → ev-09;
  `androidx.privacysandbox.ads` and the three `ACCESS_ADSERVICES_*` → ev-06;
  `com.google.android.gms.ads.*` components and meta-data → ev-01 / ev-07;
  `com.google.android.gms.common.api.GoogleApiActivity`, `com.google.android.gms.version` → ev-10.
  `com.unity3d.*` and `com.ironsource.*`: **zero lines** (2.6). The review / core-common
  libraries of the next build → ev-18. Every other permission: `INTERNET` ev-12,
  `ACCESS_NETWORK_STATE` ev-01/ev-11, `WAKE_LOCK` and `FOREGROUND_SERVICE` ev-11, `VIBRATE`
  ev-13, the two storage permissions ev-14, `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` (an
  app-private permission AndroidX Core adds for its own receivers) no data.
- **Every declared type has artifact evidence.** Approximate location → ev-01; App interactions
  → ev-02 (+ev-06); Diagnostics → ev-03; Device or other IDs → ev-04, ev-05 (+ev-06). The
  purposes come from the vendor page, not from the artifact: an artifact shows which SDK ships,
  not what it sends at runtime (not observable here; W7-07 relies on Google's disclosure).

## 5. Draft Data safety answers (the form, in order)

| Question | Draft answer | Rows |
|---|---|---|
| Does your app collect or share any of the required user data types? | **Yes** | ev-01..ev-05 |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (the vendor page: TLS; the app sends nothing itself) | ev-01, ev-12 |
| Do you provide a way for users to request that their data is deleted? | **No** (DRAFT). No accounts; the developer receives no data; on-device data goes with "Clear storage" or uninstall; the Auto Backup copy is managed in the user's Google account; ad data is held by Google under its policy; the ad ID is reset or deleted in Android settings | ev-15, ev-16, ev-20 |
| Location → Approximate location | Collected, shared; not ephemeral; required; Advertising or marketing, Analytics, Fraud prevention, security, and compliance | ev-01 |
| App activity → App interactions | same | ev-02, ev-06 |
| App info and performance → Diagnostics | same | ev-03 |
| Device or other IDs | same | ev-04, ev-05, ev-06 |
| Every other data type (personal info, financial, health, messages, photos, audio, files, calendar, contacts, web browsing, precise location, crash logs, other app activity) | **Not collected** | ev-12..ev-17, ev-20 |
| Independent security review | No | — |
| App content → Advertising ID: does the app use it? | **Yes**: Advertising or marketing, Analytics, Fraud prevention | ev-04 |

"Required vs optional" and "ephemeral" are drafted from the build (no in-app choice, no
ephemeral-only processing is documented). "Diagnostics" vs "Crash logs": the vendor page says
performance information, so Diagnostics is drafted and Crash logs is not. **OWNER/LEGAL TO
CONFIRM** all of section 5 in W7-07.

## 6. Age posture — OWNER TO CONFIRM (W7-07)

| Surface | What it says today | Evidence |
|---|---|---|
| Code, flags-default build | **No child-directed call is made at all.** `CONSENT_GATE` is off, so `initAdMobOnce` skips the privacy calls and `MobileAds().setRequestConfiguration` is never called; the SDK's child-directed tag stays unspecified | src/ui/ads.tsx `initAdMobOnce`; src/featureFlags.ts; INFERRED from source |
| Code, `CONSENT_GATE` on (W7-01 / ADMOB-B) | `setCOPPA(false)` → `setRequestConfiguration({ tagForChildDirectedTreatment: false })` before `initialize()` | src/ui/consent.ts `privacyCallsFor`; src/ui/ads.tsx; jest-pinned order (ADMOB-B) |
| Privacy policy (W7-05) | "The app is not directed at children under 13, and we do not knowingly collect personal information from them." | store/privacy-policy.md, "Children" |
| Play Console target audience (DRAFT) | **13+ only**: 13-15, 16-17, 18 and over. Not 12 and under | from RELEASE.md's earlier answer |
| AdMob console (owner) | The app-level child-directed setting must stay unset, and the max ad content rating should match the app's rating (section 7, row "Ads") | owner check |

All three say "not for children". Unspecified (default build) and `false` (gate on) are both
"not child-directed" to the SDK (INFERRED from the SDK's API). **13+ needs no age-gate UI:**
Play asks for a neutral age screen only when the target audience includes children and older
users together (Families policy, mixed audience); a 13+-only audience has no such requirement
(INFERRED from Play's Families policy; confirm in W7-07). Do not add an age gate to "fix" this.
If the owner picks an audience under 13, W7-01, W7-05, this file and the ad setup all reopen
(Families-certified ads, child-directed tags, no personalised ads).

## 7. Console declarations (DRAFT)

| Declaration | Draft | Evidence / note |
|---|---|---|
| Ads | **Yes, the app contains ads** (interstitial between levels, rewarded for hint and continue; the menu banner only when `META_BANNER` ships) | ev-01; src/ui/ads.tsx |
| Ads content (owner action) | Set the AdMob **max ad content rating** to match an Everyone / PEGI 3 app (for example G) in AdMob → Blocking controls. INFERRED from Play's "Inappropriate ads" policy (ads must suit the app's content rating); the code sets no `maxAdContentRating` | src/ui/ads.tsx (no rating set) |
| Content rating questionnaire (IARC) | Category: Game (casual / puzzle). Violence, fear, sexuality, language, controlled substances, crude humour: **none**. Simulated or real gambling: **none**. Users interact or communicate: **No**. Shares the user's location with other users: **No**. Digital purchases: **No**. Unrestricted internet or web browsing: **No** (ads open links outside the app). Expected result: Everyone / PEGI 3 (INFERRED; IARC decides) | ev-20; PRODUCT.md |
| Target audience and content | **13+** (13-15, 16-17, 18+). Store listing must not appeal to children (see store/listing/play.md) | section 6 |
| App access | All functionality is available without an account | ev-20 |
| Data deletion | No accounts, so no account-deletion URL is needed; the form answer is in section 5 | ev-20 |
| Advertising ID | Yes (section 5) | ev-04 |
| **EU Digital Services Act: trader status** | **OWNER ONLY. A legal status of the owner, not drafted here.** | — |

## 8. Pending: add when the flag ships (input to W7-05 and to the form)

Each item changes the policy and possibly this form **in the same commit that turns the flag on**.

| id | Flag / task | Policy change | Form change |
|---|---|---|---|
| P-1 | `CONSENT_GATE` (ADMOB-C UMP) after the owner publishes the AdMob GDPR message | Describe Google's consent message (UMP); replace the "no consent message" sentence in "Lawful basis"; say a refusal means no ads (ruling W7-3) | Re-read UMP's own data disclosure; ev-08 becomes active |
| P-2 | W7-04 Settings sheet ("Ad privacy choices" → `openAdPrivacyOptions()`) | Add the in-app route to "Your rights" and "Do Not Sell or Share"; add the in-app policy link | none |
| P-3 | `META_BANNER` | Add "a banner on the menu screen" to "Advertising" | none (same SDK, ev-01..ev-05) |
| P-4 | `TELEMETRY_TRANSPORT` (W6-15) | Add the Analytics section from docs/analytics-disclosure-draft.md; remove "the app itself sends nothing" | Add the first-party analytics rows from that draft; ev-17 becomes collected |
| P-5 | `REMOTE_KILL_SWITCH` + a config URL (W6-03) | The config request exposes the IP address and user agent to the config host (docs/remote-config.md) | Re-check whether that is collection |
| P-6 | `META_REVIEW_PROMPT` (W4-11) | Say the app may ask Google Play to show its rating card; what the player writes goes to Google Play | Decide whether to declare ev-18's "user-entered data" |
| P-7 | Share card (W4-12, OFF, not built) | Whatever it shares, if it is built | Re-check |
| P-8 | Any new native dependency | Re-dump the AAB and redo section 4 | same |

Also pending outside any flag: the next shipping AAB must be re-dumped (W7-07) to confirm
section 3, and ADMOB-B's CCPA `rdp` string extra is UNVERIFIED, so no document may promise
"restricted data processing" until it is proven.

## 9. Pre-fix reproduction (RELEASE.md vs the dumps)

RELEASE.md's Data safety block (lines 96-111 at `b082532`, saved as
`artifacts/W7-06/pre-fix-RELEASE-96-111.txt`) answered: Advertising ID collected and shared;
approximate location via IP; encrypted in transit; no deletion mechanism; ads yes; Everyone /
PEGI 3; target audience 13+. It already warned that it was written for LevelPlay. Lines in the
artifact that it did not cover, i.e. answers written from memory:

1. `allowBackup="true"` with no rules (ev-15): the old policy's "never uploaded … uninstalling
   deletes it" is false while Auto Backup is on.
2. App interactions and Diagnostics (ev-02, ev-03): collected by the GMA SDK per Google's page,
   missing from RELEASE.md.
3. App set ID (ev-05) and the three `ACCESS_ADSERVICES_*` permissions (ev-06).
4. `READ/WRITE_EXTERNAL_STORAGE` and `VIBRATE` (ev-13, ev-14): unexplained.
5. The UMP library (ev-08) and the `hsdp` library (ev-09).
6. The vendor itself: RELEASE.md and the old policy named ironSource / Unity LevelPlay; the
   artifact contains only Google's ad SDK (2.6).

## 10. Open questions for the W7-07 legal review

1. **EEA / UK / Switzerland (blocking question).** The flags-default build requests ads,
   personalised by default, with **no consent message** (ev-08; `CONSENT_GATE` off because no
   GDPR message is published, ADMOB-C). Choose before release: publish the message and ship the
   gate with its privacy-options entry (P-1, P-2); or limit distribution; or another route the
   reviewer approves. This file does not claim that the default build meets GDPR / ePrivacy.
2. US state laws: is an email route (the only one the build has) an adequate "Do Not Sell or
   Share" opt-out while the app cannot apply an opt-out to ad requests without the gate?
3. Auto Backup (ev-15): not declared as collection; confirm.
4. Topics / attribution (ev-06) and `hsdp` (ev-09): confirm no separate data type is needed.
5. Required vs optional, ephemeral, and Diagnostics vs Crash logs (section 5).
6. DSA trader status (owner only).
