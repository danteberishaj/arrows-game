# Obsidian-style memory for agents and the owner (route experiment, 2026-10-08)

**Question from the owner (approved 2026-10-08):** can "Claude + Obsidian" give agents a better memory of past lessons,
gotchas, owner rulings and decisions than what we use today? Is there value for the owner (browsing the memory as a
graph)? Added mid-trial by the owner: **Hindsight** (`vectorize-io/hindsight`).
**Rule followed:** `~/.claude/CLAUDE.md` §10 (route experiments; "Project memory and caches never go stale silently") and
§6 (attack the verdict). Same protocol as [graphify-trial-2026-10-07.md](graphify-trial-2026-10-07.md) and
[agent-memory-tools-2026-10-07.md](agent-memory-tools-2026-10-07.md), but with **memory** questions instead of code
questions, because Obsidian is a notes tool.
**Scope:** throwaway vault copies in the session scratchpad; nothing committed; nothing registered in Claude config; no
emulator, adb or builds. This doc is the only file written in the repo.
**Conditions:** shared host, **load average 9-60** during the runs (other sessions building); free disk 8.2-9.5 GiB (98-99 %
used). All timings are under that load. Tags: **[measured]** executed and read; **[read]** from source or docs, not
executed; **[inferred]** reasoning, not executed. Judgement calls are marked **RULING**.

## Answer in six lines

1. **No Obsidian route beats our baseline for agents enough to adopt.** The best route measured is not a tool: a
   refined grep that prints *file + frontmatter `description`* instead of every matching line (total −41 %, median per
   question +40 % saving, 12/12 correct, no index, cannot go stale). [measured]
2. **MCPVault (headless Obsidian MCP) — REJECT for agents.** 9/12 correct, 3 partial, no wrong; it reads files live so it
   was 3/3 fresh, but realistic cost to a full answer was total −15 % / median per question −7 % (costs more per typical
   question), plus ~10.9k chars of tool schemas per session and 0.5-11 s per search under load. [measured]
3. **basic-memory — REJECT.** With default settings its first sync **rewrote 528 of 536 notes** (added `permalink`,
   re-wrapped YAML, changed the `modified:` timestamp format, dropped the final newline). Pointed at
   `~/.claude/projects/*/memory`, it would have edited every agent memory file. In a configuration that leaves the notes untouched, it answered 10/12 (2 partial) at about the baseline's cost (total +1.2 %, median per question −31 %), with ~36.7k chars of fixed overhead per session, a 16-minute first index, a stale `read_note` window after edits, and no working graph. [measured]
4. **In-house backlink + description index (`memidx.py`, stdlib, 153 lines) — REJECT as a route, keep the stamp-guard
   pattern.** 11/12 from the index (one question needed a grep fallback); total −37 %, median +11 %; it is beaten by the
   refined grep, which needs no index. With its fingerprint check it is 3/3 fresh; with the check off it served 3/3 stale.
   [measured]
5. **Hindsight — NOT TRIALLED.** Every note must pass through an LLM fact-extraction step (`retain`); no local LLM is
   installed, the local path needs PyTorch/MLX plus a multi-GB model on a 99 %-full shared disk, and the cloud path would
   send all 536 notes (~2.7 MB, ~0.7 M tokens) to an LLM provider. Its Claude Code plugin hooks **every prompt**
   (`UserPromptSubmit`) and every turn (`Stop`). Owner decision needed (§6). [read]
6. **Owner browsing: YES, on a one-way copy.** Opening Obsidian 1.4.5 on a copy of the 536 notes left every note
   **byte-identical** (sha256 before/after); Obsidian only wrote `.obsidian/` (6 files). The risks are in-app actions
   (rename/move with link updating, Properties edits, note composer, daily notes), not opening. Safe setup in §7. [measured]

## 1. Corpus, questions and ground truth

**Vault (copy, not symlink) [measured]:** `scratchpad/obsidian-trial/vault/`, 536 Markdown files, 2.7 MB:
- `memory/<project>/` — all 492 notes from `~/.claude/projects/*/memory/*.md` (45 projects, folder names without the
  leading `-Users-gentlegen-`, because `find` here is a `bfs` wrapper that misreads leading-dash names, §11);
- `docs/arrows-engineering-lessons.md` — the working-tree copy (88.7 KB, uncommitted edits included; RULING: the agent
  reads the working tree);
- `playbooks/` — the 43 tracked `skills/**/*.md`, `retired/*.md` and `README.md` of agent-playbooks at `7078906`.
- Shape: 517 of 536 notes carry a frontmatter `description`; 594 `[[wikilinks]]`, 16 unresolved, **49 pointing at a
  name shared by several notes** (45 notes are called `MEMORY.md`, 11 `SKILL.md`, and tondo has two copies of several notes).

**Questions (12, five projects plus the playbooks).** Ground truth was taken by reading the source notes myself.

