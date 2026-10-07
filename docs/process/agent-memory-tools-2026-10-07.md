# Agent memory and knowledge tools vs our approach (route experiment, 2026-10-07)

**Question from the owner (2026-10-07):** "what other tools are there like graphify that can help? experiment it and check
if our way is better and how we can optimize."
**Rule followed:** `~/.claude/CLAUDE.md` §10 ("A new route is a hypothesis; test it"; "Project memory and caches never
go stale silently") and §6 (attack the verdict). Same protocol, 12 questions and ground truth as
[graphify-trial-2026-10-07.md](graphify-trial-2026-10-07.md), so the rows below are directly comparable.
**Scope:** throwaway worktree of `next-level`, pinned to `ace959b` (the Graphify ground-truth commit), in the session
scratchpad; scratch venvs; nothing committed; no adb, emulator, gradle or prebuild. This doc is the only file written in
the main checkout. Nothing was installed into `~/.claude` (hashes at the end).
**Conditions:** shared host, load average 21-70 during the runs (other sessions running builds). All timings are under
that load. Tags: **[measured]** executed and read; **[read]** from the tool's source or docs, not executed;
**[inferred]** reasoning, not executed.

## Answer in six lines

1. **Nothing trialled beats our baseline enough to adopt.** Serena (LSP) answered 6/12 fully vs Graphify's 3/12 and never
   went stale, but saved no tokens (76.5k vs 81.1k chars, plus ~32k chars of fixed session overhead) and silently
   returned incomplete cross-file references in 2 of 12 sessions. **REJECT.** [measured]
2. **ast-grep cut total chars 44 % (median per question 39 %), but so did plain grep used with the same specificity (total 47 %, median per question 34 %).** The saving comes from asking
   a narrow question, not from the tool. **REJECT as a route; fine as an ad-hoc tool.** [measured]
3. **Context7 (docs) was right on 6/10 version-exact questions and wrong on 3, two of them for the wrong version**
   (it has no Expo SDK 57 branch and no Reanimated 4.5; it answered RN compileSdk 37 / targetSdk 35 for 0.86, truth 36/36).
   `node_modules` types plus WebFetch of the versioned docs were cheaper and right. **REJECT.** [measured]
4. **The biggest saving available needs no tool:** grep the call pattern (`name(`), exclude tests unless asked, and read
   only the symbol's range. That is ~38k fewer chars on the same 12 questions. [measured, with hindsight; see §6]
5. **For library API facts, read the installed package first** (`node_modules/<pkg>` types, `compatibility.json`,
   CHANGELOG): 9 answers in ~2k chars vs 53k chars from Context7. [measured]
6. **New failure class for our rules:** a *live* tool that is never stale can still be *silently incomplete*.
   PROC-003's invalidation gate does not catch it; a positive-control query does. [measured]

## 1. Survey

Sources: each project's own repository or package registry, read 2026-10-07 (GitHub API for stars and last push; PyPI and
npm for versions and licences; the Anthropic plugin directory cache in `~/.claude/plugins`, fetched 2026-10-02, read only).
Name-squatting check: the official repos are the ones listed; the directory also has many look-alike "code graph" and
"memory" plugins from unknown authors (graph-indexer, Synapse MCP, gortex, GrapeRoot, RepoAtlas, agent-recall, MEMANTO,
Velixar...), all "review: none".

