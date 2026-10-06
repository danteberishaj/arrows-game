# Graphify trial (route experiment, 2026-10-07)

**Question:** can Graphify give agents a reliable, non-stale project memory for this repo?
**Rule followed:** `~/.claude/CLAUDE.md` §10, "A new route is a hypothesis; test it" and "Project memory and caches never
go stale silently". **Owner approval:** trial install approved 2026-10-07.
**Scope:** throwaway worktree of `next-level` at `ace959b`, isolated venv, nothing committed, no adb, emulator, gradle
or prebuild. The only file written in the main checkout is this doc.
**Conditions:** shared host, load average 14-47 during the runs (other sessions were running gradle and an emulator).
All timings below are under that load.

## Verdict: REJECT (as project memory, with or without the guard)

| Measure | Result |
|---|---|
| Accuracy, 12 real questions | **3 correct, 9 partial, 0 wrong**. One partial answer was confidently misleading (`EXTRACTED`, points at an interface instead of the write site). |
| Cost to a correct answer vs grep+read | **median -7.5 % (Graphify costs more)**, range -983 % to +95 %. Totals: 90.4k chars with Graphify vs 81.1k chars baseline. |
| Best case (exact symbol name known, Graphify output only, no completion reads) | median +79.5 %, range -400 % to +98 %. This case is not reachable without first knowing the name, usually from a grep. |
| Staleness, no rebuild | **4 of 4 edits returned the old answer**, exit 0, labelled `EXTRACTED`, with no warning. |
| Built-in freshness check on query/explain | **none**. `built_at_commit` stores HEAD only and is never checked; per-file hashes exist but only drive `update`. |
| Rebuild (`graphify update`) | cold median 21 s (19-77 s, n=3); update after an edit median 23 s (17-42 s, n=4). "Incremental" re-extracts 351 of 650 files every time, so it is no faster than cold. |
| Rebuild trigger rate | 69 commits on `next-level` in the last 7 days (up to 29 a day), plus every uncommitted edit during a task. |
| Disk | venv 120 MB; graph output 17 MB cold, 26 MB once `update` has run (it keeps a 9.5 MB backup folder per day). |

**Why REJECT rather than ADOPT AS MAP or ADOPT WITH GUARD:**
- It is a good *caller map* when you already know the exact symbol (`explain "headerTier()"`: 592 chars, correct, every
  code edge `EXTRACTED`). But it cannot answer *what the code does*: no constant values, no write sites, no gating logic,
  no body text of docs. 9 of 12 real questions still needed a source read, a grep or a rephrased query, and on those the graph output
  was mostly overhead.
- When the question names a string, a value or a concept rather than a symbol (Q5, Q8, Q10, Q12), the BFS `query`
  returns ~6.5k chars of mostly unrelated nodes and the answer still needs a grep.
- The speed audit (`docs/process/speed-audit-2026-10-07.md`) already measured re-reading as a small cost: lessons-file
  reads were about 93k tokens across all 92 agents, and the big reads are files agents must read in full to edit them.
  A ~1-3k-token saving on the minority of "who calls X" questions does not pay for a third-party install, a 23 s rebuild
  after every change and a guard to maintain (§10: projected saving must be at least 3x the cost).
- The guard below works and is cheap (0.3 s), so staleness is solvable. The verdict rests on accuracy and cost, not on
  staleness.

**What would reopen it:** a ledger showing "where is X used / who calls X" questions dominating re-read cost, *and* a
graph that indexes literal values and object-literal methods (see Q5). Then re-run this question set through the guard.

## What was installed, and how it was kept local

- PyPI `graphifyy==0.9.78`. The downloaded wheel's sha256 `8705dc5c5fd38a378115b06c04bcbaa33819b029f8a07c4c05bf457d69a6c935`
  matches the PyPI JSON digest (VERIFIED: `shasum -a 256` vs `pypi.org/pypi/graphifyy/0.9.78/json`). The installed
  `RECORD` is identical to the verified wheel's `RECORD` (VERIFIED: `diff`), so the installed files carry the wheel's hashes.
- `uv venv --python 3.12` + `uv pip install graphifyy==0.9.78`: 30 packages (networkx 3.7, numpy 2.5.3, rapidfuzz 3.14.6,
  tree-sitter 0.25.2 and 24 grammars). Venv: 113 MB after install, 120 MB after first runs (bytecode). uv's download
  cache is the shared `~/.cache/uv`.