| # | Question | Ground truth (source) |
|---|---|---|
| Q1 | Why was Graphify rejected, with what numbers? | 3/12 correct (9 partial); 4/4 stale after edits, exit 0, no warning; cost median per question −7.5 %, **total +11.5 %** (`playbooks/retired/README.md` PROC-901; evidence `graphify.md`) |
| Q2 | zsh glob gotcha and fix? | `rm -rf $TMPDIR/metro-* …` aborts on a no-match glob, so the Metro cache is silently not cleared; use `find … -exec rm` and print the remaining count (`capture-harness-gotchas-t5.md`) |
| Q3 | Which emulator serial must arrows-game use, and why? | `adb -s emulator-5556`; other Claude sessions (geoguesser) boot emulators on this host, `adb devices` can list two, an unqualified call hits the wrong one (`shared-host-contention.md`) |
| Q4 | Owner ruling on the exit sound? | 2026-10-06: no exit sound at all, keep the other sounds; `EXIT_POP_ENABLED = false` in `src/ui/exitCombo.ts`; exit haptic kept (`sound-design-2026-09-30.md`) |
| Q5 | What wiped saves on another project? | Planet Drop `SaveService.Load` checked the SHA-256 checksum before the schema version; any added field mismatched → `Defaults()` → silent wipe; fix `afa1d9e`, bump `CurrentSchemaVersion`, full-`Load()` legacy test (`save-additive-schema-safety.md`) |
| Q6 | The Play/release AAB recipe our playbooks require? | STORE-002: committed + tagged tree (`git describe --exact-match`), clean build (`prebuild --clean`), both arm ABIs, upload certificate matches, versionCode increased, sha256 differs from the previous AAB (`store-release/SKILL.md`, `release-recipe.md`) |
| Q7 | Cause of the geoguesser nativeEvent crash? | `event.nativeEvent` read inside a `setState` updater; RN nulls it after the handler returns; FATAL on every round start; capture the value in the handler (`never-read-nativeevent-inside-a-state-updater.md`) |
| Q8 | The ad-unit test proof? | STORE-001: before installing a non-release build, count in the bundle (UTF-8 and UTF-16LE) test id ≥1, every production id 0, a known-present control ≥1; the "Test Ad" label is not proof (`store-release/SKILL.md`, `ads-proof.md`) |
| Q9 | Which skins did the owner approve for Halloween+? | Mummy A + Potion Slime B (ids 21/22, Halloween book, 20 petals); Little Bat deferred until a head-ears field exists (`reward-path-2026-10-04.md` l.83; lessons "Shipped follow-up") |
| Q10 | Which Vercel cache rule bills edge requests? | A CDN cache HIT still bills an edge request; only a request the browser never makes is free → hashed assets `immutable`, HTML `max-age=0, must-revalidate` (`vercel-cost-cache/SKILL.md` intro + VERC-001) |
| Q11 | The range-inside-range perf gate problem? | "Every B run inside A's range" fails identical builds (8 vs 8: 4 of 5 metrics, ~23 %/metric); gate on a same-APK null spread + replicated median shift or a permutation test (`range-inside-range-criterion-invalid.md`) |
| Q12 | The hook experiment's success rule? | FG-WAIT-R1: foreground Bash calls ≥300 s per 1,000 down ≥50 % in both strata (arrows-game, geoguesser), workaround detector and zsh `=` null flat; workarounds rising = remove; judged 2026-11-06 (`agent-process/SKILL.md` l.64-65; `speed-audit-2026-10-07.md`) |

**Protocol (same as the earlier trials) [measured]:**
- First query per question is written from the question's words, without hindsight, in each tool's own query language.
- Stopping rule: read the most plausible hit from the listing (title, path, excerpt or description only); stop when it
  answers; otherwise one more query or read. Grades are against the ground truth above.
- **Realistic cost** = characters of every query output and read, failed ones included. "Full" adds the reads still
  needed when a route stopped at a partial answer. Script: `cost.sh` → `cost.csv`, stats `stats.py`.
- Same decisive reads across routes (whole memory note; a line range for the 89 KB lessons file and the playbook SKILLs),
  so the differences are discovery cost.

## 2. Routes and setup

