# Telemetry decision rules

Written before any event has ever been emitted (W6-04 defines the schema in
`src/telemetry/events.ts`; W6-06/W6-11/W6-14 are the tasks that will actually
call `Telemetry.emit` and send anything). The point of writing this now is
the one the brief states: a metric argued over after the data exists gets
re-argued to fit whatever answer someone wanted. This document fixes, in
advance, which fields answer which question, what the answer cannot tell
you, and a starting sample size / window for each — so the only thing left
to decide once data exists is the owner's threshold, not the method.

**Status of the underlying code, as of 2026-09-17:** no code emits any of
these events yet. Every row below describes what the rule computes _once
wiring lands_, from the field semantics `events.ts` and its comments commit
to. If a later task wires an event differently than its doc comment implies
(for example, which outcome an ad blocked by the remote kill switch reports),
that is a discrepancy between code and this document, not between this
document and reality — re-check the wiring task's report before trusting a
number this document produces.

**Track A scope.** Every row below is about legibility (does the tutorial
teach), density/curve (does difficulty rise), clearable fraction (hearts
left, out_of_hearts rate) and first sessions / return. None is about
"puzzle depth" or an ordering mechanic — Track A (owner ruling) has neither.

## The join key: install id is deliberately not an `EventSchema` field

Several rows below need to group events "by install" (a fraction of
installs, a per-install before/after comparison). The join key for that is
the per-install id `identity.ts` packs into `SaveSystem`'s int keys
(`docs/telemetry-identity.md`, W6-05). `TelemetryEnvelope` in `events.ts`
deliberately does **not** carry it — the comment at `events.ts:148-149` says
only the transport (W6-14) attaches it, and only when it sends. So:

- The "event fields used" column in every row below lists only fields that
  are actually inside `EventSchema` or `TelemetryEnvelope`, per the
  acceptance criterion, and grepping those names in `events.ts` is the check
  in the table at the end of this document.
- Where a row needs to group by install, that requirement is called out
  separately as "join key: install id (transport-attached, not an
  `EventSchema` field)" — it is infrastructure the analysis needs, not a
  schema field, and it is not counted against the "only fields present in
  `events.ts`" criterion.
- Per `docs/telemetry-identity.md`, a restored install (Auto Backup onto a
  new device) keeps the same install id and the same `sessionIndex`
  counter — it does not look like a new install. Every row that counts
  "installs" or "first app_open" inherits that: a phone upgrade before a
  player's first clear counts as zero new installs, not one, which slightly
  undercounts distinct devices. This is stated once here and referenced by
  row rather than repeated in every "what this cannot tell" cell.

## Decision rows

### Row 1 — W1: does the tutorial (level 0) teach?

The brief names two sub-metrics for this decision. The first cannot be
computed from the schema as written; see the note below the table before
using this row.

| | |
|---|---|
| **Event fields used** | `app_open.cold`; `TelemetryEnvelope.sessionIndex`; `level_end.levelIndex`; `level_end.outcome` |
| **Join key** | install id (transport-attached, not an `EventSchema` field) |
| **Computation** | For each install, find its first-ever `app_open` (`cold === true` and `TelemetryEnvelope.sessionIndex === 1`). Numerator = count of those installs whose event stream in that same session-index-1 session also contains a `level_end` with `levelIndex === 0` and `outcome === 'cleared'`. Denominator = count of installs with such a first `app_open` in the window. |
| **Minimum sample size** | 200 qualifying first-`app_open` installs in the window. `// OWNER-PICKED STARTING VALUE` |
| **Time window** | Trailing 14 days. `// OWNER-PICKED STARTING VALUE` |
| **Action for each result** | Report the measured fraction, plus the level-0 outcome breakdown (`cleared` / `out_of_hearts` / `abandoned`) as counts, to the owner. This row does not set a pass/fail threshold (non-goal) — it exists so the owner compares the measured fraction against their own bar instead of guessing at it. |
| **What it cannot tell** | Why a non-clearing install failed (one misread vs many); whether an install that eventually cleared level 0 struggled first, since this only checks whether a `cleared` `level_end` exists in that session, not how it was reached; distinct devices are slightly undercounted for a player who upgrades phones before ever completing level 0 (Auto Backup restore note, above). |

