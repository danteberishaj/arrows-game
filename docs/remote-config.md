# Remote config: the kill switch for ads and telemetry

Client: `src/config/remoteConfig.ts` (W6-02). Gate: `src/ui/adGate.ts`. Hosting: W6-03
(owner-blocked). This file is the operator's reference for the one JSON file the app fetches.

## What it can and cannot do

- It can only turn things **off**: all ads, interstitials, rewarded ads, or the telemetry
  transport.
- It cannot turn anything on beyond what the build already does. It cannot change pacing
  (`GAMES_PER_INTERSTITIAL`), cooldowns, caps, grace periods, sample rates or A/B assignment.
  Owner ruling O-3 keeps pacing as shipped, and ruling W6-4 cut every "enable" and tuning key.
- **Config values only.** The file carries booleans and a version number. Never use this channel to
  download or run code: that violates Google Play's Device and Network Abuse policy.

## Build switches

| Switch | Where | Committed value | Effect |
|---|---|---|---|
| `REMOTE_KILL_SWITCH` | `src/featureFlags.ts` | `false` | While `false`, no request is made, and every getter returns "not killed", even when kill bits are persisted. |
| `REMOTE_CONFIG_URL` | `src/config/remoteConfig.ts`, from `process.env.EXPO_PUBLIC_REMOTE_CONFIG_URL ?? ''` (Expo inlines it at bundle time) | `''` | While empty, the switch behaves as if it were `false`. W6-03 compiles in the real URL. |
| `REMOTE_CONFIG_MAX_BYTES` | `src/config/remoteConfig.ts` | `4096` (OWNER-PICKED STARTING VALUE) | A larger body (by `Content-Length` or by UTF-8 byte count) is rejected before `JSON.parse`. |
| `REMOTE_CONFIG_TIMEOUT_MS` | `src/config/remoteConfig.ts` | `3000` (OWNER-PICKED STARTING VALUE) | The request is aborted after this long, and a late answer is discarded. |

A perf-harness build (`EXPO_PUBLIC_PERF_LEVEL` set) never makes the request.

## The file

```json
{
  "configVersion": 3,
  "adsEnabled": true,
  "interstitialsEnabled": true,
  "rewardedEnabled": true,
  "telemetryEnabled": true
}
```

| Key | Type | Default when missing | Meaning of a literal `false` | When the value is wrong |
|---|---|---|---|---|
| `configVersion` | safe integer ≥ 1 | none: the whole file is ignored | Not applicable | `0`, a negative number, a fraction, a string such as `"2"`, or a number above 2^53−1: the **whole file is ignored** and the cached state stays. |
| `adsEnabled` | boolean | enabled | No `LevelPlay.init` (no contact with the ad network), no interstitial, and rewarded reports "not ready" | Anything other than a literal `false` (for example `"false"`, `0` or `null`) leaves ads **enabled**. |
| `interstitialsEnabled` | boolean | enabled | No interstitial. Rewarded is unaffected. | Same rule: only a literal `false` acts. |
| `rewardedEnabled` | boolean | enabled | Rewarded reports "not ready", so the player sees "No ad available right now — Retry is free". No hint and no heart is granted. Interstitials are unaffected. | Same rule. |
| `telemetryEnabled` | boolean | enabled | The telemetry transport stays off (the consumer is W6-14). It has no effect on ads. | Same rule. |

- **Unknown keys are ignored.** Adding a key cannot break an older build.
- A body that is not JSON, a JSON array, or a JSON value other than an object is ignored.
- A non-2xx status, a network error or a timeout leaves the cached state unchanged.
- A parser bug cannot enable anything, because only a literal `false` acts.

## The version rule (monotone)

- A file is accepted only when its `configVersion` is **strictly higher** than the version the
  device last accepted. A lower or equal version is ignored.
- So a stale CDN or browser copy cannot undo a newer kill.
- **To change anything, publish a higher version.** To re-enable after a kill, publish the next
  version with the feature `true` (or the key removed).
- A device that has never fetched has version 0, so the first published file should use
  `configVersion: 1`.

## When a change reaches a device

- The app fetches once per cold start, after saved data has loaded. The fetch never blocks the
  first screen.
- The accepted state is persisted in two int keys: `arrows_rc_kill_bits` (bit 0 ads, bit 1
  interstitials, bit 2 rewarded, bit 3 telemetry) and `arrows_rc_version`. Neither key is part of
  `resetProgress()`.
- **A kill fetched mid-session** applies to the next ad decision in that session. A loaded rewarded
  ad turns "not ready" at once. If `LevelPlay.init` already ran in that session, the SDK stays
  initialised, but it shows nothing.
- **A cached kill** applies from the first ad decision of the next cold start, even offline.
  `LevelPlay.init` is not called: `App.tsx` starts ads only after the saved data has loaded and the
  persisted bits have seeded the kill-switch getters.
- **A re-enable** fetched mid-session starts the blocked `LevelPlay.init` in the same session.
  Otherwise it starts on the next timed or app-active init retry, or on the next cold start.
- The measured time from publish to device is W6-03's to record here, against the real host.

## Recovery and rollback

- **Stuck kill** (for example the host was deleted after a kill was published): devices keep the
  last accepted bits, so ads stay off. That costs revenue, but it fails safe for players. To
  recover, host the file again with a higher `configVersion` and every feature `true`.
- **Client rollback:** ship a build with `REMOTE_KILL_SWITCH = false`. Its getters ignore the
  persisted bits, so every feature returns to its compiled behaviour. The bits are not deleted, so
  a later build with the flag back on restores the last accepted state.

## Privacy note (input for W6-13 and W7-05)

- Every cold start sends one HTTP GET to the config host (once W6-03 turns the switch on).
- The request exposes the **device IP address**, the user agent and the request time to that host
  and to its CDN.
- The app adds no identifier, query string or body. React Native's networking keeps a shared cookie
  jar, so the host must not set cookies on this file (read from React Native's networking setup, not
  measured).
- The IP exposure still has to be covered by the privacy policy and the Play Data safety form before
  the switch ships ON (W6-03, W7-07).