| Route (official source) | What it is | Version, verification | Install, disk | Per-session schema overhead | Invasiveness |
|---|---|---|---|---|---|
| **Baseline:** grep + read | `grep -rn -i` over the vault, then Read | n/a | none | 0 (built-in tools) | none |
| **Refined grep (control)** | `grep -rli KW \| … grep -m1 '^description:'`: one line per file with its description, then Read | n/a | none | 0 | none |
| **(d) `memidx.py`** (in-house, stdlib) | map of note `name`/`description`, `##`/`###` headings with line numbers, wikilink out/backlinks; **fingerprint check on every query** (sha256 over every note's content) → rebuild, or refuse with exit 3 (`--strict`) | sha256 `4a4a5096…` frozen before any question was run | 0; index 450 KB | 0 (Bash) | writes only its index, outside the vault |
| **(a) MCPVault** `bitbonsai/mcpvault`, npm `@bitbonsai/mcpvault` (formerly `mcp-obsidian`; 1,680 stars, pushed 2026-10-02, MIT) | headless MCP server over the vault files; 18 tools; `search_notes` reads every `.md` on each call (OR terms, BM25 rerank, 5 results, ±21-char excerpt) | 0.16.0; tarball sha1 `65a739a7…` and sha512 `HTGAi5eA…` match the npm registry; sha256 `419b32ce…` | 9 s, 81 packages, 22 MB | **10,867 chars** of tool schemas (18 tools), no server instructions | none found: no network or telemetry code in `dist/`; tools include write/patch/move/delete (delete goes to the system Trash) |
| **(b) Local REST API + MCP bridge** `coddingtonbear/obsidian-local-rest-api` 5.4.0 + `MarkusPfundstein/mcp-obsidian` 0.2.3 | needs Obsidian.app running with the plugin | — | — | — | **NOT TRIALLED** (below) |
| **(c) basic-memory** `basicmachines-co/basic-memory`, PyPI 0.23.2 (4.1k stars, pushed 2026-10-07, **AGPL-3.0**) | Markdown + SQLite FTS + local vector search (fastembed `bge-small-en-v1.5`), MCP server | wheel sha256 `a1679a16…` = PyPI digest | 159 s, 165 packages, venv 405 MB + 403 MB uv cache + 64 MB model | **35,577 chars** (21 tools 34,731 + instructions 846), and its instructions tell the agent to call `recent_activity` first (+1,153) | **default sync rewrites notes** (§4); file watcher; telemetry (Logfire) off by default [read] |
| **Hindsight** `vectorize-io/hindsight`, PyPI `hindsight-all` 0.10.2 (46.8k stars, pushed 2026-10-07, MIT) | LLM-extracted facts, entities and "observations" in PostgreSQL (embedded `pg0`) + vectors + reranker; server with MCP endpoint | — | — | — | **NOT TRIALLED** (§6) |

**Why (b) was skipped [measured + read]:**
- Local REST API 5.4.0 declares `minAppVersion` **1.13.1**; this Mac has Obsidian **1.1.9** (installer) with a 1.4.5 app
  package in the user's Obsidian folder. Running it needs an Obsidian update (the global app or its user folder) or an
  old plugin version with a different API.
- Enabling any community plugin means turning off Restricted mode in the GUI (state kept in the app profile), i.e. GUI driving.
- Its search is substring search over the same files MCPVault reads directly, plus an always-running app. RULING: no
  retrieval capability (a) lacks, so it was not worth an app update on a shared machine.

**Isolation [measured]:**
- Every server and CLI ran under `sandbox-exec` (`sb.sh`): no outbound IP network (unix sockets allowed for stdio), no
  writes under `/Users/gentlegen`, `env -i`, config and caches pointed into scratch.
- One network step was allowed: basic-memory's first index downloaded the embedding model (64 MB) from Hugging Face,
  still with home writes denied.
- **The sandbox caught writes outside scratch:**
  - fastembed first tried to write its Hugging Face cache under the home folder ("Operation not permitted"; fixed with `HF_HOME` in scratch);
  - Python's macOS URL cache tried `~/Library/Caches/org.python.python` during that download (denied, harmless);
  - on every basic-memory server start, onnxruntime logged "Failed to persist telemetry device ID; using an in-memory
    identifier" (most likely a refused write [inferred]; no outbound network was possible, so nothing was sent).
- The default-configuration run (`vault-bm`, the 528-rewrite evidence) was stopped during its embedding phase after
  the model download failed; the rewrites happened in the sync phase before that.
- basic-memory's HTTP transports default to `--host 0.0.0.0` (all interfaces); only stdio was used here. [read]
- MCP servers were driven by a stdio client (`mcpc.py`), never registered in any Claude config.

## 3. Accuracy and cost (12 questions)

**Accuracy [measured; graded against §1].** C = correct, P = partial, W = wrong.

| # | Baseline grep | Refined grep (file + description) | memidx | MCPVault | basic-memory (hybrid search) |
|---|---|---|---|---|---|
| Q1 Graphify | C (PROC-901 line in the hits) | C | C (PROC-901 heading) | **P**: top hit `speed-audit` note gives 3/12, 4/4 stale, "+7.5 %" with no total; that note mislabels the median as the cost | **P** (same top hit) |
| Q2 zsh glob | C | C | C | C (2nd query not needed; 3rd hit) | C |
| Q3 emulator | C | C | C (6th of 12 hits, chosen by description) | **P**: `shared-host-contention` not in the top 5; `codex-delegation-setup` gives the serial and only part of the why | C (hit shows the "Why" line) |
| Q4 exit sound | C | C | C | C | C |
| Q5 checksum | C | C | C | C | C |
| Q6 AAB recipe | C (after a 16.7k-char hit list) | C | C | C (`release-recipe.md`) | C |
| Q7 nativeEvent | C | C | C | C | C |
| Q8 test-ads proof | C | C | C | C | C |
| Q9 Halloween+ | C | C | **miss** → grep fallback → C (the word is only in the body) | C after a 2nd query | C |
| Q10 Vercel edge | C | C | C | **P**: top hit `deploy-caching` has request counts, not "a CDN HIT still bills" | **P**: top hit titled `SKILL` (no path); `read_note("SKILL")` → "Note Not Found"; fell back to `deploy-caching` |
| Q11 range-in-range | C | C | C | C | C |
| Q12 hook rule | C | C | C | C (`speed-audit` note states FG-WAIT-R1 in full) | C |
| **Total** | **12 C** | **12 C** | **11 C + 1 via grep fallback** | **9 C, 3 P, 0 W** | **10 C, 2 P, 0 W** |

- **No confidently wrong answer** in any route. The closest is Q1 through the `speed-audit` memory note, which every
  search route ranks first: it says "realistic token cost +7.5 %", which is the median per question with the sign
  flipped in words, and omits the +11.5 % total. That is a **memory-quality** finding, not a tool finding (§9).
- **Completeness probe** (one known-answer query, `emulator-5556` → must list `shared-host-contention.md`) passed in
  **every** session of every route: MCPVault 7/7, basic-memory 7/7 (including the timing runs), memidx and grep by
  construction. No silent empty
  answers like Serena's.

**Realistic cost (characters an agent reads; tokens ≈ chars/4) [measured; `cost.csv`].** Totals and median per
question are both shown, as the 2026-10-07 review asked.

| Route | Total chars, 12 Q (vs baseline) | Median per-question saving vs baseline (range) | Median chars per question | Fixed cost per session |
|---|---|---|---|---|
| Baseline grep + read | 77,768 | 0 | 4,503 | 0 |
| **Refined grep: file + description line, then read** | **45,889 (−41.0 %)** | **+40.1 %** (−4 to +65) | **2,512** | 0 |
| memidx (index + reads; Q9 includes the grep fallback) | 48,832 (−37.2 %) | +11.2 % (−73 to +79) | 3,622 | 0 (+ one line of instructions) |
| MCPVault, as answered (3 partial) | 58,686 (−24.5 %) | −6.2 % (−160 to +77) | 4,260 | **10,867** (18 tool schemas) |
| MCPVault, to a full answer | 65,810 (−15.4 %) | −7.0 % (−211 to +77) | 4,282 | 10,867 |
| MCPVault, full, if the vault path were short | 58,205 (−25.2 %) | +5.5 % [computed: each hit carries an `obsidian://` URI with the 150-char scratch path; rewritten to a 22-char path] | | 10,867 |
| basic-memory, as answered (2 partial) | 76,816 (−1.2 %) | −30.9 % (−298 to +68) | 5,715 | **35,577** (21 tool schemas 34,731 + server instructions 846) **+ 1,153** (`recent_activity`, which its instructions tell the agent to call at session start) |
| basic-memory, to a full answer | 78,729 (+1.2 %) | −30.9 % | 5,715 | 36,730 |

- **Net per session** for a typical session that asks one or two memory questions: MCPVault adds ~11k chars, basic-memory
  ~37k chars, before any question is asked. Claude Code may defer MCP tool schemas until first use; then the fixed cost
  is the tool names only [inferred: this harness defers many MCP tools; not measured for these servers].
- **The saving is the output shape, not the tool.** One line per file with its curated `description` is what both the
  index and the refined grep print; the refined grep needs no index, no install and cannot go stale. This repeats the
  2026-10-07 finding ("the saving comes from asking a narrow question") for notes instead of code.
- The baseline's worst cases (Q6 `aab` 16.7k chars, Q8 11.8k, Q3 10.5k) are broad keywords printing every matching
  line. The refined grep cuts exactly those.

## 4. Staleness and completeness

**Edits (script `stale/edit.py`, applied to a fresh copy per route, no re-index) [measured]:**
- **E1 change a fact:** `sound-design-2026-09-30.md` body and `description` now say the owner picked "clip E (swish)",
  `EXIT_POP_ENABLED = true` (truth before: no exit sound).
- **E2 add a note:** `obsidian-trial-probe-2026-10-08.md` with the token `zebracorn-7731` and a link to `[[shared-host-contention]]`.
- **E3 delete a link:** remove `Related: [[detector-needs-positive-control]]` from `range-inside-range-criterion-invalid.md`.

| Route | E1 changed fact | E2 new note | E3 deleted link | Query-time freshness check? |
|---|---|---|---|---|
| Baseline / refined grep | fresh | fresh | fresh | n/a: reads the files every time |
| memidx `--no-check` (what a naive cache does) | **stale** (old description served) | **stale** ("no matches") | **stale** (old backlink still listed) | — |
| memidx default | fresh: printed `STALE: vault changed since build; rebuilt before answering` | fresh | fresh | **yes**: content fingerprint of every note on every query; `--strict` refuses with exit 3 instead |
| MCPVault, edits made mid-session | fresh | fresh | fresh (text search no longer lists the note) | n/a: no index, reads every file per search |
| basic-memory, edits mid-session, asked again **+0.5 s** | **stale**: `read_note` returned the **old body and old description** (it serves the note from its database copy, `note_content`) | fresh (search found it) | **stale** (old note still listed) | **no**: a file watcher re-indexes in the background |
| basic-memory, same session, **+20 s** | fresh | fresh | fresh | |
| basic-memory, fresh session after a second edit set made while it was stopped | fresh | fresh | fresh | startup sync (session start-up 14-19 s) |

**Graph features [measured]:** MCPVault has no backlink tool (`wiki_link` resolves forward only). basic-memory's
`build_context("memory://detector-needs-positive-control")` returned **0 results** in the safe configuration, because its
relations are addressed by permalinks, which that configuration disables to keep the notes untouched. So the only route
that exposed backlinks was memidx (and Obsidian itself, §7).

**Re-index time [measured; load 22-60]:**
- memidx: build median 1.0 s (0.9-9.3, n=3) after the first build; the first build took 29 s while basic-memory was
  embedding. Check alone: median 1.05 s (0.39-7.23, n=3). Under light load the first three builds took 0.19-1.2 s.
- basic-memory: first index **979 s** (16.3 min), including the 64 MB model download and 536 notes embedded; the FTS
  part finished in about 3 min, embeddings took the rest. `reindex` after 2 edited notes and 1 new one: **177 s**, and it re-embedded all 538 notes ("538 entities embedded"), so the CLI's "incremental" path is not incremental for vectors. Inside a running server the watcher handled the same edits in under 20 s.
- MCPVault and grep: none.

**Is the §10 stamp guard needed? [measured + inferred]**
- MCPVault and grep: no; nothing is cached.
- memidx: the guard is built in and passed the invalidation test (3/3 refused or rebuilt). Without it, 3/3 stale.
- basic-memory: within a running server the watcher closes the gap in under 20 s, but `read_note` serves a database
  copy, so an agent that edits a note and immediately re-reads it through the tool sees the old text. A guard would have
  to compare the file's hash with the served text on every read; the tool has no such check. The Graphify guard script
  (`graphify-trial/graphify-guard.sh`) keys on git HEAD + diff and does not fit a non-git vault; memidx's content
  fingerprint is the pattern to reuse.

## 5. Timings (interleaved, 3 reps)

Wall time for the 12 first-pass queries per route, 3 reps, route order rotated each rep (`timing/routes.sh`,
`timing/reps.log`). MCP routes include starting the server and the known-answer probe. **Load average 40 → 121 during
these reps** (other sessions), so absolute numbers are inflated and noisy; only the order of magnitude is usable.

| Route | Median wall s (range, n=3) | Of which server start-up | Of which queries |
|---|---|---|---|
| grep (12 processes) | 11.1 (5.0-21.0) | — | — |
| memidx (12 processes, freshness check included) | 4.7 (3.6-18.2) | — | — |
| MCPVault | 40.9 (15.3-50.5) | 1.3-5.0 | 3.3-38.1 (each search re-reads all 536 files) |
| basic-memory | 76.5 (74.8-92.1) | **42.6-66.5** (startup sync + model load) | 4.5-15.9 (probe alone 10.6-14.8) |

- Loads: rep 1 start 42.7 / end 63.2; rep 2 end 78.2; rep 3 end 120.9 (1-min averages).
- Earlier sessions at load 20-60 were faster (MCPVault start-up 1.3-14.7 s, searches 0.5-11 s; basic-memory start-up
  13.8-19.0 s, searches 0.2-0.7 s after the first). Either way, tool time is small next to model time per call (~10 s
  per request in the speed audit) **except basic-memory's start-up, which is paid by every session that uses it**.

## 6. Hindsight (owner's addition): NOT TRIALLED

**What it is [read: README, `hindsight-integrations/claude-code/README.md`, `docs-integrations/obsidian.md`, PyPI metadata, 2026-10-08]:**
- Stores: `retain` "uses an LLM to extract key facts, temporal data, entities, and relationships", then keeps them in
  PostgreSQL + pgvector (embedded `pg0` for local use) with sparse and dense vectors. Background **consolidation** turns
  facts into "observations" that are "refined rather than overwritten" when new evidence arrives. `recall` fuses
  semantic, BM25, graph and temporal search with a cross-encoder reranker; `reflect` is another LLM call.
- **An LLM is mandatory for ingestion.** Providers: OpenAI (README default, `gpt-5-mini`), Anthropic, Gemini, Groq …,
  Hindsight Cloud, or local `ollama` / `lmstudio` / `llamacpp` / MLX. Its Claude Code plugin also offers
  `HINDSIGHT_LLM_PROVIDER=claude-code`, which drives the owner's Claude Code subscription ("personal/local use only").
- **Hooks:** the Claude Code plugin registers `SessionStart`, **`UserPromptSubmit` (auto-recall, injected as hidden
  `additionalContext` on every prompt)**, `Stop` (async auto-retain of the transcript after every turn) and `SessionEnd`.
  It writes `~/.hindsight/claude-code.json` and installs through `claude plugin install`. This is the hook class the
  2026-10-07 survey already ruled out (claude-mem, Cognee).
- **Updates and deletions:** the Obsidian sync is one-way, keyed by a content hash; "edits upsert, deletes remove"
  documents. Whether facts and observations *derived* from a deleted or corrected note are removed is not stated:
  observations are "refined rather than overwritten". UNVERIFIED; this is the staleness risk to test first.
- Install footprint [read, PyPI]: `hindsight-api-slim[all]` pulls PyTorch, transformers, sentence-transformers, MLX,
  onnxruntime, LiteLLM, the OpenAI/Anthropic/Gemini/Cohere/Bedrock SDKs and OpenTelemetry exporters.

**Why not trialled (RULING):**
- No local LLM exists on this Mac (no ollama, LM Studio or llama.cpp). The local path means PyTorch + MLX plus a model of
  several GB, on a shared disk with 8.2 GiB free that other sessions need for ~7 GB builds (memory
  `shared-host-contention.md`).
- A small local model would take hours to extract 536 notes at load 30-60, and would not represent the tool's
  benchmarked quality, so a local result would not be a fair verdict either. [inferred]
- Every non-local path sends the notes to a third party, which the brief forbids. Nothing was sent.

**What a cloud trial would send, where, and cost [inferred from the docs; not measured]:**
- **What:** the full text of every ingested note: 536 notes, ~2.7 MB, about 0.7 M tokens. That includes owner rulings,
  project names, file paths, commit ids, and ad-network identifiers that sit in memory notes (LevelPlay app keys and
  ad-unit ids). With the Claude Code plugin, every prompt's text (recall query) and every turn's transcript (retain).
- **Where:** the configured LLM provider (OpenAI by default; Anthropic or Gemini if chosen; Anthropic via the owner's
  subscription with `claude-code`), or Hindsight Cloud (`api.hindsight.vectorize.io`, the Obsidian plugin's default URL).
- **Cost:** one full ingest is roughly 0.7 M note tokens plus per-chunk extraction prompts, about 1.2-2.3 M input tokens
  and 0.2-0.5 M output tokens, plus consolidation calls. At $2 per M input tokens (Sonnet 5.5, claude-api skill cache
  2026-09-25) the input side is about $2.5-5 per full ingest; output and consolidation are extra, and later edits cost
  cents each. These are order-of-magnitude estimates, not quotes.

**What the owner would need to decide:**
1. Is it acceptable to send the memory corpus (and, with the plugin, every prompt and turn) to a named LLM provider or
   to Hindsight Cloud? If not, Hindsight is out.
2. If yes: approve one provider and a spend cap (~$10) for a trial on a **copy**, without the Claude Code plugin's hooks
   (HTTP API only). Run the same 12 questions plus the three staleness edits, and above all check the deleted-note case
   (does a removed or corrected fact disappear from `recall` and from observations?).
3. Or: approve installing a local model (disk: free ≥15 GB first) and accept that the result measures that model.

## 7. Owner browsing (value for the owner, not the agents)

**Is there value? Yes, for looking, not for the agents [inferred from the measurements below].** The graph, backlinks
pane and quick switcher make the 492 notes across 45 projects browsable as one map: which lessons cite which, which
projects share a scar. Agents gain nothing from it that grep plus the description line does not already give (§3).

**How it was tested [measured]:**
- Obsidian **1.4.5**: the app package from the owner's own Obsidian folder, copied into a scratch profile and run by the
  installed 1.1.9 binary. Launched with `--user-data-dir=<scratch>` (honoured: the profile appeared there), inside
  `sandbox-exec` with no outbound network and no writes under the home folder. Chromium's own sandbox cannot start
  inside `sandbox-exec`, so `--no-sandbox` was used (RULING: trial only, our own notes, network denied).
- The owner's real Obsidian config (`~/Library/Application Support/obsidian`, one registered vault whose folder no longer
  exists) was hashed before and after: unchanged (§10).
- Actions were driven over the Chrome DevTools protocol (`--remote-debugging-port`, localhost), not by hand.

| Test | Result |
|---|---|
| Open a writable copy (536 notes), defaults, let it index (~60 s), quit | **536/536 notes byte-identical** (sha256). Obsidian wrote only `.obsidian/` (6 files: `app.json`, `appearance.json`, `core-plugins.json`, `core-plugins-migration.json`, `hotkeys.json`, `workspace.json`) |
| Properties / frontmatter write that changes nothing (`processFrontMatter(f, fm => {})`) | **the note was rewritten**: YAML re-serialised (`metadata: ` → `metadata:`). Any Properties edit re-serialises the whole frontmatter block |
| Rename a note with 3 backlinks, `alwaysUpdateLinks: false` (the 1.4.5 default) | the file is renamed; a dialog asks "update internal links … 3 links in 3 files" (Always update / Just once / Do not update). **"Just once" rewrote 3 other notes, one of them `MEMORY.md`, the index Claude Code loads into every session.** "Always update" would also flip `alwaysUpdateLinks` to true for good |
| Same three writes on the **read-only copy** made by the setup script below | modify → `EACCES`; rename → `EACCES`; frontmatter write → error; **492/492 notes byte-identical** |
| Settings pre-seeded by the script (`alwaysUpdateLinks: false`, `defaultViewMode: preview`) | kept by Obsidian. But its first-run migration re-enabled `canvas`, `properties` and `bookmarks` although they were left out of `core-plugins.json`; these only write `.obsidian/` or new files, so they are harmless on a read-only copy |

**What must stay off or never happen:**
- **Never point Obsidian at `~/.claude/projects/*/memory` or a repo `docs/` folder.** A vault root gets a `.obsidian/`
  folder, and the rename test shows one click rewrites `MEMORY.md` and other notes. Obsidian has no read-only vault mode.
- `alwaysUpdateLinks` (Settings → Files & links → "Automatically update internal links"): **off**, and never answer
  "Always update" in the rename dialog.
- Properties editing (the Properties view in Live Preview/source mode): any edit re-serialises the frontmatter. Use
  Reading view (`defaultViewMode: preview`).
- Core plugins that create or rewrite notes: daily notes, templates, unique note creator, note composer (merge),
  slash/format commands. Community plugins: none (keep Restricted mode on). No Obsidian Sync on this vault.
- Do not register this vault in a tool that writes (MCPVault, basic-memory, Hindsight); they are separate decisions.

**Known limit of the graph [measured]:** 49 of 594 wikilinks point at a note name that exists in more than one project
(45 notes are named `MEMORY.md`; tondo has duplicated folders). Obsidian resolves each to one file, so a few graph edges
cross projects wrongly. 16 links point at notes that do not exist.

**Safe setup (exact; script tested twice in scratch, the copy matched the live memory 492/492 by sha256):**
1. Save as `~/bin/refresh-memory-vault.sh` and run it whenever you want a fresh view (it overwrites the copy):

```zsh
#!/bin/zsh
# One-way, read-only copy of the agent memory for browsing in Obsidian. Never point Obsidian at the live folders.
# usage: refresh-memory-vault.sh [VAULT]   (default ~/MemoryVault). Re-run any time; it overwrites the copy.
set -eu
V=${1:-$HOME/MemoryVault}
mkdir -p "$V/memory" "$V/.obsidian"; chmod u+w "$V/memory"
for d in $HOME/.claude/projects/*/memory(N/); do
  p=${${d:h}:t}; n=${p#-Users-${USER}-}
  mkdir -p "$V/memory/$n"
  chmod -R u+w "$V/memory/$n"
  rsync -a --delete --include='*.md' --exclude='*' "$d/" "$V/memory/$n/"
done
cp -f $HOME/Desktop/Projects/arrows-game/docs/engineering-lessons.md "$V/arrows-engineering-lessons.md" 2>/dev/null || true
# Settings that stop Obsidian from rewriting notes (only written if absent, so later changes are yours)
[[ -f "$V/.obsidian/app.json" ]] || print -r -- '{"alwaysUpdateLinks":false,"defaultViewMode":"preview","livePreview":false,"promptDelete":true,"trashOption":"local","autoConvertHtml":false,"newFileLocation":"folder","newFileFolderPath":"_scratch"}' > "$V/.obsidian/app.json"
[[ -f "$V/.obsidian/core-plugins.json" ]] || print -r -- '["file-explorer","global-search","switcher","graph","backlink","outgoing-link","tag-pane","page-preview","outline"]' > "$V/.obsidian/core-plugins.json"
# Notes read-only on disk: an accidental edit, rename or link update fails instead of changing the copy
find "$V/memory" -type f -name '*.md' -exec chmod a-w {} +
find "$V/memory" -type d -exec chmod a-w {} +
chmod a-w "$V/arrows-engineering-lessons.md" 2>/dev/null || true
print "refreshed $V: $(find "$V/memory" -name '*.md' | wc -l | tr -d ' ') notes, read-only"
```

2. In Obsidian: "Open folder as vault" → `~/MemoryVault`. Keep Restricted mode on. Use the Graph view, Backlinks and the
   quick switcher; filter the graph with `path:memory/Desktop-Projects-arrows-game` for one project.
3. To change a lesson, edit the real file (or ask an agent); then re-run the script. Edits made in Obsidian cannot be
   saved by design.
4. Optional proof after a browsing session: `cd ~/MemoryVault && find memory -name '*.md' -exec shasum -a 256 {} + | sort`
   before and after must match.

Caveats: tested on Obsidian 1.4.5 only; newer versions may change defaults (the script pins the important ones). The
installed app is 1.1.9 and will offer to update itself; that is the owner's call.

## 8. Verdicts

**Comparison with the earlier trials.** The 2026-10-07 rows used 12 *code* questions (81,066-char baseline); this trial
used 12 *memory* questions (77,768-char baseline). Compare each row with its own baseline, not across sets.

| Route | Question set | Accuracy | Total chars vs own baseline | Median per-question saving | Stale after edits, no re-index | Fixed cost per session | Verdict |
|---|---|---|---|---|---|---|---|
| grep + read (baseline) | code 10-07 | (truth source) | 81,066 | 0 | fresh | 0 | in use |
| Refined grep (code) | code 10-07 | (same answers) | −46.6 % | +34.1 % | fresh | 0 | became LOOK-001 |
| Graphify | code 10-07 | 3 C / 9 P / 0 W | +11.5 % | −7.5 % | **4/4 stale**, no warning | 0 (CLI) | REJECT (PROC-901) |
| Serena | code 10-07 | 6 C / 4 P (2 misleading) / 2 n/a | −5.6 % before overhead | 0.0 % | 4/4 fresh; **silently incomplete in 2/12 sessions** | 32,472 | REJECT (LOOK-901) |
| ast-grep | code 10-07 | 8 C / 2 P / 2 n/a | −43.5 % | +39.2 % | 4/4 fresh | 0 | REJECT as a route (LOOK-902) |
| grep + read (baseline) | memory 10-08 | 12 C | 77,768 | 0 | 3/3 fresh | 0 | in use |
| **Refined grep: file + description** | memory 10-08 | **12 C** | **−41.0 %** | **+40.1 %** | 3/3 fresh | 0 | **ADOPT AS HABIT** (no tool; recommendation 1) |
| (d) memidx, in-house map | memory 10-08 | 11 C + 1 via grep | −37.2 % | +11.2 % | 3/3 fresh with its check; 3/3 stale without | 0 | **REJECT** as a route; keep its content-fingerprint guard as the pattern |
| (a) MCPVault (Obsidian MCP, headless) | memory 10-08 | 9 C / 3 P / 0 W | −15.4 % (full answers) | −7.0 % | 3/3 fresh (no index) | 10,867 | **REJECT** for agents |
| (b) Local REST API + MCP bridge | — | — | — | — | — | — | **NOT TRIALLED**: needs Obsidian ≥1.13.1 (installed 1.1.9/1.4.5), a GUI plugin enable, an app always running |
| (c) basic-memory | memory 10-08 | 10 C / 2 P / 0 W | +1.2 % (full answers) | −30.9 % | 1/3 fresh at +0.5 s (stale `read_note`), 3/3 at +20 s and in a new session | 36,730 | **REJECT** (rewrites notes by default) |
| Hindsight | — | — | — | — | — | — | **NOT TRIALLED**: LLM extraction mandatory, no local LLM, cloud would send all notes; owner decision (§6) |
| Obsidian.app on a read-only copy | owner, not agents | n/a | n/a | n/a | the copy is as fresh as its last refresh | n/a | **ADOPT FOR OWNER BROWSING ONLY**, with the §7 setup |

**Strongest case against each verdict (§6), and what survives:**
- **Against "adopt the refined grep as a habit":** the description line only helps where descriptions are good; 19 of
  536 notes have none, and the one note that answered Q9 has a description that does not mention Halloween. Survives:
  the grep matches the body, so Q9 was still found (12/12); the description only ranks the hits. The control was run by
  the same person who wrote the questions, so the saving is labelled INFERRED until a fresh set confirms it.
- **Against rejecting MCPVault:** with a short vault path it is −25 % total / +5.5 % median, it never goes stale, it is
  MIT with no network code, and it works from harnesses without a shell. Survives: still well behind the refined grep
  (−41 % / +40 %), 3 partial answers from 5-hit OR ranking with 42-char excerpts, ~10.9k chars of schemas each session,
  and it hands the agent write, move and delete tools pointed at the memory.
- **Against rejecting basic-memory:** its hybrid semantic search was the only route that put `shared-host-contention`
  in the hits for the Q3 wording, and with permalinks enabled its graph (`build_context`) works. Survives: enabling
  permalinks is exactly what rewrote 528/536 notes; in the byte-safe configuration the graph returned nothing, duplicate
  titles made `read_note("SKILL")` fail, the per-session overhead is ~36.7k chars, and its total cost was no better
  than plain grep.
- **Against rejecting memidx:** it is the only agent route with backlinks and a built-in freshness guard, and it saved
  37 % in total. Survives: none of the 12 real questions needed a backlink, and the refined grep beat it on every summary
  number with nothing to build or maintain. Reopen if "what links to X / what depends on this lesson" questions show up
  in the ledger.
- **Against "owner browsing only":** owner time is the scarcest resource, and a copy goes stale between refreshes; 49
  wikilinks resolve ambiguously across projects. Survives: it is optional and read-only, the only measured way to look at
  the memory as a graph without risking the files, and a refresh takes one command.
- **Against "Hindsight not trialled":** the owner asked for it, and its `claude-code` provider would send the notes only
  to Anthropic, which already reads them in every session. Survives: that path still spends the owner's subscription,
  runs the `claude` CLI (which writes under `~/.claude`, forbidden in this brief), and installs prompt hooks if the plugin
  is used; it is the owner's decision, not the agent's.

## 9. Recommendations for agent-playbooks

Proposals for the playbook owner; none applied.

1. **Extend LOOK-001 (narrow retrieval) to notes**, or add a sibling heuristic: *for a memory question, list the matching
   files with their frontmatter `description` (`grep -rli KW <memory dirs> | xargs -n1 grep -H -m1 '^description:'`),
   pick one, read it.* Evidence: this doc §3, 12/12 correct, total −41 %, median per question +40 % vs grep -rn + read.
   Confidence INFERRED: first queries were written without hindsight, but one grader, one question set.
2. **New invariant (data-persistence or agent-process): never point an app or a tool that can write at the live memory
   (`~/.claude/projects/*/memory`, repo `docs/`); run it on a copy and prove byte-identity by sha256 before and after.**
   Evidence: basic-memory's default first sync rewrote 528/536 notes (including the `modified:` timestamp format of
   Claude Code memory files); one Obsidian rename rewrote `MEMORY.md` and 2 other notes; a no-op Properties write
   re-serialised a note's YAML. Gate: a hash diff of the target folder before and after the first run.