| Tool (official source) | What it does | Local / cloud; does code leave? | Freshness model | Install footprint, invasiveness | Licence | Maturity (2026-10-07) | Known failure modes |
|---|---|---|---|---|---|---|---|
| **Baseline:** Grep/Glob/Read + CLAUDE.md/AGENTS.md + lessons/memory + agent-playbooks | reads the files | local | reads the tree at query time; playbooks have a staleness lint and `check-applicability.py` | none | n/a | in use | unrefined greps read too much (§6) |
| **Graphify** `Graphify-Labs/graphify`, PyPI `graphifyy` | tree-sitter code + doc graph | local (`--code-only`); doc extraction can call an LLM | none at query time; manual `update` | 120 MB venv; installers write CLAUDE.md + hooks; skill auto-refresh | Apache-2.0 | 124k stars, pushed 10-06 | **trialled 10-07: REJECT** (stale 4/4, 3/12 correct) |
| **Serena** `oraios/serena`, PyPI `serena-agent` 1.7.0 | MCP server over language servers: symbols, references, symbol-level edits, "memories" | local; downloads TS LS from npm on first run; **usage ping** to oraios-software.de on every start unless `SERENA_USAGE_REPORTING=false`; dashboard fetches a news JSON [read] | live LSP; per-file symbol cache keyed by content hash [read+measured] | 119 MB venv + 25 MB LS + 26 MB cache in the repo (`.serena/`); `serena setup claude-code` runs `claude mcp add --scope user`; recommended **PreToolUse hook denies the 3rd consecutive Grep/Read**; its claude-code prompt marks Read and Edit "FORBIDDEN" [read] | wheel 1.7.0: MIT; GitHub README now says app GPL-3.0-or-later, SolidLSP MIT | 30k stars, pushed 10-06 | **trialled** (§2) |
| **ast-grep** `ast-grep/ast-grep`, PyPI `ast-grep-cli` 0.45.3 | structural (AST pattern) search/rewrite, also `outline` | local | none needed: scans files every run | one 98 MB binary; no hooks; an optional MCP exists (not used) | MIT | 16k stars, pushed 10-06 | **trialled** (§2) |
| universal-ctags `universal-ctags/ctags` | symbol `tags` file | local | stale until regenerated | small binary | GPL-2.0 | 7.3k stars | definitions only, no references; same staleness class as Graphify |
| aider repo map `Aider-AI/aider` | PageRank-ranked tree-sitter tag summary, inside aider | local | rebuilt per aider run, mtime cache | whole aider install | Apache-2.0 | 49k stars, last push 2026-05-22 | not a standalone tool for Claude |
| Repomix `yamadashy/repomix` | packs the repo into one file | local (packing) | a snapshot, stale at the next edit | npm | MIT | 29k stars | the pack is far larger than any grep answer |
| Sourcegraph plugin `sourcegraph-community/sourcegraph-claudecode-plugin` | code search via a Sourcegraph instance | cloud or self-hosted; code is indexed there | server-side index of pushed branches, not the working tree | needs an instance + token | plugin: none stated | 4 stars; public Sourcegraph snapshot archived 2024 | cannot see uncommitted edits |
| "code-graph" plugin (named in the brief) | not found under that name in the directory cache; nearest is `graph-indexer` (MaquinaTech) | local | "live" claimed | plugin with hooks | MIT | 11 stars, unreviewed | unverified |
| `typescript-lsp` / `kotlin-lsp` (Anthropic official plugins) | Claude Code's built-in LSP tool: definition, references, diagnostics | local | live LSP | plugin install writes to `~/.claude`; no prompt takeover | Apache-2.0 directory | Anthropic-reviewed | not trialled (needs `~/.claude` install); same tsserver engine as Serena's TS backend [inferred] |
| MCP "memory" server `modelcontextprotocol/servers/src/memory` | agent-written knowledge graph (entities, relations, observations) in a JSONL file | local | none: holds whatever the agent wrote | npx | see repo LICENSE | servers repo 91k stars | no link to code; no evidence or expiry fields |
| basic-memory `basicmachines-co/basic-memory` | Markdown notes + SQLite search, two-way sync | local-first, optional cloud | file sync | PyPI | **AGPL-3.0** | 4.1k stars, pushed 10-06 | functionally our memory files + search |
| Mem0 / OpenMemory `mem0ai/mem0` | LLM-extracted memories, vector search | "requires an LLM ... gpt-5-mini from OpenAI as the default" (README); memories go to the LLM | add-only extraction; no code link | Python + vector store | Apache-2.0 | 67k stars | facts paraphrased by an LLM, no provenance |
| Cognee `topoteretes/cognee` + `cognee-integrations` plugin | LLM/GLiNER-built knowledge graph memory | local mode possible without an LLM (README) | ingest-time | **plugin hooks on SessionStart, UserPromptSubmit, PreToolUse(Read), PostToolUse(Bash/Read/Write/Edit/Grep/Glob...), Stop, PreCompact, SessionEnd** | Apache-2.0 | 31k stars | out per brief (prompt hooks); the hook-free core is a generic graph RAG like Graphify |
| Letta `letta-ai/letta` | stateful-agent server with memory blocks | local server or cloud | agent-managed | a server; v1 API retired to an archive branch | Apache-2.0 | 25k stars | replaces the harness, not a Claude Code add-on |
| Graphiti/Zep `getzep/graphiti` | temporal knowledge graph | needs Neo4j/FalkorDB/Neptune + an LLM | bi-temporal edges | DB + LLM keys | Apache-2.0 | 31k stars | heavy; same provenance gap as Mem0 |
| claude-mem `thedotmack/claude-mem` | captures every tool use, summarises it, injects context | local SQLite + Chroma; summaries by a model | per session | **hooks on Setup, SessionStart, UserPromptSubmit, PostToolUse(*), PostToolUseFailure, PreToolUse(Read), Stop, SessionEnd**; worker on a local port; `~/.claude-mem` | Apache-2.0 | 97k stars, pushed 10-07 | out per brief (hooks on every prompt and tool call) |
| **Context7** `upstash/context7`, CLI `ctx7` 0.5.13, MCP `@upstash/context7-mcp` 4.1.1 | version-aware library doc snippets | cloud (context7.com); the query text is sent; crawler is private | crawled per library; some libraries carry version branches | none used (HTTP API called directly); anonymous limit 200 requests, resets 2026-11-01 (response headers) | MIT client; service proprietary | 63k stars; Anthropic-directory plugin, reviewed | **trialled** (§3) |
| DeepWiki MCP (Cognition, `mcp.deepwiki.com`) | LLM-generated wiki + Q&A over a public GitHub repo | cloud | regenerated from the default branch, not from a version tag | none | proprietary service | live | not trialled: answers about `main`, the exact staleness risk Context7 showed |
| Expo docs MCP / `expo:*` skills (installed, expo plugin 1.13.6) | workflow skills; MCP needs auth (not connected this session) | local skills; MCP cloud | skills are versioned by plugin release and point at versioned doc URLs | already installed | MIT | official | skills are not fact stores (§3) |

