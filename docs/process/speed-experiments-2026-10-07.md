# Process speed experiments, phase 2 (2026-10-07)

(Draft in progress; the summary table is filled in at the end.)

## E2: early-stop rule for A/B/A perf series (offline replay)

### Pre-registration (written 2026-10-07T00:17:38Z, 02:17:38 CEST, before any archived series outcome was opened)

Rule **E2-R1**. It is fixed here and is not tuned after the replay.

- **Unit.** A series is one archived perf comparison: per-run values of the gate metric(s) its own report used, an arm
  label per run (A = base/old, B = new; N = same-APK null arm where the series had one), in recorded run order.
- **Look schedule.** Look after every completed block (one run of each arm, in recorded order), starting when each
  compared arm has **k_min = 3** runs.
- **Null spread δ at a look.** If the series has its own null measurement (an A/A or same-APK arm), δ is the spread the
  original report used for it, recomputed on the runs seen so far. Otherwise δ = max(range(A), range(B)) of the runs
  seen so far (the within-arm spread). Nothing below the instrument's resolution counts as a shift (§6).
- **Stop for effect.** At a look, metric decided "shift" if |median(B) − median(A)| > δ AND the A and B ranges do not
  overlap, and the same holds in the same direction at **m = 2 consecutive looks**.
- **Stop for futility.** At a look, metric decided "no shift" if |median(B) − median(A)| ≤ δ/2 AND the ranges overlap,
  for m = 2 consecutive looks.
- **Absolute gates** (a metric judged against a fixed threshold, e.g. p95 ≤ budget): decided when every arm's running
  median sits on the same side of the threshold by more than δ for m = 2 consecutive looks; verdict pass/fail as the
  original.
- **Series stop.** The series stops at the first look where every gated metric is decided; otherwise it runs to its
  recorded end, where the verdict is the original's.
- **Early-stop verdict.** The decided state of every gated metric, mapped to the series' original verdict vocabulary
  (e.g. "no regression" = all relative metrics "no shift" or B better; "regression" = any metric shifted worse).
- **Adoption criterion.** ADOPT only if EVERY series keeps its original verdict AND the total runs saved is > 0 with a
  median saving of at least one block per series. Any flip = REJECT, recorded with the rule and the flipping series.
- **What is reported per series:** original n (runs per arm), early-stop n, verdict kept yes/no, and the stop reason.