3. **Extend PROC-003 with "a database copy is a cache".** A tool that answers reads from its own store (basic-memory's
   `read_note` serves `note_content`) is a cache even with a file watcher: test edit → immediate re-read. Evidence: old
   body and description served 0.5 s after the edit, fresh by 20 s (§4).
4. **Record in `retired/` (ids are suggestions):**
   - LOOK-904 · An Obsidian MCP server (MCPVault) as agent memory: 9 C / 3 P, −15 % total / −7 % median to full
     answers, +10.9k chars of schemas per session, no backlinks, write/delete tools on the memory. Reopen if the
     harness defers MCP schemas *and* the refined grep loses on a fresh question set.
   - LOOK-905 · basic-memory as agent memory: default sync rewrites notes (528/536); safe config disables its graph
     (0 relations) and breaks `read_note` for duplicate titles (`SKILL`, `MEMORY`); +1.2 % total, −31 % median;
     +36.7k chars per session; stale `read_note` window; AGPL-3.0; 808 MB installed. Reopen only with a release that
     indexes without writing and resolves notes by path.
   - Re-confirms **PROC-903** (index the lessons file): a 153-line description/backlink index lost to the refined grep;
     add a "Re-compared 2026-10-08" line rather than a new id.
   - **Hindsight is not a retirement**: it was never run. Record it under "not trialled: needs an owner decision on
     sending notes to an LLM provider" with the cost estimate from §6.