**Why only three trials.** The cost they must beat is small and measured: the speed audit found lessons-file reads cost
~93k tokens across 92 agents, and model time, not re-reads, dominates agent hours. So:
- **Serena** was chosen as the strongest code-structure candidate with a *live* freshness model, the property Graphify
  lacked. It also stands in for the official `typescript-lsp` plugin, which uses the same engine but needs a `~/.claude` install.
- **ast-grep** was chosen as the strongest *index-free* candidate: it cannot go stale by construction.
- **Context7** was chosen as the most used docs service with version support.
- **Memory tools were not trialled.** Their ceiling is the lessons and memory reads (~93k tokens over 20 days), most of them need an
  LLM or hooks on every prompt, and none carries evidence, gates or expiry (§5).
- **ctags, Repomix, Sourcegraph and DeepWiki** fall in classes the trials already cover (stale snapshot, cloud
  index of pushed code, docs from `main`).

## 2. Code-structure trials (same 12 questions, same ground truth)

**Install, pinned and verified [measured]:**
- Serena: `serena_agent-1.7.0-py3-none-any.whl` sha256
  `6dbf1459670d96fb0595f84932adef34260a6fe14ba5135b901fdb3c8c76e891`.
- ast-grep: `ast_grep_cli-0.45.3-...universal2.whl` sha256
  `ebc1510a6775f65a8681345dd422590fb257fe48036a7c599a5ca9f54dea8801`.
- Both match the PyPI digests (`shasum -a 256 -c`).
- Installed with `uv` into scratch venvs, with a scratch `UV_CACHE_DIR`.
- Serena ran with `SERENA_HOME` in scratch, its dashboard off, usage reporting off, and the `claude-code` context, as Claude Code would start it.
- It was driven over MCP stdio by a small Python client, not registered in any Claude config.

**Sandboxing [measured]:**
- Every query ran under `sandbox-exec` with no outbound network and no writes under `/Users/gentlegen`.
- Positive controls: `curl https://pypi.org` failed to connect, and `touch ~/.claude/x` was refused.
- One network step was allowed: Serena's first-run `npm install` of typescript-language-server, with writes still confined to scratch.

**Grading.**
- Serena: its symbolic tools plus the built-in Grep/Read its own `claude-code` context permits for discovery, about 2-5 calls per question.
- ast-grep: patterns run without `-l` unless the language needed one.
- Grades are against the code at `ace959b`, which I read myself.

