# W6-10 spike: can `.tsx` components be tested on Expo 57 / RN 0.86.3 / React 19.2.3?

**Verdict: RESOLVES.** The trivial `.tsx` component test passes under `jest-expo`, the
pre-existing suite's counts are unchanged from this task's own base commit, and
`react`/`react-native`/`react-native-reanimated` are pinned at the exact same versions
before and after. Getting there needed two extra devDependencies the Expo guide doesn't
mention and one `--legacy-peer-deps` install — both recorded below as caveats for W6-11.

- Base commit: `487362e2f8ed0e84e456b6f2f59430b6ee02aeaa` (branch `next-level`, clean tree).
- Work branch: `spike/w6-10-tsx-test` (scratch; not merged — see Non-goals/Risk in the brief).
- Node `v20.19.4`, npm `10.8.2` — EXECUTED (`node -v`, `npm -v`).

## 1. Guide read (step 1 of the brief)

Source: `https://docs.expo.dev/develop/unit-testing/` (the SDK 57 versioned reference index
at `/versions/v57.0.0/` has no unit-testing page or link — INFERRED from reading that page's
content; the unit-testing guide itself is not SDK-versioned in Expo's docs site, unlike the
API reference).

- Preset: `{ "jest": { "preset": "jest-expo" } }`.
- Renderer: **`@testing-library/react-native`**, not `react-test-renderer`. The guide states
  verbatim (quoted under 15 words): "react-test-renderer does not support React 19".
- Named install commands: `npx expo install jest-expo jest @types/jest --dev` and
  `npx expo install @testing-library/react-native --dev`.
- The guide does not name a jest-expo version number, and does not mention
  `@react-native/jest-preset` as a separate install (see §3 caveat 2).

## 2. What was installed, and in what order — EXECUTED

Scratch branch, in order:

1. `npx expo install jest-expo --dev` → resolved `jest-expo@57.0.5` (SDK-matched by `expo
   install`). Output: "added 89 packages, removed 50 packages, changed 2 packages". The
   removals are npm's own dedupe of jest-expo's transitive tree, not a change to any
   top-level pinned version (confirmed in §3).