**Dropped sub-metric (pre-flight finding F36, binding).** The brief's other
W1 metric — "level-0 `tapsBlocked` before the first `tapsExit`" — cannot be
computed. `level_end.tapsBlocked` and `level_end.tapsExit` are **totals for
the whole level attempt** (`events.ts:77-78`), not a sequence of individual
taps in order. There is no field in `EventSchema` that records the order
taps happened in, or a timestamp per tap, so "before" is not answerable from
this schema. Per this task's own acceptance criterion, the resolution is
either to add an ordered/timestamped tap field to `events.ts` in the same
PR, or to drop the row. **Decision (recorded in the W6-12+W6-13 report):**
dropped, not added. Adding an ordering field changes `EventSchema` (schema
version bump, new emission-site work) beyond a docs-only task whose Files
list is a single new document, and level-0's `cleared`-fraction metric above
already answers the same underlying decision ("does the tutorial teach")
without it. If a future task adds an ordered tap log for another reason,
this row should be revisited.

### Row 2 — W3: is the level-1 on-ramp too hard or too easy? (joint W1/W3 re-measurement)

| | |
|---|---|
| **Event fields used** | `level_end.levelIndex`; `level_end.heartsLost`; `level_end.durationMs` |
| **Computation** | For `levelIndex` 0 through 4, compute the distribution (median and p90) of `heartsLost` and `durationMs` per level, plus the `out_of_hearts` share of `outcome`. Compare level 1 against level 0's own distribution (its immediate predecessor, not a fixed constant) — "too hard" reads as a level whose `heartsLost`/`out_of_hearts` distribution sits well above level 0's; "too easy" reads as one indistinguishable from level 0 on both `heartsLost` and `durationMs`. |
| **Minimum sample size** | 500 `level_end` events per level in the window. `// OWNER-PICKED STARTING VALUE` |
| **Time window** | Trailing 14 days. `// OWNER-PICKED STARTING VALUE` |
| **Action for each result** | Report the five per-level distributions and the level-0-vs-level-1 comparison to the owner; this row does not set the too-hard/too-easy cutoff (non-goal). |
| **What it cannot tell** | Why hearts were lost (arrow-count jump vs a specific shape being ambiguous — `level_start.arrowCount` and `shapeName` are not part of this row); how much `hintsUsed`/`continuesUsed` (present in `level_end` but not named by this row) masked a true difficulty spike by letting a player skip past it; whether a single confusing shape, not a genuine difficulty rise, drives the whole level's numbers — per the measured-game-design-truths memory, 4 shapes are 71% of content, so a level's aggregate can be dominated by whichever shape it happens to draw. |

### Row 3 — W3: does the curve rise?

| | |
|---|---|
| **Event fields used** | `level_end.levelIndex`; `level_end.taps`; `level_end.heartsLost` |
| **Computation** | Group `levelIndex` into bands of 5 (0-4, 5-9, 10-14, …). `// OWNER-PICKED STARTING VALUE` (band width). Compute the median `taps` and median `heartsLost` per band. A rising curve is monotonically non-decreasing medians band over band; report any band whose median is at or below an earlier band's. |
| **Minimum sample size** | 200 `level_end` events per band in the window. `// OWNER-PICKED STARTING VALUE` |
| **Time window** | Trailing 30 days (bands beyond the first few will be sparse sooner than 14 days covers, given the game-design-truths memory note that all levels ship at flat difficulty today). `// OWNER-PICKED STARTING VALUE` |
| **Action for each result** | Report the per-band medians and flag any non-rising band pair to the owner; this row does not decide what counts as an acceptable flat stretch (non-goal). |
| **What it cannot tell** | Whether a flat or falling band is a genuine content problem or an artifact of shape distribution (as row 2); whether players are using hints/continues (not named by this row) to push through a band that is actually harder than its `taps`/`heartsLost` numbers show, since a hint can lower `taps` without the level being easy; `arrowCount` (a `level_start` field, not used here) is a more direct difficulty knob than levelIndex and this row does not measure it. |

### Row 4 — W4: does the daily bring players back?