| # | Serena (LSP) | ast-grep | Graphify (10-07) |
|---|---|---|---|
| 1 tier label | **correct** (refs + `headerTier` body shows `displayTier`) | partial (no `displayTier` link) | correct |
| 2 callers of `generateCampaignLevel` | **correct** | **correct** | correct |
| 3 readers of `META_SKIN_PICKER` | partial (runtime reader + 4 of 7 test files; scripts missing) | partial (identifier pattern skips property keys: 0 test files) | partial |
| 4 exit-sound gate | **correct** (body + `EXIT_POP_ENABLED = false` + 3 callers) | **correct** after 1 failed pattern | partial |
| 5 writer of `arrows_gen_switch_level` | partial, **misleading**: write site right, but `find_referencing_symbols SaveSystem/setGenSwitchLevel` omits the production caller `generatorVersion.ts:123` (called through the `GenSwitchSave` interface) in 3 of 3 complete sessions | **correct** (key, write L426, caller L123, `App.tsx` L159) | partial, misleading |
| 6 cleared-board outline + timing | **correct** (body + all constants with values) | **correct** | partial |
| 7 importers of the ads SDK | partial, **misleading** (symbol search on the module name lists only test `jest.mock` callbacks; Grep needed) | **correct** (but `-l ts` silently skips `ads.tsx`) | correct |
| 8 Halloween specs + ids | partial (pumpkin 18; ghost/candy-corn ids need a read) | **correct** (ids 18-20, candidates 21-23) | partial |
| 9 petal balance writes | **correct** (4 write sites via `PETALS` refs) | **correct** | partial |
| 10 header-fit tests | **correct** | n/a (filename question: Glob) | partial |
| 11 Kotlin view + skin JSON | n/a (TS-only config; the Kotlin LS is a JetBrains download, not installed) | **correct** after 2 failed patterns (needs the `internal` modifier) | partial |
| 12 docs on emulator-5556 | n/a (no Markdown tool in the `claude-code` context) | n/a | partial |
| **Total** | **6 correct, 4 partial (2 misleading), 0 wrong, 2 n/a** | **8 correct, 2 partial, 0 wrong, 2 n/a** | 3 correct, 9 partial |

**Token cost (chars an agent reads to reach the full truth; tokens ≈ chars/4) [measured; `cost2.sh`, `cost3.sh`].**
- The baseline column reproduces the Graphify trial's `cost.csv` exactly, all 12 rows; it is the same script.
- "Realistic" counts failed queries and the completion reads still needed. Where a tool cannot answer, the baseline grep is charged.
- "Refined grep" is the §6 control: plain `git grep`/`sed` with the same prior knowledge and specificity as the ast-grep route.

| Route | Total chars (12 Q; total change vs baseline) | Median per-question saving vs baseline | Tool calls | Tool wall time, 12 Q (median of 3, interleaved, load 42-47) |
|---|---|---|---|---|
| Baseline grep + read | 81,066 | 0 | 35 | 0.74 s (0.62-3.0) |
| Graphify (10-07) | 90,393 (total +11.5 %) | -7.5 % | n/r | queries 0.6-1.3 s each + 23 s rebuild per change |
| **Serena, realistic** | 76,502 **+ 32,472 per session** (21 tool schemas 23,523 + mandated `initial_instructions` 8,949) | 0.0 % (range -80 to +70) | 39 + 2 | 18.25 s (14.5-32.7) incl. start-up and the first-reference wait |
| Serena, best case (decisive output only) | 42,920 + 32,472 | +45.5 % | | |
| **ast-grep, realistic** | 45,786 (total −43.5 %) | +39.2 % (range -16 to +92) | 31 (3 failed) | 2.48 s (2.13-4.24) |
| ast-grep, best case | 20,887 | +77.9 % | | |
| **Refined grep (control)** | 43,254 (total −46.6 %) | +34.1 % (range -4 to +92) | 26 | not timed (same commands as baseline class) |

- The speed audit found model time scales with output tokens, about 10 s per request.
- So call count and context bytes matter more than the sub-second tool times above. [inferred]