- `graphify install` was **not** run. Every invocation went through a wrapper (`g.sh`) that runs
  `sandbox-exec -p '(version 1)(allow default)(deny network*)(deny file-write* (subpath "/Users/gentlegen"))'` under
  `env -i` (no API keys), with a `PATH` that excludes the `claude` CLI and `GRAPHIFY_NO_AUTO_REFRESH=1`. Sandbox positive
  controls: `curl https://pypi.org` failed to resolve and `touch ~/.claude/x` was refused inside it (VERIFIED).
- **No network during builds:** VERIFIED by the sandbox (any attempt would fail; no network or permission error appears
  in any log) plus a code read: `update`, `query`, `explain` and `extract --code-only` have no network path. An `lsof -i`
  spot check during the cold build found no sockets (one sample only: weak on its own).
- **Markdown is parsed locally.** `graphify update` runs `extractors/markdown.py` (headings, links, inline-code mentions;
  no LLM) on `.md`. `graphify extract` without `--code-only` would instead send docs to an LLM backend. Not used.
- **Found in the source, worth knowing before any future use:**
  - every CLI run except install/uninstall calls `_refresh_stale_skills()`, which rewrites any graphify skill already
    installed under `~/.claude/skills`, `~/.agents`, `~/.gemini` etc. (none existed here; disabled by env anyway);
  - `cluster-only` and `label` fall back to the **`claude` CLI as an LLM backend** if no API key is set and `claude` is on
    `PATH` (`llm.py` `generate_community_labels`). That would spend tokens and run a Claude session silently;
  - `graphify claude install` writes `CLAUDE.md` and a PreToolUse hook.
- **Untouched (VERIFIED after all runs):** `~/.claude/settings.json` and `~/.claude/CLAUDE.md` sha256 unchanged; the
  `~/.claude` and `~/.claude/skills` listings unchanged; no file named `*graphify*` under `~/.claude` newer than the install
  marker; no `~/.graphify`, no query log, no skill dirs; no graphify git hooks or config.
- **Main checkout:** its `git status` gained 11 untracked `modules/arrows-board/.../*Contract*.kt` / `*Paths*.kt` files
  during the trial. They are copies of `scripts/art/skin-contract/*.kt` made by another session's contract run (a gradle
  daemon started 01:28). Graphify could not have written them: its sandbox denies every write under `/Users/gentlegen`.

## What it indexed (cold build, worktree at `ace959b`)

- 649 files extracted of 721 tracked; 10 skipped as unclassified (`.patch`, `AndroidManifest.xml`, `.podspec`, ...),
  plus the PNG/WAV assets.
- Files by type: TS 224, Markdown 203, TSX 80, Python 38, MJS 31, **Kotlin 18**, JS 9, CJS 6, Java 5, JSON 4, Swift 3,
  shell 3, Gradle 2, other 4. **Kotlin, TS/TSX, Python scripts and Markdown were all covered.**
- 8,266 nodes (4,188 code, 3,917 Markdown, 119 concept, 42 rationale) and 16,057 edges: 14,347 `EXTRACTED`,
  1,710 `INFERRED`, **0 `AMBIGUOUS`**. Relations: contains 6,805, calls 2,517, imports 2,316, references 2,090, ...
- **Coverage gaps:** 6 Kotlin files had parse errors and were partially extracted (`SkinPaths.kt`: 13 symbols;
  `Art07BeforePaths.kt`: 1). 30 code files yielded no symbols. Methods of object literals (`SaveSystem = {...}`) are not
  nodes. Markdown contributes headings and links only, not body text: `docs/engineering-lessons.md` is 29 nodes.
- Output: `graph.json` 9.2 MB, `graph.html` 0.56 MB, `GRAPH_REPORT.md` 147 KB, `manifest.json` 133 KB, `cache/` 7 MB
  (17 MB total).

## Accuracy (graded against the code at `ace959b`, read by me)

Commands used: `explain "<node>"` when the question names a symbol, otherwise `query "<question>"` (BFS, default
2,000-token budget), then one natural follow-up. Labels are the edge labels on the lines that carried the answer.

