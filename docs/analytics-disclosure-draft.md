# Analytics disclosure — DRAFT — NOT LEGALLY REVIEWED

This is input for W7-05 (privacy policy rewrite) and W7-06 (Play Data safety
reconciliation). It is **not** itself a policy change, not a Play Console
entry, and not a legal opinion. `store/privacy-policy.md` and
`docs/privacy-policy.html` are unedited by this task; `git diff --stat`
against this task's commit shows nothing under `store/` or
`docs/privacy-policy.html`.

## Why this can't wait for W7

`store/privacy-policy.md:14` currently reads:

> The app has no accounts, no sign-in, and collects no personal information
> itself.

That sentence is true today (nothing in the shipped app sends anything
anywhere) and **must stop being true, in the published policy, no later than
the same release that turns the W6-14/W6-15 telemetry endpoint on.** This
document is the schema-derived input for that rewrite — not a decision to
rewrite it now, and not a claim that the sentence is already wrong.

## 1. Proposed policy text for a new "Analytics" section

Draft language (W7-05 owns the actual wording and placement):

> **Analytics.** The app sends anonymous gameplay analytics — which levels
> are started and finished, taps and misses within a level, hearts lost,
> session length, and which ads were shown, not shown, or blocked — to our
> own server. This is different from the advertising data described above:
> it is not shared with any ad network, and it is processed by us
> (first party), not by a third party.
>
> Each event carries a per-install id generated on your device, not the
> Google Advertising ID. This id lets us tell "the same install played
> twice" from "two different installs" without identifying you personally.
> If you restore this app's data to a new device (for example, an Android
> phone upgrade using Auto Backup), that new device keeps the same install
> id — restoring does not create a new one.
>
> We keep raw analytics events for **180 days**, then delete them.
> Aggregated, non-per-install statistics derived from them may be kept
> longer. `// OWNER-PICKED STARTING VALUE — needs an owner yes or a new
> number before W7-05 ships this`
>
> To ask us to delete analytics tied to your install, contact us at the
> address in the Contact section below.

The "contact us" line above reuses `store/privacy-policy.md:46-48` verbatim
rather than inventing a new contact path:

> Questions about this policy: **ddante.berishaj1@gmail.com**

## 2. Field-by-field Play Data safety mapping

One row per `EventSchema` field in `src/telemetry/events.ts`, plus one row
for the install id (see the note under the table — the install id is
deliberately **not** an `EventSchema` field; `TelemetryEnvelope` excludes it
by design, per `events.ts:148-149` and `docs/telemetry-identity.md`, W6-05).

Every row: **Collected = Yes**, **Shared = No** (first-party processor, no
third party ever receives these events), **Optional = No** (the app has no
analytics opt-out UI yet — consent UI is W7-03, out of scope here; this is
listed as an open question below), **Purpose = Analytics**, unless a row's
cell says otherwise.

| Event | Field | Data safety category | Purpose |
|---|---|---|---|
| `app_open` | `cold` | App activity → App interactions | Analytics |
| `app_open` | `sessionIndex` | App activity → App interactions | Analytics |
| `app_open` | `appVersion` | App info and performance → Diagnostics | Analytics |
| `app_open` | `bucket` | App activity → App interactions | Analytics |
| `screen_view` | `screen` | App activity → App interactions | Analytics |
| `level_start` | `levelIndex` | App activity → App interactions | Analytics |
| `level_start` | `arrowCount` | App activity → App interactions | Analytics |
| `level_start` | `shapeName` | App activity → App interactions | Analytics |
| `level_start` | `heartsMax` | App activity → App interactions | Analytics |
| `level_start` | `mode` | App activity → App interactions | Analytics |
| `level_end` | `levelIndex` | App activity → App interactions | Analytics |
| `level_end` | `mode` | App activity → App interactions | Analytics |
| `level_end` | `outcome` | App activity → App interactions | Analytics |
| `level_end` | `taps` | App activity → App interactions | Analytics |
| `level_end` | `tapsExit` | App activity → App interactions | Analytics |
| `level_end` | `tapsBlocked` | App activity → App interactions | Analytics |
| `level_end` | `tapsGhost` | App activity → App interactions | Analytics |
| `level_end` | `tapsMiss` | App activity → App interactions | Analytics |
| `level_end` | `heartsLost` | App activity → App interactions | Analytics |
| `level_end` | `heartsLeft` | App activity → App interactions | Analytics |
| `level_end` | `heartsMax` | App activity → App interactions | Analytics |
| `level_end` | `durationMs` | App activity → App interactions | Analytics |
| `level_end` | `hintsUsed` | App activity → App interactions | Analytics |
| `level_end` | `continuesUsed` | App activity → App interactions | Analytics |
| `session_end` | `durationMs` | App activity → App interactions | Analytics |
| `session_end` | `levelsStarted` | App activity → App interactions | Analytics |
| `session_end` | `levelsCleared` | App activity → App interactions | Analytics |
| `session_end` | `lastLevelIndex` | App activity → App interactions | Analytics |
| `ad_request` | `format` | App activity → App interactions | Analytics |
| `ad_request` | `placement` | App activity → App interactions | Analytics |
| `ad_result` | `format` | App activity → App interactions | Analytics |
| `ad_result` | `placement` | App activity → App interactions | Analytics |
| `ad_result` | `outcome` | App activity → App interactions | Analytics |
| `ad_reward` | `placement` | App activity → App interactions | Analytics |
| `ad_reward` | `earned` | App activity → App interactions | Analytics |
| `error` | `kind` | App info and performance → Crash logs | Analytics |
| `error` | `nameMessageHash` | App info and performance → Crash logs | Analytics |
| `error` | `screen` | App info and performance → Crash logs | Analytics |
| `error` | `count` | App info and performance → Crash logs | Analytics |

