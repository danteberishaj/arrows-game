# Crash reporting

## Android native crash stacks in an R8 release

**Conclusion: readable after retrace.** The raw release crash names the kept
`ArrowsBoardView.setVisibleMask$lambda$3` method, but reports only an R8 map id and position and
also contains an obfuscated synthetic frame. Retrace restores the real source file and line:
`ArrowsBoardView.kt:114`.

This was verified on 2026-09-19 with an arm64 release APK built with R8 8.12.14 and a throwaway
`IllegalStateException("w6-08 symbolication probe")`. The synchronous throw specified by the
probe was caught by Expo Modules' prop wrapper, so the final throwaway probe posted the same
exception to the main queue from `setVisibleMask`. That preserved the code path while making the
exception process-fatal and therefore eligible for Android's crash buffer.

### Build and mapping

The release APK was built from `android/` after `df -h /` reported 14 GiB available:

```bash
env -u CI -u ARROWS_PERF_BUILD \
  ANDROID_HOME="$HOME/Library/Android/sdk" \
  ./gradlew :app:assembleRelease \
    -PreactNativeArchitectures=arm64-v8a --no-daemon --console=plain
```

- APK: `android/app/build/outputs/apk/release/app-release.apk`
- APK SHA-256: `7b02dc81896b4fdc0d077fb1bfa5c458716158244f9d694e3a6e982589423359`
- R8 mapping: `android/app/build/outputs/mapping/release/mapping.txt`
- Mapping SHA-256: `1a9260a547c7f726e5292611ef935b5b72f664649afb84a59b7607080da03d6b`
- R8 map id: `dfb19bc088dadedee66f4f74a7cfe49bd69d825211cbf69dd27ade70132764cb`

The build directory was removed after verification. The exact mapping used for this retrace is
retained as `artifacts/W6-08/device-fatal-probe-mapping.txt` with the same SHA-256.

### Authentic device crash

The APK was installed and launched only on `emulator-5556`. After entering the game screen, the
crash buffer was captured with:

```bash
~/Library/Android/sdk/platform-tools/adb -s emulator-5556 logcat -b crash -d \
  2>&1 | tee artifacts/W6-08/device-crash-buffer-raw.txt
```

The raw crash includes:

```text
FATAL EXCEPTION: main
Process: com.danteb.arrows, PID: 5925
java.lang.IllegalStateException: w6-08 symbolication probe
    at com.danteb.arrows.board.ArrowsBoardView.setVisibleMask$lambda$3(r8-map-id-dfb19bc088dadedee66f4f74a7cfe49bd69d825211cbf69dd27ade70132764cb:5)
    at com.danteb.arrows.board.ArrowsBoardView.c(r8-map-id-dfb19bc088dadedee66f4f74a7cfe49bd69d825211cbf69dd27ade70132764cb:1)
    at i0.b.run(r8-map-id-dfb19bc088dadedee66f4f74a7cfe49bd69d825211cbf69dd27ade70132764cb:1)
```

The raw stack is only partly readable: it names the kept board class and lambda method, but it
does not name the Kotlin source file or source line, and its synthetic runnable is obfuscated.

### Retrace

The authentic crash-buffer file was retraced with the mapping produced by the same build:

```bash
java -cp "$HOME/.gradle/caches/modules-2/files-2.1/com.android.tools.build/builder/8.12.0/e9309f368b4153b13bfcfe4da1036141f4db8cd/builder-8.12.0.jar" \
  com.android.tools.r8.retrace.Retrace \
  android/app/build/outputs/mapping/release/mapping.txt \
  artifacts/W6-08/device-crash-buffer-raw.txt
```

The retraced stack includes the real class, method, file, and line:

```text
java.lang.IllegalStateException: w6-08 symbolication probe
    at com.danteb.arrows.board.ArrowsBoardView.setVisibleMask$lambda$3(ArrowsBoardView.kt:114)
    at android.os.Handler.handleCallback(Handler.java:938)
```