| | |
|---|---|
| **Event fields used** | `level_end.mode`; `level_end.outcome`; `TelemetryEnvelope.sessionIndex`; `TelemetryEnvelope.ts` |
| **Join key** | install id (transport-attached, not an `EventSchema` field) |
| **Computation** | Split installs into two cohorts over the window: cohort A cleared at least one `level_end{mode: 'daily', outcome: 'cleared'}`; cohort B never did. For each install in each cohort, find the calendar date (derived from `TelemetryEnvelope.ts`, not from `sessionIndex` — see below) of its daily clear (cohort A) or of a matching reference session (cohort B), and check whether that install has any event with `sessionIndex` at least 2 higher, recorded on a later calendar date. Compare the two cohorts' return fractions. |
| **Minimum sample size** | 300 installs per cohort in the window. `// OWNER-PICKED STARTING VALUE` |
| **Time window** | Trailing 14 days for cohort assignment; a 7-day look-forward for the "did they come back" check. `// OWNER-PICKED STARTING VALUE` |
| **Action for each result** | Report both cohorts' return fractions to the owner; this row does not set the margin that counts as "the daily works" (non-goal) — that is a threshold decision. |
| **What it cannot tell** | Causation: a player already inclined to return more may also be more likely to play the daily, so a higher cohort-A fraction is correlational, not proof the daily caused the return. `sessionIndex` counts cold starts, not calendar days — two cold starts on the same day both increment it, so "sessionIndex ≥ 2 higher" is not by itself "came back on a later day"; the calendar-date check on `TelemetryEnvelope.ts` is required and is part of the computation above, not optional. Per the Auto Backup note, a device-swap install keeps its `sessionIndex` history, so a restored install's "return" is not distinguishable from the original device's — this cannot inflate cohort A vs B differently, since restore is independent of daily-clearing, but it is still a source of noise this row cannot separate out. |

### Row 5 — Ads: shown vs not-ready vs killed per placement

| | |
|---|---|
| **Event fields used** | `ad_request.format`; `ad_request.placement`; `ad_result.format`; `ad_result.placement`; `ad_result.outcome` |
| **Computation** | For each (`format`, `placement`) pair, denominator = count of `ad_request` events; numerator breakdown = count of matching `ad_result` events by `outcome` (`shown`, `not_ready`, `killed`, `display_failed`, `dismissed`). Report each outcome's share of the denominator per pair. |
| **Minimum sample size** | 500 `ad_result` events per (`format`, `placement`) pair in the window. `// OWNER-PICKED STARTING VALUE` |
| **Time window** | Trailing 7 days (ad fill and kill-switch state can change fast; a longer window would smear a kill-switch flip across the reporting period). `// OWNER-PICKED STARTING VALUE` |
| **Action for each result** | Report the outcome breakdown per pair to the owner: a `killed` share worth checking against `docs/remote-config.md`'s kill-bit state for the reporting window (a spike lines up with an intentional flip, not a silent regression); a high `not_ready` share as an SDK-fill question, not a code question; a low `shown` share as a revenue-impact flag. No numeric threshold is set here (non-goal). |
| **What it cannot tell** | Revenue or eCPM — no such field exists in `ad_result`. Whether a `killed` outcome came from the global kill bit or the format-specific bit (`RemoteConfig`'s four `KillBit`s per W6-02) — `ad_result.outcome` only has one `'killed'` value, not which bit caused it; that distinction, if ever needed, would have to come from correlating the `killed` timestamp against `docs/remote-config.md`'s change log, not from this event alone. Reward completion (`ad_reward.earned`) is a separate event this row does not use, so it says nothing about whether a shown rewarded ad was actually watched to completion. |

## Field-by-field check against `EventSchema`

Every field named above, grepped directly in `src/telemetry/events.ts`:

| Field | Found in `events.ts` |
|---|---|
| `app_open.cold` | yes — line 57 |
| `TelemetryEnvelope.sessionIndex` | yes — line 153 |
| `TelemetryEnvelope.ts` | yes — line 151 |
| `level_end.levelIndex` | yes — line 73 |
| `level_end.outcome` | yes — line 75 |
| `level_end.taps` | yes — line 76 |
| `level_end.tapsExit` | yes — line 77 (named only in the dropped sub-metric) |
| `level_end.tapsBlocked` | yes — line 78 (named only in the dropped sub-metric) |
| `level_end.heartsLost` | yes — line 81 |
| `level_end.durationMs` | yes — line 84 |
| `level_end.mode` | yes — line 74 |
| `ad_request.format` | yes — line 95 |
| `ad_request.placement` | yes — line 96 |
| `ad_result.format` | yes — line 99 |
| `ad_result.placement` | yes — line 100 |
| `ad_result.outcome` | yes — line 101 |

Fields mentioned only in a "what it cannot tell" cell (`level_start.arrowCount`,
`level_start.shapeName`, `level_end.hintsUsed`, `level_end.continuesUsed`,
`ad_reward.earned`) are real `EventSchema` fields too (`events.ts:67-68,
85-86, 107`) — they are named to state a non-inference, not as inputs to a
computation, so they are listed here for completeness rather than in the
per-row tables above.

The install id used as a join key in rows 1 and 4 is intentionally **not**
in this table: it is not an `EventSchema` field (see "The join key" section
above), so it is not subject to the grep check the acceptance criterion
describes.