5. **Memory hygiene finding (for the owner or the next agent, not a tool rule):** the arrows-game memory note
   `speed-audit-2026-10-07.md` says Graphify's "realistic token cost +7.5 % vs grep+read". The trial measured median per
   question −7.5 % *saving* (it cost more) and **total +11.5 %**. Every search route surfaced that note first for Q1, so
   the imprecision propagates. Suggested fix: quote "median per question 7.5 % more, total 11.5 % more".
6. **Owner browsing:** if the owner wants it, add the §7 script to `agent-playbooks/tools/` with a one-line README, so it
   is versioned with the rule in (2).

## 10. Artifacts and cleanup

Scratch dir (kept, not in the repo):
`/private/tmp/claude-501/-Users-gentlegen-Desktop-Projects-arrows-game/529758e6-3b29-4422-a19a-51e6c72a0675/scratchpad/obsidian-trial/`.
- **Scripts:** `sb.sh` (sandbox), `mcpc.py` (MCP stdio client), `memidx.py` (+ `memidx.frozen.sha256`), `cost.sh` →
  `cost.csv`, `stats.py`, `stale/edit.py` + `stale/edit2.py`, `timing/routes.sh` + `timing/reps.log`,
  `owner/refresh-memory-vault.sh`, `owner/obs-open.sh`, `owner/cdp.mjs`, `ledger.py`.