The full output is `artifacts/W6-08/device-crash-buffer-retraced.txt`.

### Production bundle mapping

The production `bundleRelease` check from the same W6-08 work found the R8 map in the AAB:

```text
27905127  01-01-1981 01:01   BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map
```

That embedded map's SHA-256 matched that build's local `mapping.txt`. This proves the locally
built AAB carries its mapping. Play Console server-side deobfuscation remains a separate W6-09
device/service check.

## JavaScript fatal crash reporting

### What is recorded

After save hydration, the app wraps React Native's global `ErrorUtils` handler. For a fatal JavaScript
error it attempts to persist three integers before delegating to React Native's previous handler:

- the number of pending fatals;
- the unsigned 32-bit FNV-1a hash of `name + ':' + message`;
- the last screen (`1` splash, `2` menu, `3` game).

The raw error name, message and stack are never persisted or emitted. On a later cold start the app
emits one `error` event with `kind: 'js_fatal'`, the pending count, and the last fatal's hash and
screen, then resets the pending count. If several fatals accumulate, only the last hash and screen
survive.

### Measured Android coverage

Coverage depends on `HydratedIntStore`'s microtask-scheduled AsyncStorage write reaching native
storage before the fatal process ends. On `emulator-5556` (`sdk_gphone64_arm64`, API 31), the W6-07
release-path probe observed:

**0/10 cold relaunches drained a record after 10/10 observed JavaScript fatals.**

Therefore this mechanism has **no observed Android fatal-capture coverage with the current store on
this emulator**. It remains best-effort code for a future synchronous store or a platform where the
write happens to land; this result must not be described as working crash reporting.

#### Exact build and measurement commands

The pre-fix reproduction used a temporary `HomeScreen` Play-button throw and a real Gradle release
build. The disk check ran immediately before the build:

```sh
df -h /
npx expo run:android --variant release --device fleet_floor_api31
/Users/gentlegen/Library/Android/sdk/platform-tools/adb -s emulator-5556 install android/app/build/outputs/apk/release/app-release.apk
```

Gradle completed `assembleRelease`; Expo CLI's later Metro startup hit the sandbox's watcher limit,
so the generated APK was installed directly. The post-fix probe was JavaScript-only: a temporary
Play-button throw plus a temporary release console sink were bundled as optimized Hermes bytecode
over that Gradle release host and debug-signed for emulator installation:

```sh
artifacts/W6-06/scripts/repack-apk.sh \
  /Users/gentlegen/Desktop/Projects/arrows-game \
  /private/tmp/W6-07-host-release.apk \
  artifacts/W6-07/survival-probe.apk \
  false
/Users/gentlegen/Library/Android/sdk/platform-tools/adb -s emulator-5556 uninstall com.danteb.arrows
/Users/gentlegen/Library/Android/sdk/platform-tools/adb -s emulator-5556 install artifacts/W6-07/survival-probe.apk
/Users/gentlegen/Library/Android/sdk/platform-tools/adb -s emulator-5556 shell pm clear com.danteb.arrows
/Users/gentlegen/Library/Android/sdk/platform-tools/adb -s emulator-5556 shell am start -W -n com.danteb.arrows/.MainActivity
sh artifacts/W6-07/run-survival-trials.sh
```

For each trial, `run-survival-trials.sh` cleared logcat, tapped Play, required exactly one
`ReactNativeJS` fatal marker, force-stopped the already-fatal package so the next launch was
unambiguously cold, relaunched, and counted emitted `js_fatal` events. The summary and per-trial
filtered logs are in `artifacts/W6-07/survival-summary.txt` and
`artifacts/W6-07/trial-*-logcat.txt`.

### Not covered

- non-fatal JavaScript errors;
- JavaScript fatals whose AsyncStorage write does not land (all 10 emulator trials above);
- Android ANRs, which Google Play reports without this app context;
- native crashes, covered separately by W6-08/W6-09;
- any iOS crash path;
- fatal-write survival on physical devices, which remains unverified and may differ from the
  emulator.