2. `npm i -D @testing-library/react-native` (brief's exact command, no version pin) →
   **failed** with `ERESOLVE` (full transcript in §3, caveat 1). Nothing installed.
3. `npm i -D @testing-library/react-native --legacy-peer-deps` (workaround, see caveat 1) →
   resolved `@testing-library/react-native@13.3.3` with `react-test-renderer@19.2.3` pulled
   in as its own dependency (installed by `jest-expo`, not by RNTL — see caveat 1).
4. First `npx jest --selectProjects ui` run → failed: `jest-expo`'s preset requires
   `@react-native/jest-preset`, which is not installed on this stack (caveat 2).
5. `npx expo install @react-native/jest-preset --dev` → resolved `@react-native/jest-preset@0.86.3`
   cleanly, no ERESOLVE (SDK-aware resolution, unlike step 2's raw `npm i`).
6. Second `npx jest --selectProjects ui` run → **passed**.

Install warnings (EXECUTED, seen verbatim in step 1's output): three `npm warn deprecated`
lines for `abab@2.0.6`, `whatwg-encoding@2.0.0`, `domexception@4.0.0` — transitive jsdom-era
deps pulled in by `jest-expo`'s tree, unrelated to this task's own packages. `npm audit`
reported 16 vulnerabilities (11 moderate, 5 high) after all installs; not diffed against the
pre-spike baseline (out of scope — the brief's guard is the three-package `npm ls`, not audit).

## 3. Caveats for W6-11 (both real, both worth knowing before that task starts)

**Caveat 1 — the guide's own install command doesn't resolve on this Node.** `npm i -D
@testing-library/react-native` (no version) hit `ERESOLVE`:

```
npm error Found: react@19.2.3
npm error   peer react@">=18.2.0" from @testing-library/react-native@13.3.3
npm error Could not resolve dependency:
npm error peer react@"^19.3.0" from react-test-renderer@19.3.0
npm error   peer react-test-renderer@">=18.2.0" from @testing-library/react-native@13.3.3
```

Root cause (EXECUTED, via `npm view`): `@testing-library/react-native`'s `latest` dist-tag is
`14.0.1`, which drops the `react-test-renderer` peer entirely (matching the guide's claim) —
but `14.0.1` requires `engines.node: "^22.13.0 || >=24"`, and this machine runs Node
`20.19.4`. npm's resolver falls back to the newest version whose `engines` the running Node
satisfies, `13.3.3`, which *still* lists `react-test-renderer: ">=18.2.0"` as a peer and pulls
the newest `react-test-renderer` (`19.3.0`, requiring `react@^19.3.0`) — one minor above our
pinned `react@19.2.3`. This is exactly the "forced downgrade [here: forced mismatched
upgrade] of a pinned dependency" risk the brief's context section named, just surfaced via
Node's engine floor rather than a direct version pin.

`--legacy-peer-deps` sidesteps it: without strict peer verification, npm found
`react-test-renderer@19.2.3` — a real, published version matching our pinned `react` exactly
— so no pinned package changed version (confirmed by the `npm ls` diff below).
**Recommendation for W6-11: either upgrade Node to `>=22.13.0` first (own decision, own
task) and use `@testing-library/react-native@^14`, or keep pinning `@testing-library/react-native`
to `^13.3.3` explicitly with `--legacy-peer-deps` documented in the install step.** Both are
viable; this spike did not need to choose because it stayed off both non-goals (no Node
upgrade, no dependency version change).

**Caveat 2 — `@react-native/jest-preset` is a required install the guide never names.**
`jest-expo`'s preset (`node_modules/jest-expo/jest-preset.js`) requires
`@react-native/jest-preset` and falls back to `react-native/jest-preset` on
`MODULE_NOT_FOUND` — but RN 0.86.3's own `node_modules/react-native/jest-preset.js` is itself
just a shim that re-throws the same "moved to a separate package" error when
`@react-native/jest-preset` is absent (both files read, verbatim error text quoted above 15
words split across two files, not reproduced here). `npx expo install
@react-native/jest-preset --dev` resolved it cleanly (`0.86.3`, matching RN's own version, no
ERESOLVE) — this one is a one-line addition to W6-11's install step, not a real blocker.

No `babel.config.js` exists in this repo. Not a blocker: `jest-expo`'s
`resolveBabelOptions` (read, EXECUTED path confirmed by the passing test) falls back to
`expo/internal/babel-preset` when no config file is found, matching Metro's own default.

## 4. `npm ls react react-native react-native-reanimated` — before vs. after (EXECUTED)

Before (base commit, before any install):

```
+-- @shopify/react-native-skia@2.6.2
|   `-- react-native-reanimated@4.5.1 deduped
...
+-- react-native-reanimated@4.5.1
+-- react-native@0.86.3
+-- react@19.2.3
```

After (all four packages installed, scratch branch):

```diff
+-- @react-native/jest-preset@0.86.3
|   `-- react@19.2.3 deduped
+-- @testing-library/react-native@13.3.3
|   +-- react-native@0.86.3 deduped
|   +-- react-test-renderer@19.2.3
|   |   `-- react@19.2.3 deduped
|   `-- react@19.2.3 deduped
+-- jest-expo@57.0.5
|   `-- react-native@0.86.3 deduped
```

Every existing line for `react`, `react-native` and `react-native-reanimated` is byte-identical
before and after — the diff is additive only (three new dev packages that themselves depend on
the same pinned versions, deduped). **No pinned version changed.**

## 5. Test results (EXECUTED)

Trivial test — `src/ui/__tests__/headerButtonSpike.test.tsx`, renders `HeaderButton` and
presses it (`fireEvent.press`, asserts `onPress` called once):

```
$ npx jest --selectProjects ui
PASS ui src/ui/__tests__/headerButtonSpike.test.tsx
  W6-10 spike: HeaderButton under jest-expo
    ✓ renders its label and calls onPress when pressed (290 ms)
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
```

Existing suite, isolated to prove it is untouched by the new `ui` project
(Ruling F22 — compared against this task's own base commit, not the stale "11 suites / 61
tests" in the brief text):

```
$ npx jest --selectProjects core
Test Suites: 25 passed, 25 total
Tests:       543 passed, 543 total
```

Base commit measurement, for the record (EXECUTED, same command, on `487362e` before any
change): `Test Suites: 25 passed, 25 total` / `Tests: 543 passed, 543 total`. **Identical.**

Both projects together:

```
$ npx jest
Test Suites: 26 passed, 26 total
Tests:       544 passed, 544 total
Ran all test suites in 2 projects.
```

`npx tsc --noEmit` — EXECUTED, no output, exit 0 (repo's `tsconfig.json` has no `include`, so
this type-checks the new test file and the new devDependency's types too).

## 6. Native module mocks — EXECUTED (this test) + INFERRED (what W6-11 will need)

`HeaderButton` imports only `react-native` and `react-native-svg`. **No mock was needed** for
either — `jest-expo`'s default environment renders both without extra setup (EXECUTED: the
test passed with zero `setupFiles`/`moduleNameMapper` additions beyond the bare `jest-expo`
preset).

That is not representative of `GameScreen`/`BoardView`, W6-11's likely real subject (INFERRED
from reading imports, not exercised by this spike — Non-goal: "Real component tests
(W6-11)"):
- `GameScreen.tsx` and `BoardView.tsx` import `react-native-reanimated` and
  `react-native-worklets`; `BoardView.tsx` also imports `react-native-gesture-handler`.
  Reanimated ships a jest mock (`react-native-reanimated/mock`) that typically needs wiring
  into `setupFilesAfterEach`/`setupFiles`; gesture-handler ships `jestSetup.js` the same way.
- `StaticBoardSurface.native.tsx` references `@shopify/react-native-skia` and the local
  `modules/arrows-board` native module. Skia ships its own jest mock
  (`@shopify/react-native-skia/jestSetup.js`); `modules/arrows-board` is a project-local Expo
  module unknown to `jest-expo`'s built-in native-module mocking and will need a manual
  `jest.mock('modules/arrows-board', ...)` or a `__mocks__/` entry.

None of this was installed or exercised in this spike — it is a reading of the import graph
to save W6-11 a discovery pass, not a verified result.

## 7. Files changed (scratch branch only — not merged)

- `package.json`, `package-lock.json` — added `jest-expo@~57.0.5`,
  `@testing-library/react-native@^13.3.3`, `@react-native/jest-preset@^0.86.3` to
  `devDependencies`.
- `jest.config.js` — converted to `projects: [core, ui]`; `core` is byte-for-behavior
  identical to the prior single-project config (same `preset`/`testEnvironment`/`testMatch`),
  `ui` is new (`preset: 'jest-expo'`, `testMatch` for `*.test.tsx`).
- `src/ui/__tests__/headerButtonSpike.test.tsx` — new, the trivial spike test.

None of the above merges to `next-level`; only this doc does, per the brief's Files list and
Risk/rollback note. The scratch branch `spike/w6-10-tsx-test` is left in the local repo
(not pushed — global constraint: never push) for the controller/W6-11 implementer to inspect
before it re-does the install for real.

## 8. Decisions (judgment calls made without stopping to ask)

1. Used `--legacy-peer-deps` for `@testing-library/react-native` after the guide's bare
   command failed, instead of stopping the spike at the first ERESOLVE. Rationale: the brief
   asks for a verdict, not just "did the guide's exact command work" — trying one
   documented, non-version-changing workaround before declaring DOES NOT RESOLVE gives the
   controller a real choice instead of a dead end. Did not go further (e.g. did not try
   forcing `react-test-renderer` version pins, did not touch Node).
2. Named the doc `docs/tsx-test-spike-2026-09-17.md` (today's date, per the brief's
   `<YYYY-MM-DD>` placeholder).
3. Left the `spike/w6-10-tsx-test` branch intact locally rather than deleting it, so the
   working `jest-expo` setup is reproducible without re-deriving caveats 1–2. It is
   unpublished and not referenced by `next-level`.
4. Did not run `npm audit fix` or otherwise touch the vulnerability count — out of this
   task's scope (spike is about `.tsx` testability, not dependency hygiene).

## 9. Open verification gaps

- iOS/device behavior of this jest setup: UNVERIFIED-DEVICE — not applicable per the brief
  (jest runs in Node, not on-device; this is a tooling spike, not a runtime spike).
- Whether `@testing-library/react-native@13.3.3` continues to resolve once Node is upgraded to
  22+ for other reasons: not tested (would then presumably jump to `14.0.1`, dropping the
  `react-test-renderer` peer entirely) — flag for whoever next changes Node version.