- **Outputs:** `gq/` (grep), `rq/` (refined grep), `dq/` (memidx), `av/` (MCPVault sessions), `bq/` (basic-memory
  sessions), `stale/` (all staleness sessions), `timing/`, `owner/` (Obsidian tests and hash lists), `hindsight/`
  (README, docs and PyPI metadata as read).
- **Vault copies:** `vault/` (pristine), `vault-st`, `vault-st2` (edited), `vault-bm` (rewritten by basic-memory's
  defaults: the evidence), `vault-bm2` (safe config, later edited), `vault-ob` (opened in Obsidian; one rename test),
  `owner/MemoryVault` (read-only copy made by the script).
- **Installs:** `mcpvault/` (22 MB), `bm-venv/` (405 MB), `uv-cache/` (403 MB), `bm-home*/` (DBs + 64 MB model),
  `obs-ud/`, `owner/ud/` (scratch Obsidian profiles, 25 MB each). Downloads with digests in `dl/`.
- **No worktree was created** for this trial (`git worktree list`: main checkout only, in both repos).
- **Hashes [measured]:** `hashes-before.txt` vs `hashes-final.txt`: all 37 protected files unchanged, including
  `~/.claude/settings.json` (`f599fe81…`), `~/.claude/CLAUDE.md` (`95dd0adb…`), the plugin registry files and every
  file of the owner's Obsidian config (`obsidian.json` `011f6fdd…`). `~/.claude/skills` and the top-level listing of
  `~/.claude` are unchanged. No trial process is left running.
- **Ledger:** one `process-metrics/2` experiment line plus one correction line (peak load) appended to
  `~/.claude/process-metrics/arrows-game.jsonl`.