That is 39 rows, one per `EventSchema` field. `TelemetryEnvelope`'s own
fields (`name`, `ts`, `seq`, `sessionIndex`, `bucket`, `schemaVersion`,
present on every event) are not `EventSchema` fields either (same exclusion
as the install id) and are not individually listed; `ts` and `schemaVersion`
carry no category of their own — a timestamp and a version number are
metadata about the record, not collected user data — and are noted here for
completeness rather than given a row.

The one row the brief asks for beyond `EventSchema` itself:

| Field | Data safety category | Purpose |
|---|---|---|
| Install id (transport-attached; `identity.ts`, not an `EventSchema` field) | Device or other IDs | Analytics |

For this row: **Collected = Yes** (attached only when the W6-14 transport
sends). **Shared = No.** **Optional = No** (same open question as above).
Restoring the app's data (Auto Backup) carries this id to a new device
rather than resetting it (`docs/telemetry-identity.md`) — that is a fact
about the id's lifetime, not a new collection event, but it is worth the
Data safety form's own note if the form has room for one.

**No row above is "Advertising ID."** The schema has no field for the
Google Advertising ID; that identifier is already disclosed separately in
`store/privacy-policy.md`'s existing Advertising section, as collected by
the third-party Unity LevelPlay/ironSource SDK, not by this first-party
analytics channel. This document does not change that disclosure.

## 3. The kill-switch config request (separate from the analytics endpoint)

This is the `RemoteConfig` fetch (W6-02/W6-03), not the telemetry endpoint —
it deserves its own disclosure line because it starts sending before
telemetry does. Per `docs/remote-config.md`'s privacy note:

- Every cold start sends one HTTP GET to the config host (once W6-03 turns
  the switch on).
- **The host receives the device IP address and the user agent in its
  ordinary access logs, and nothing else** — the app adds no identifier,
  query string or body to this request.
- React Native's networking keeps a shared cookie jar, so this host must
  not set cookies on the config file response — a cookie set here would
  attach itself to other requests from the same app, including telemetry
  ones (`docs/remote-config.md`, read from React Native's networking setup,
  not measured).
- This IP exposure needs its own line in the rewritten policy and its own
  Data safety row (Device or other IDs, transient/log-only, not stored) —
  W7-05 and W7-06 own writing it in; this document only supplies the fact.

## 4. Endpoint data rules W6-15 must enforce

These are requirements on the telemetry-ingestion endpoint itself, derived
from this schema and from the remote-config precedent above. W6-15 is where
they get implemented; this document is where they get written down before
that implementation exists, so review of W6-15 can check the server against
them:

1. **No IP address written to storage.** The endpoint may see the caller's
   IP (any HTTP server does), but it must not persist it in any log, table,
   or file it controls beyond whatever ephemeral access log the hosting
   platform itself keeps outside the app's control.
2. **No cookies.** The response must not set a cookie — same shared-cookie-
   jar reasoning as the config host above, and because a cookie would be an
   identifier this disclosure does not account for.
3. **A 204 response.** The endpoint acknowledges receipt with an empty
   `204 No Content`, not a body that could carry a fresh identifier back to
   the client.
4. **Reject an event whose `schemaVersion` is unknown to the endpoint**, per
   `TelemetryEnvelope.schemaVersion` (`events.ts:155`, currently `1` per
   `telemetry.ts:59`). This is a correctness rule as much as a privacy one:
   an unknown, unrejected schema version could carry fields this disclosure
   was never written against.

## 5. Open questions for the legal reviewer

1. **Retention.** Is 180 days for raw events (§1) acceptable, or does the
   reviewer want a different number, a shorter number for a specific field
   (e.g. `error.nameMessageHash`), or a stated aggregation cutoff? It is
   marked `OWNER-PICKED STARTING VALUE` above because no one has picked it
   yet in a binding way.
2. **"Optional = No" on every row.** The app has no analytics opt-out
   toggle today (W7-03, consent UI, is explicitly out of scope for this
   task). Is shipping first-party analytics with no opt-out, ahead of any
   consent UI, acceptable for this release, or does W7-03 need to land in
   the same release as W6-14/W6-15?
3. **Install id classification.** Is "Device or other IDs" the right Play
   category for an app-generated, non-resettable-by-the-user install id
   that never includes the Google Advertising ID, or does Play's form want
   it under a different bucket given it is not a hardware identifier?
4. **Auto Backup carrying the install id across devices.** Does the
   restore behavior in `docs/telemetry-identity.md` need its own sentence in
   the published policy beyond the draft text in §1, given the current
   policy's "stored only on your device" framing (`store/privacy-policy.md:10`)
   will otherwise read as contradicting it?
5. **Children's policy interaction.** `store/privacy-policy.md`'s existing
   Children section says the app is not directed at children under 13. Does
   adding a first-party analytics id (even without the Advertising ID)
   require any Families-policy-specific carve-out or additional disclosure?
6. **DSA trader declaration and the actual Play Console entry.** Both are
   explicitly out of scope here (W7-06 prepares the declaration; W7-07 is
   where the owner enters it) — confirming that boundary, not asking the
   reviewer to do that work early.
7. **Kill-switch IP exposure wording.** §3's fact (IP + user agent in
   access logs, no app-added identifier) needs reviewer sign-off on where it
   belongs in the rewritten policy and whether "access logs" is precise
   enough language for Play's form, or whether it needs to name the hosting
   platform.