| # | Question | Graphify answer (command) | Truth (from the source) | Grade | Labels |
|---|---|---|---|---|---|
| 1 | Where is the tier label computed; which screens use it? | `tierLabel.ts`: `headerTier()` called by `GameScreen()` L934, `menuTier()` called by `HomeScreen()` L81; both reach `displayTier`/`displayTierForArrowCount` (`explain` x2; the `query` was 6.5k chars of noise) | Same: `src/ui/tierLabel.ts` `headerTier` / `menuTier`, core `src/core/displayTier.ts`; GameScreen and HomeScreen | **correct** | EXTRACTED; doc links INFERRED |
| 2 | What calls `generateCampaignLevel`? | `createLevelSession()` L160, `menuTier()` L44 (`explain`) | Same two | **correct** | EXTRACTED |
| 3 | Which files read `META_SKIN_PICKER`? | only `useArrowStyle.ts` (`explain`) | `useArrowStyle.ts` is the only runtime reader, but 7 test files reference or mock the flag and 4 scripts set `EXPO_PUBLIC_META_SKIN_PICKER`. A change based on the graph alone would break tests | partial | EXTRACTED |
| 4 | How is the exit sound gated (`feedbackSoundOn`)? | defined `exitCombo.ts` L19; called by the three `feedback()` variants (`explain`) | Callers right. The gate itself, `soundOn && (event !== 'exit' \|\| EXIT_POP_ENABLED)` with `EXIT_POP_ENABLED = false`, is not in the graph; needs a 12-line read | partial | EXTRACTED |
| 5 | What persists `arrows_gen_switch_level`? | `query` on the key: unrelated nodes (generate-grain.mjs, ...). After guessing `genSwitchLevel`: `stampGenSwitchLevel()` calls `.setGenSwitchLevel()` at **`generatorVersion.ts` L96** | `SaveSystem.setGenSwitchLevel` at `saveSystem.ts` L423 writes `Keys.genSwitchLevel`; called once at boot by `stampGenSwitchLevel` (`App.tsx` L159). L96 is the `GenSwitchSave` **interface** declaration; the object-literal implementation is not a node | partial, **confidently misleading** | EXTRACTED |
| 6 | What draws the cleared-board outline; its timing constant? | `ClearRevealOutline()` in `StaticBoardSurface.native.tsx` L372, path from `maskOutlinePath()`, timing via `clearRevealSlotMs()`, `CLEAR_REVEAL_HOLD_MS` at `gameSessionLifecycle.ts` L34 (`query` + 3 `explain`) | Same locations; values (hold 150 ms, slot `CLEAR_REVEAL_MS` 400 ms, fade-in 150 ms in `artConfig.ts`) are not in the graph | partial | EXTRACTED |
| 7 | Which modules import `react-native-google-mobile-ads`? | `ads.tsx` only (`explain`) | `src/ui/ads.tsx` only (type import L4-8, `require` L616); tests `jest.mock` it, `metro.config.js` names it | **correct** | EXTRACTED |
| 8 | Halloween skin specs and their ids? | files only: `rewardCatalogue.ts` `HALLOWEEN`, `skinSpecs.ts`, `skinCandidates.ts`; `explain pumpkin` gives `skinSpecs.ts` L158 | `pumpkin` 18, `ghost` 19, `candy-corn` 20 (`skinSpecs.ts` L158-174, `HALLOWEEN_BOARD` tints); Mummy/Potion Slime/Little Bat are unregistered candidates (ids 21-23 proposed) | partial | EXTRACTED |
| 9 | Where is the petal balance written? | `rewardLedger.ts` and, among 68 nodes, `initializeRewardLedger`, `recordRewardClear`, `buyReward`, `grantPetalAd`; nothing says which write. `explain PETALS` silently resolved to `PETALS_PER_AD` | `store.setInt('arrows_petals')` in those 4 functions (L128, L158, L185, L237) | partial | EXTRACTED |
| 10 | Which tests cover the header fit? | first `query`: the `HEADER-FIT.md` report sections, not the test; after rephrasing to `headerFit test`: `GameScreen.headerFit.test.tsx` | `src/ui/__tests__/GameScreen.headerFit.test.tsx` (14 tests) | partial (needed a rephrase) | EXTRACTED |
| 11 | What does the Kotlin board view do with skin JSON? | `query`: `ArrowsBoardView`, `SkinPaths`, `SkinMotion`; `explain .setArtSkin()` (name found by reading the class's 53 edges): calls `.clear()`, `.selection()`, `.setSkinConfig()` | `setArtSkin` skips an unchanged JSON string, lets an intent extra override it, parses through the cached `SkinSpec.selection` (`org.json`), logs and disables on a parse error, builds `SkinPaths` + `SkinMotion`, re-applies config, invalidates | partial (map right, behaviour absent) | EXTRACTED |
| 12 | Which docs/lessons mention emulator-5556 gotchas? | 2 report sections whose *headings* contain it (W5-16, W6-02), 2 other report sections (ADMOB-B, POLISH-T5 gotchas), and the `engineering-lessons.md` file node | 123 Markdown files mention it; in the lessons file, 8 entries (L75, L177, L530, L548, L590, L650, L714, L757) | partial | EXTRACTED |

**Confidence labels:** no wrong answer was labelled `INFERRED` or `AMBIGUOUS`; the graph has no `AMBIGUOUS` edges. The
misleading answers (Q5's interface location, Q9's silent fuzzy match, Q3's omission) all carried `EXTRACTED`, the label an
agent would trust most. `INFERRED` edges spot-checked were right (e.g. `SkinOptimizationContract.check()` constructs
`SkinSpec`). An unknown name prints "No node matching" and still exits 0.

## Token cost vs grep+read

**Method.** For each question I recorded the characters an agent must read to reach the full truth in the table above.
- *Baseline:* the natural `git grep -n <term>` (code files, or Markdown for Q12) plus the minimal source excerpts that
  confirm the answer (fixed line ranges).
- *Graphify, realistic:* every Graphify output actually needed, including failed first queries, plus the source reads
  still needed to complete a partial answer.
- *Graphify, best case:* only the decisive `explain`/`query` output, assuming the exact node name was known and no
  completion read was needed.

Tokens are about chars/4. Measured by `cost.sh` in the scratch dir over saved outputs.

| # | Baseline chars | Graphify realistic | Saving | Graphify best case | Saving |
|---|---|---|---|---|---|
| 1 | 7,653 | 8,251 | -8 % | 1,708 | 78 % |
| 2 | 1,845 | 512 | 72 % | 512 | 72 % |
| 3 | 3,145 | 2,372 | 25 % | 342 | 89 % |
| 4 | 1,193 | 1,272 | -7 % | 682 | 43 % |
| 5 | 8,782 | 14,582 | -66 % | 7,141 | 19 % |
| 6 | 14,445 | 10,083 | 30 % | 1,719 | 88 % |
| 7 | 4,598 | 240 | 95 % | 240 | 95 % |
| 8 | 7,673 | 9,183 | -20 % | 234 | 97 % |
| 9 | 18,667 | 10,074 | 46 % | 323 | 98 % |
| 10 | 1,298 | 14,061 | -983 % | 6,485 | -400 % |
| 11 | 6,143 | 12,004 | -95 % | 1,146 | 81 % |
| 12 | 5,624 | 7,759 | -38 % | 6,653 | -18 % |
| **Total / median** | **81,066** | **90,393** | **median -7.5 %** (range -983 % to +95 %) | 27,185 | median +79.5 % (range -400 % to +98 %) |

The whole 12-question baseline is about 20k tokens, so even the best case saves about 13k tokens across 12 questions.

## Staleness test

Edits in the throwaway worktree, none committed: (a) renamed `generateCampaignLevel` to `dealCampaignBoard` (definition
and callers); (b) added `src/ui/graphifyTrialProbe.ts` exporting `graphifyTrialProbe`; (c) deleted
`import { feedbackSoundOn }` from `feedbackFallback.ts` (and its use); (d) `headerTier` now calls
`displayTierForArrowCount` instead of `displayTier`.

| Edit | Asked without rebuilding | After `graphify update` |
|---|---|---|
| (a) rename | `explain generateCampaignLevel()` still answers with 4 edges; `dealCampaignBoard()`: "No node matching" | old name gone; new name has the same 4 edges |
| (b) new file/export | "No node matching" (exit 0) | found, `graphifyTrialProbe.ts` L2 |
| (c) deleted import | still lists `feedbackFallback.ts` as importer and caller (7 edges) | 5 edges, `feedbackFallback` gone |
| (d) body edit | still `--> displayTier() [calls] [EXTRACTED]` | `--> displayTierForArrowCount()` |

**Every stale answer exited 0, carried `EXTRACTED`, and printed no warning.**

**Built-in freshness:** none on the query path. `graph.json` stores `built_at_commit` (HEAD only, unchanged by
uncommitted edits, and not checked by `query`/`explain`). `manifest.json` stores each file's mtime and AST hash, used only
by `update`'s incremental gate. `check-update` only reports a `needs_update` flag that `watch` writes (exit 0 here). The
MCP server reloads `graph.json` when its mtime changes. The Claude PreToolUse hook (`graphify claude install`, not
installed) compares a file's mtime to the graph's and only softens a nudge; it never refuses.

**Incremental update:** `graphify update` made all four answers correct. It re-extracted 351 of 650 files although
4 had changed. Timings, interleaved cold/update runs under load 16-36: cold 21.0, 76.8 and 19.2 s; update after an edit 24.0, 42.0 and 17.1 s, plus a no-change guard rebuild at 22.8 s. The ranges overlap completely, so the incremental path shows no measurable saving over a cold build here (n=3 and n=4, so this is not a precise estimate).

## The guard (prototype, proven)

`/private/tmp/claude-501/-Users-gentlegen-Desktop-Projects-arrows-game/529758e6-3b29-4422-a19a-51e6c72a0675/scratchpad/graphify-trial/graphify-guard.sh`

**How it works.** The stamp holds `git rev-parse HEAD`, the sha256 of `git diff HEAD --binary`, and the sha256 of the
sorted `blob-hash path` list of untracked, non-ignored files (`graphify-out/` excluded). It also pins `graph.json`'s
sha256. `ask` refuses with exit 3 and `STALE: rebuild (<reason>)` on any mismatch. `rebuild` runs `graphify update --force`
and stamps only if the tree did not change during the build. `check` takes 0.26-0.40 s on this repo.

**Proof (executed; log `stale/guard-proof.log` in the scratch dir):**

| Step | Tree state | Result |
|---|---|---|
| Negative control | freshly built + stamped, no edit | `FRESH`, `ask explain` answered (exit 0) |
| Positive | 4 uncommitted edits (a-d) | `STALE: rebuild (uncommitted diff changed; untracked files changed)`, exit 3, no answer |
| Positive | after an unguarded `graphify update` | `STALE: rebuild (...; graph.json changed outside the guard)`, exit 3 |
| Negative control | after `rebuild` (22.8 s), edits still present | `FRESH`; `ask explain dealCampaignBoard()` correct |
| Positive | one new untracked file | `STALE: rebuild (untracked files changed)`, exit 3 |
| Negative control | file removed again | `FRESH` (content-addressed, so it returns to the stamp) |
| Negative control | `touch` only (mtime change, same content) | `FRESH` (no false positive) |
| Positive | one-character edit in a tracked file | `STALE`, exit 3; reverted, then `FRESH` |
| Positive | HEAD moved (detached checkout of `HEAD~1`) | `STALE: rebuild (HEAD ace959bf->b90f910b)`, exit 3; moved back, then `FRESH` |

```zsh
#!/bin/zsh
# graphify-guard.sh: refuse to answer from a Graphify graph that does not match the working tree.
# Rule: ~/.claude/CLAUDE.md section 10, "Project memory and caches never go stale silently".
#
# usage: graphify-guard.sh <repo-dir> stamp            # record the tree the current graph was built from
#        graphify-guard.sh <repo-dir> check            # exit 0 if fresh, 3 + "STALE: rebuild" if not
#        graphify-guard.sh <repo-dir> ask <graphify args...>   # check, then run graphify (query/explain/path...)
#        graphify-guard.sh <repo-dir> rebuild          # graphify update, then stamp (refuses if the tree moved mid-build)
#
# Fingerprint = git HEAD + sha256 of `git diff HEAD --binary` + path and blob hash of every untracked,
# non-ignored file. graphify-out/ is excluded (it is the graph itself). The stamp also pins graph.json's sha256,
# so a graph rebuilt or edited outside this guard is refused too.
set -u
S=${GRAPHIFY_TRIAL_DIR:-/private/tmp/claude-501/-Users-gentlegen-Desktop-Projects-arrows-game/529758e6-3b29-4422-a19a-51e6c72a0675/scratchpad/graphify-trial}
G="$S/g.sh"                       # sandboxed graphify runner (no network, no writes under $HOME)
REPO=${1:?repo dir}; CMD=${2:?command}; shift 2
cd "$REPO" || exit 2
OUT=graphify-out; STAMP=$OUT/.guard-stamp

fingerprint() {
  local head diffsum untracked
  head=$(git rev-parse HEAD) || return 1
  diffsum=$(git diff HEAD --binary --no-ext-diff -- . ":(exclude)$OUT" | shasum -a 256 | cut -c1-64)
  untracked=$(git ls-files --others --exclude-standard -z -- . ":(exclude)$OUT" \
    | while IFS= read -r -d '' f; do printf '%s %s\n' "$(git hash-object -- "$f")" "$f"; done \
    | LC_ALL=C sort | shasum -a 256 | cut -c1-64)
  print -r -- "$head $diffsum $untracked"
}
graphsum() { [[ -f $OUT/graph.json ]] && shasum -a 256 $OUT/graph.json | cut -c1-64 || print none; }

do_stamp() { local fp; fp=$(fingerprint) || return 1; print -r -- "$fp $(graphsum)" > $STAMP; print "stamped: $fp"; }

do_check() {
  [[ -f $STAMP ]] || { print -u2 "STALE: rebuild (no stamp: graph was never built through the guard)"; return 3; }
  local want have
  want=$(<$STAMP); have="$(fingerprint) $(graphsum)"
  if [[ "$want" != "$have" ]]; then
    local -a w h; w=(${=want}); h=(${=have})
    local why=()
    [[ ${w[1]} != ${h[1]} ]] && why+="HEAD ${w[1]:0:8}->${h[1]:0:8}"
    [[ ${w[2]} != ${h[2]} ]] && why+="uncommitted diff changed"
    [[ ${w[3]} != ${h[3]} ]] && why+="untracked files changed"
    [[ ${w[4]} != ${h[4]} ]] && why+="graph.json changed outside the guard"
    print -u2 "STALE: rebuild (${(j:; :)why})"
    return 3
  fi
  return 0
}

case $CMD in
  stamp)   do_stamp ;;
  check)   do_check && print "FRESH" ;;
  ask)     do_check || exit 3; exec "$G" "$@" ;;
  rebuild)
    before=$(fingerprint) || exit 1
    "$G" update "$REPO" --force || { print -u2 "rebuild failed"; exit 1; }
    after=$(fingerprint)
    [[ "$before" == "$after" ]] || { print -u2 "STALE: tree changed during rebuild; not stamping"; exit 3; }
    do_stamp ;;
  *) print -u2 "unknown command $CMD"; exit 2 ;;
esac
```

`g.sh` (the sandboxed runner the guard calls):

```zsh
#!/bin/zsh
# Run graphify sandboxed: no network, no writes anywhere under $HOME, no LLM keys, no claude CLI on PATH.
S=/private/tmp/claude-501/-Users-gentlegen-Desktop-Projects-arrows-game/529758e6-3b29-4422-a19a-51e6c72a0675/scratchpad/graphify-trial
PROFILE='(version 1)(allow default)(deny network*)(deny file-write* (subpath "/Users/gentlegen"))'
exec /usr/bin/env -i HOME="$HOME" TMPDIR="$TMPDIR" LANG=en_US.UTF-8 \
  PATH="$S/graphify-venv/bin:/usr/bin:/bin" \
  GRAPHIFY_NO_AUTO_REFRESH=1 GRAPHIFY_NO_TIPS=1 GRAPHIFY_QUERY_LOG_DISABLE=1 \
  /usr/bin/sandbox-exec -p "$PROFILE" "$S/graphify-venv/bin/graphify" "$@"
```

## Overhead

- **Build:** cold median 21 s (19-77 s, n=3), update median 23 s (17-42 s, n=4), interleaved under load 16-36. 8 AST workers saturate 8 cores for the duration, on a host that also runs gradle and the emulator.
- **Query:** 0.6-1.3 s per `query`/`explain`; guard check 0.3 s.
- **Disk:** venv 120 MB; graph output 17 MB cold; `update` adds a 9.5 MB dated backup folder under `graphify-out/`
  (one per day observed; 26 MB in total).
- **Rebuild rate:** 69 commits on `next-level` in 7 days (2026-09-30..10-07; 29 on 10-06), a median of 5 files each.
  Markdown is indexed, so docs-only commits also invalidate the graph. With the guard, every commit *and* every
  uncommitted edit forces a rebuild before the next query: at least ~10 rebuilds a day at about 23 s, more inside an
  editing task, where the graph is stale after the first edit.

## Risks

- **Silent staleness** (measured above). Without a guard, an edited tree gets confident, wrong answers.
- **Confidently misleading `EXTRACTED` answers**: interface vs implementation (Q5), silent fuzzy name matching (Q9),
  omissions presented as complete (Q3).
- **Coverage holes:** Kotlin parse errors (6 files), object-literal methods, no literal values, Markdown body text not
  indexed.
- **Third-party code with side effects outside the repo:** auto-refresh of installed skills on every run; LLM
  fallback to the `claude` CLI in `cluster-only`/`label`; installers that edit `CLAUDE.md`, `AGENTS.md` and hooks.
- **Process risk:** agents may cite the graph as evidence. A cache is a map, not evidence (§10).
- **Host load:** each rebuild competes with gradle and the emulator on a host already at load 14-47. The first cold
  build attempt died with exit 144 and no output (unexplained; not reproduced in later full-corpus runs).

## What it does not replace

- **Verification evidence.** Review claims still come from the file or the run, per §1 and §6. A graph edge is not
  evidence that code runs, renders or passes a gate.
- **Lessons judgement.** Graphify indexes the lessons file as 29 heading nodes. It cannot say which observation, cause or
  correction applies, or whether an entry is verified. Reading the relevant entry stays mandatory (AGENTS.md).
- **Grep for strings, values and doc bodies** (Q5, Q8, Q12): grep was cheaper and complete.
- **Reading code you are about to change.** The audit's biggest reads (GameScreen.tsx, ads.tsx, ArrowsBoardView.kt) are
  files an editor must read anyway.

## The simpler alternative: a generated lessons index

A script generates an index of `docs/engineering-lessons.md`: one line per `##` entry with its line number, size and
author-assigned area tags (e.g. an `Areas: emulator, capture` line under each heading). A jest test regenerates it and
fails if the committed index differs, which is the same hash-check idea as the guard, with no third-party code.

- **Sizes (measured on the main checkout's file):** lessons file 85,199 bytes, 28 entries; median entry 1.9 KB
  (range 0.8-17.4 KB). The prototype index (`lessons-index-prototype.md` in scratch) is 3.4 KB.
- **Saving estimate:** a typical task needs 1-3 entries. Index plus 2 median entries is about 7.2 KB against 85 KB for a
  full read (about 91 %). For the emulator-5556 question it is 3.4 KB plus 8 entries (14.8 KB), about 79 %. Against
  current practice (15 of 92 agents used grep/sed on the file, about 25 KB each), it saves about 15 KB, or ~4k tokens, per
  agent that consults the lessons. About 60k tokens over the audit window: small, but nearly free.
- **Area tags must be hand-assigned.** Keyword auto-tagging was tried in the prototype and put most entries in most
  areas (8-19 of 28 entries per area), which defeats selection.
- **Compared with Graphify for this purpose:** the index covers the judgement-bearing text Graphify does not index, needs
  no install, rebuilds in milliseconds, and cannot go stale silently once the hash test exists. The speed audit (E7)
  already rated the saving under 0.3 h, so this is optional housekeeping, not a route experiment.

## Artifacts (scratch dir, not in the repo)

`/private/tmp/claude-501/-Users-gentlegen-Desktop-Projects-arrows-game/529758e6-3b29-4422-a19a-51e6c72a0675/scratchpad/graphify-trial/`:
`graphify-guard.sh`, `g.sh`, `cost.sh` + `cost.csv`, `q/` (every Graphify output graded), `stale/` (stale and after-update
outputs, `guard-proof.log`), `timing-reps.log`, `lessons-index-prototype.md`, `graphify-venv/` (kept). The throwaway
worktree was removed after the trial.