**Staleness test (the 4 Graphify edits, no rebuild, no re-index) [measured]:**
- (a) rename `generateCampaignLevel` to `dealCampaignBoard`;
- (b) new file exporting `graphifyTrialProbe`;
- (c) remove the `feedbackSoundOn` import and its use from `feedbackFallback.ts`;
- (d) `headerTier` calls `displayTierForArrowCount`.

| Edit | Serena, same live session (edits made mid-session, as an agent's Edit tool would) | Serena, fresh session | ast-grep |
|---|---|---|---|
| (a) | old name: `[]` and "No symbol matching" error; new name found with both callers | same | old pattern 0 hits; new 2 |
| (b) | found | found | found |
| (c) | refs now `feedback.android.ts`, `feedback.ios.ts` only | same | same |
| (d) | body shows `displayTierForArrowCount(level.arrowCount)` | same | same |

- **4 of 4 fresh for both tools, without any rebuild.**
- Serena has a query-time freshness check: the symbol cache is keyed by file content hash, and references come from the live LSP. [read + measured]
- ast-grep has no index to go stale.
- Graphify, for comparison: 4 of 4 stale, exit 0, no warning.

**The Serena failure that replaces staleness: silent incompleteness [measured].**
- What happens: before its first cross-file reference query, Serena waits at most 30 s for tsserver's project indexing. If indexing is not done, it logs `TypeScript cross-file indexing did not complete within 30s; proceeding (complete=False)` to the **server's stderr only** and never waits again in that session.
- How often: 2 of 12 sessions.
- In those sessions, every cross-file reference query returned partial or empty JSON, with no error, for the whole session. Examples:
  - `feedbackSoundOn`: `{}` (truth: 3 files);
  - `displayTier`: `{}` (truth: 4);
  - `generateCampaignLevel`: 1 of 2 files.
- This still held 25 s and 8 s later, and after edits.
- The other 10 sessions were complete. 3 replicated sessions gave identical results.
- The trigger is not simply load: one failure was at load 30-41, and successes were at 44-53.
- Two further hazards:
  - **Line numbers are 0-based** in every Serena result (`> 933:` for file line 934), so a cited line is off by one.
  - **References through a structural interface are missed** even in complete sessions (Q5), so `safe_delete_symbol` or a "no callers" conclusion would be wrong there. Whether `rename_symbol` has the same gap was not tested.

**Setup and disk [measured]:**
- Serena:
  - uv install 125 s at load ~70;
  - `project create` 20 s;
  - `project index` 47 s, including the npm download, 350 TS files;
  - session start-up median 4.7 s (1.7-54.4, n=14);
  - first cross-file reference median 12.6 s (4.3-35.4, n=12);
  - other calls median 0.41 s (n=163);
  - disk: 119 MB venv + 25 MB language server + 26 MB `.serena/` cache in the repo + 22 MB npm cache.
- ast-grep:
  - wheel 15.7 MB, venv 95 MB (one 98 MB universal binary);
  - no index, no setup;
  - about 33 commands per 12-question route in 2.1-4.2 s.

## 3. Docs trial: 10 version-exact questions (numbered D1-D11; D6 was dropped before any query)

**Versions:** expo 57.0.18, react-native 0.86.3, reanimated 4.5.1, react-native-google-mobile-ads 17.1.0,
expo-audio 57.0.4, expo-store-review 57.0.3, from `node_modules/*/package.json`.

**Ground truth:**
- `node_modules` sources and types:
  - `expo/bundledNativeModules.json`;
  - `react-native-reanimated/compatibility.json` + `peerDependencies`;
  - `react-native-google-mobile-ads/src/types/RequestOptions.ts:31`, `src/RewardedAdEventType.ts:59`;
  - `expo-audio/build/Audio.types.d.ts:520-560`;
  - `expo-store-review/build/StoreReview.d.ts`;
  - `react-native/gradle/libs.versions.toml`.
- Plus the official Vercel cache-control page and the Neon scale-to-zero page.

**Context7 privacy:** only public-library questions were sent, by `curl` to `context7.com/api/v2/{libs/search,context}`
(the endpoints the `ctx7` CLI uses, read from its verified tarball). No repo code, path or name was sent; the command text is in the scratch dir.

| # | Question | Context7 (1st call / after 1 follow-up) | WebFetch of versioned docs | `expo:*` skills | `node_modules` read |
|---|---|---|---|---|---|
| D1 | RN + React in SDK 57 | **correct** (0.86, 19.2.3; from `main`'s compatibility JSON) | correct (v57.0.0 page) | partial (RN 0.86 in a brownfield table) | correct, 57 chars |
| D2 | worklets + RN for Reanimated 4.5 | **wrong version**: no 4.5 data; cites 4.0/4.1 and "latest 4.1.3". Follow-up: still none (index has 3.17.4, 3.19, 4.1.5 only) | partial: RN 0.83-0.86 right; worklets "0.10.x and 0.11.x" (installed 4.5.1 peer-requires 0.10.x: docs track the newest patch) | not covered | correct, 210 chars |
| D3 | `useAnimatedGestureHandler` in v4? | **correct** (removed; use Gesture API) | correct | not covered | partial (absence only) |
| D4 | non-personalised ads flag | **correct** (`requestNonPersonalizedAdsOnly`, from `main`) | no answer after 2 fetches | not covered | correct, 102 chars |
| D5 | rewarded "reward earned" event | **correct** (`EARNED_REWARD`) | correct (2nd fetch, v17.1.0 tag) | not covered | correct, 80 chars |
| D7 | `playsInSilentMode` default + Android; `interruptionModeAndroid` replacement | partial / **correct** after follow-up (default `true`, Android behaviour, `interruptionMode`) | correct (v57 page) | partial (usage only) | correct, 1,218 chars |
| D8 | expo-store-review exports | **wrong** (README links only) / partial (3 of 4) | correct (4 of 4) | not covered | correct, 235 chars |
| D9 | RN 0.86 minSdk / targetSdk / compileSdk | **wrong** (Platform 35 env note) / **wrong version**: minSdk 24 right, compileSdk 37 and targetSdk 35 (truth 36 / 36) | honest "not stated" | not covered | correct, 101 chars |
| D10 | Vercel CDN-only cache header + precedence | **wrong** twice (searched the `vercel/vercel` code repo; never names `Vercel-CDN-Cache-Control`) | correct (header, priority, stripped before the client) | n/a | n/a |
| D11 | Neon free-plan scale-to-zero | **correct** (300 s default, fixed on Free) | correct | n/a | n/a |
| **Total** | | **5 correct first pass; 6 correct, 1 partial, 3 wrong after follow-ups; 2 wrong-version** | 7 correct, 1 partial (version drift), 2 no answer, 0 wrong-version | 0 full, 2 partial, rest not covered | 8 correct, 1 partial (D1-D9) |

- **Grading caveat:** the `node_modules` column is circular, because the ground truth was taken from it. It is listed for its cost, which is the cheapest route to a version-exact answer, not for its accuracy.
- **Context7 cost [measured]:**
  - 34,718 chars for 10 first calls; 53,023 chars with follow-ups (about 13k tokens);
  - median 3,524 chars and 2.07 s per call (1.76-3.04 s, n=15, sequential, not interleaved).
- **`node_modules` cost [measured]:** D1-D9 together 2,011 chars.
- **WebFetch cost [inferred]:** returns a model-written summary, so only a few hundred chars reach the context per page (the Vercel page returned ~9k); its latency was not instrumented.
- **Version coverage seen 2026-10-07 [measured]:**
  - Context7's `/expo/expo` lists branches `sdk-54`, `sdk-55`, `sdk-56` only;
  - `/software-mansion/react-native-reanimated` lists `3_17_4`, `3.19-stable`, `4.1.5`;
  - most other libraries carry no versions, so they serve `main`.

## 4. Verdicts

| Tool | Verdict | Numbers |
|---|---|---|
| Serena | **REJECT** | 6/12 correct, 2 misleading partials; realistic tokens 76.5k vs 81.1k baseline before a ~32k-char per-session overhead (net +34 % on this set); silent partial references in 2/12 sessions; 0-based lines; invasive defaults |
| ast-grep | **REJECT as a route** (allowed ad hoc for structural rewrites, never `-l ts` on a TSX codebase) | 8/12 correct; 45.8k chars vs refined grep 43.3k (the gain is query specificity); 3 of ~25 patterns silently matched nothing |
| Context7 | **REJECT** (not ADOPT FOR DOCS) | 6/10 correct, 3 wrong, 2 for the wrong version; 53k chars vs ~2k from `node_modules`; lost to WebFetch on D8 and D10 |
| Graphify (10-07, unchanged) | REJECT | 3/12, stale 4/4 |
| Memory tools (MCP memory, basic-memory, Mem0, Cognee, Letta, Graphiti, claude-mem) | **not trialled; not recommended** | ceiling ~93k tokens/20 days; hooks or an LLM in the loop; no evidence/expiry model |

**Strongest case against each verdict (§6), and what survives:**
- **Against rejecting Serena:**
  - The case: our 12 questions are look-ups. On edit-heavy work (cross-file renames, "who calls X" before a change), LSP precision should matter more, and Serena's best case saved 45 %.
  - What survives: the incompleteness and interface-miss findings apply to exactly that work, and an agent cannot see them. Serena's own prompt and hook push the agent away from the Read that would catch them.
  - Reopen if the ledger shows cross-file refactors as a cost driver. Then trial the official `typescript-lsp` plugin (same engine, no prompt takeover), with a positive-control reference query per session.
- **Against rejecting ast-grep:**
  - The case: the refined-grep control was written with hindsight. A real agent might not think to grep `setInt(PETALS`, while ast-grep's pattern language makes the narrow query natural.
  - What survives: the ast-grep patterns also used hindsight (they named `PETALS`, `HALLOWEEN_BOARD`, `internal fun`). And ast-grep failed silently in two ways grep does not: `-l ts` drops `.tsx`, and an unmatched pattern looks like "no results".
  - Teaching the *habit* (§6) captures the saving without a 98 MB binary.
- **Against rejecting Context7:**
  - The case: it was right 6/10 in ~2 s per call, carries code snippets across pages, and with an API key could pin versioned library IDs.
  - What survives: the versions we run were not indexed, and its wrong answers looked as authoritative as its right ones (compileSdk 37 came from a real gradle file of another version). The local package answered in 4 % of the bytes.
  - Reopen when Context7 lists the exact installed versions, re-running D1-D11.

## 5. What this means for agent-playbooks

**What our approach does that none of these tools do [read]:**
- Every rule carries **evidence with a source, a gate that proves it was followed, a kind (invariant/fact/heuristic), an
  expiry, and the versions it was measured on**. `check-applicability.py` flags rules measured on other versions.
- **Owner rulings and measured anti-patterns** (e.g. EXPO-001 reduced motion, UI-002's 521-green-tests crash) are judgement and
  history. Graph and memory tools store symbols or paraphrased observations, with no provenance, no confidence, no expiry and no retirement.
- **None of the tools has a gate.** None can say "this was verified on device"; at best they say "this edge was extracted".

**Gaps the tools reveal in our approach:**
1. **Silent incompleteness is not covered.** PROC-003 tests staleness (edit, then the old answer must not come back). A live
   index can be fresh and still incomplete. A *positive control* would catch it: one query whose answer is known before trusting the tool's empty or short result.
2. **No rule says where library API facts come from.** AGENTS.md says "read the versioned docs", but the cheapest
   version-exact source is the installed package, and docs sites drift to the newest patch (D2: worklets 0.11.x).
3. **No rule teaches narrow retrieval.** The 47 % saving from specific greps is the largest token lever measured in either
   trial, and it is not written down.

**Top 5 recommendations (proposals for the playbook owner; none applied):**
1. **Add a heuristic to `agent-process` (or `tool-reliability`): "Narrow retrieval".** Grep the call or write pattern
   (`name(`, `setX(KEY`), exclude `__tests__` unless the question is about tests, then read only the symbol's line range,
   not the file. Goal: fewer context bytes at equal answers. Evidence: this doc §2, 81.1k to 43.3k chars on 12 questions.
   Confidence INFERRED until the eval harness measures it on fresh tasks, because the control used hindsight.
2. **Add a fact to `expo-rn-apps`: "API facts come from the installed version first".** Order:
   `node_modules/<pkg>` types, `compatibility.json`, CHANGELOG; then the versioned docs URL (`/versions/v57.0.0/`, a git
   tag); never `latest`, `main` or an unversioned docs service as the only source. Gate: the report cites the file or
   versioned URL plus the installed version. Evidence: §3 (D2, D9 wrong-version; 2k vs 53k chars). This *replaces* the idea of
   storing library facts in playbook rules: rules keep our measured behaviour; library facts are looked up live, from the package.
3. **Extend PROC-003 with a completeness clause.** Before trusting an empty or short answer from any index or language
   server, run one query with a known non-empty answer in the same session; on a miss, fall back to grep. Evidence: Serena
   2/12 sessions; Graphify "No node matching" exit 0.
4. **Record the rejections in `retired/` or the tool-reliability evidence:** Serena, ast-grep, Context7 and Graphify, each with its numbers
   and reopening condition, so they are not re-trialled without a new reason (§10).
   - Specific traps worth one line each:
     - ast-grep `-l ts` skips `.tsx`;
     - Serena lines are 0-based;
     - Serena's `claude-code` context and hook forbid Read/Edit, which conflicts with "claims come from the file".
5. **Do not plug any of these into `expo-rn-apps` now.** The one plausible plug-in is a docs lookup for *non-npm services*
   (Vercel, Neon), but WebFetch of the official page was right on both, and Context7 was wrong on Vercel twice. Keep the expo
   skills as the Expo workflow source (they already point at versioned URLs). Revisit Context7 only per the reopening condition.

**"Facts" rules that could become live lookups [read]:**
- DATA-002's `Valid while: free plan, scale-to-zero 5 min` can be re-checked from the Neon page at validation time (D11 confirmed it on 2026-10-07).
- Vercel header priority is not a rule today; if one is added, it should cite the official page and be re-checked, not frozen.
- The other expo/RN rules are *our measurements* (EXPO-003 Hermes, EXPO-005 SvgView, EXPO-006 text fit). No docs service has them, so they stay.

## 6. Cost note (per use)

Prices from the claude-api skill (cached 2026-09-25): Claude Opus 5.5 $4 per M input tokens, cache reads $0.20 per M.
Sonnet 5.5 is $2 / $0.20.

| Route | Tokens per 12-question set (≈ chars/4) | Money at Opus 5.5 input (first read) | Each later request re-reads it (cache) | Time |
|---|---|---|---|---|
| Baseline | ~20.3k | ~$0.08 | ~$0.004 | 35 calls ≈ 6 min of model time at ~10 s/request [inferred] |
| Refined grep | ~10.8k | ~$0.04 | ~$0.002 | 26 calls ≈ 4.3 min [inferred] |
| ast-grep | ~11.4k | ~$0.05 | ~$0.002 | 31 calls; tool 2.5 s |
| Serena | ~19.1k + ~8.1k fixed per session | ~$0.11 | ~$0.005 | 41 calls; tool 18 s; first-run setup ~3 min |
| Context7, 10 docs questions | ~13.3k (follow-ups incl.) | ~$0.05 | ~$0.003 | ~2 s per call; free tier 200 requests/month |
| `node_modules` read, D1-D9 | ~0.5k | <$0.01 | ~$0.0001 | 9 greps |

- **Money:** all of these are cents per task. The speed audit's median context is 277k tokens per request, so none of these routes moves the bill measurably. [inferred]
- **The real cost is model time per call (~10 s) and wrong answers.** A confident wrong-version fact or an empty reference list
  that leads to a bad edit costs a review cycle, far more than any token saving here.

## 7. Artifacts and cleanup

Scratch dir (not in the repo): `/private/tmp/claude-501/-Users-gentlegen-Desktop-Projects-arrows-game/529758e6-3b29-4422-a19a-51e6c72a0675/scratchpad/mem-trial/`.
- **Scripts and sandbox wrappers:**
  - `s.sh` (Serena sandbox) and `ag.sh` (ast-grep sandbox);
  - `mcpc.py` (MCP stdio client);
  - `cost2.sh` + `cost2.csv` and `cost3.sh` + `cost3.csv`.
- **Outputs:**
  - `sq/` (every Serena output, server stderr and timing log);
  - `aq/` (ast-grep outputs and rules);
  - `stale/` (edit script, in-session/cold/reliability sessions);
  - `timing/` (interleaved reps);
  - `c7/` (every Context7 response with headers).
- **Downloads and installs:** `dl/` (wheels + digests), `ctx7/` (verified tarballs, not installed).
- **Kept:** the venvs (`serena-venv`, `astgrep-venv`) and the `serena-home`, `npm-cache` and `uv-cache` caches.
- **Removed:** the throwaway worktree, after the trial.
