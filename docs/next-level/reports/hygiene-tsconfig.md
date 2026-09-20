# TypeScript program hygiene

## Outcome

- `tsconfig.json` now explicitly includes `src/**`, `scripts/**`, `modules/**`, `plugins/**`,
  `App.tsx`, `index.ts`, and `jest.setup.ts`.
- It excludes `artifacts`, `android`, `ios`, `.superpowers`, `.expo`, `dist`, and `node_modules`
  from root-file discovery.
- No application logic or dependencies changed.

## Reproduction and measurements

**EXECUTED (before):**

```sh
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --listFiles --extendedDiagnostics
```

The compiler completed without a TypeScript error. The `/usr/bin/time -lp` wrapper then reported a
sandbox-denied `sysctl kern.clockrate` lookup, but still recorded 50.68 s wall time.

**EXECUTED (after, default Node heap):**

```sh
env -u NODE_OPTIONS npx tsc --noEmit --extendedDiagnostics
```

Exit 0; `/usr/bin/time -p` recorded 2.60 s wall time.

| Metric | Before | After |
| --- | ---: | ---: |
| TypeScript program files | 1,340 | 1,283 |
| Memory used | 4,650,389K | 336,189K |
| Compiler total time | 48.23 s | 2.13 s |
| Wall time | 50.68 s | 2.60 s |
| JavaScript lines | 1,955,723 | 5,478 |

**EXECUTED:** The requested counting pipeline receives absolute paths from TypeScript, so its
`cut -d/ -f1` selects the empty field before the leading slash. It therefore prints only unlabeled
totals: 190 before and 133 after. Stripping the repository prefix before `cut` gives the intended
breakdown:

| Repository root | Before | After |
| --- | ---: | ---: |
| `src` | 91 | 91 |
| `scripts` | 29 | 29 |
| `modules` | 7 | 7 |
| `plugins` | 3 | 3 |
| `App.tsx` | 1 | 1 |
| `index.ts` | 1 | 1 |
| `jest.setup.ts` | 1 | 1 |
| `artifacts` | 57 | 0 |

```sh
grep arrows-game/ /tmp/arrows-tsc-before.txt | grep -v node_modules \
  | sed 's#^.*/arrows-game/##' | cut -d/ -f1 | sort | uniq -c
grep arrows-game/ /tmp/arrows-tsc-after-list.txt | grep -v node_modules \
  | sed 's#^.*/arrows-game/##' | cut -d/ -f1 | sort | uniq -c
```

**EXECUTED:** A sorted path-set comparison for every file under
`src|scripts|modules|plugins` produced 0 differences, not only equal aggregate counts.

## TDD evidence

This is a TypeScript project-boundary configuration change, not a logic change, so no unit test was
added. The requested compiler inventory is the regression check:

- **RED / pre-fix reproduction (EXECUTED):** `artifacts` contributed 57 project files and the
  compiler used 4,650,389K.
- **GREEN (EXECUTED):** `artifacts` contributes 0 files, every genuine source path is preserved,
  and default-heap `npx tsc --noEmit --extendedDiagnostics` exits 0.

## Gates

- **EXECUTED:** `env -u NODE_OPTIONS npx tsc --noEmit --extendedDiagnostics` — exit 0.
- **EXECUTED:** The first `npx jest` attempt did not start tests because Homebrew Watchman tried to
  write `~/Library/LaunchAgents/com.github.facebook.watchman.plist`, outside the sandbox.
- **EXECUTED:** `npx jest --no-watchman` — 35/35 suites and 620/620 tests passed across both
  `core` and `ui`; 0 snapshots; 10.483 s.
- **EXECUTED:** With the verified Node 20 toolchain on `PATH` and only Homebrew's Watchman directory
  omitted, the literal `npx jest` command passed 35/35 suites and 620/620 tests across both projects;
  0 snapshots; 8.204 s.

## Decisions

- Used an explicit source allowlist as the primary invariant; the requested denylist documents the
  generated and evidence trees that must not become TypeScript roots.
- Kept `node_modules` in `exclude` for explicit root-discovery hygiene. Imported dependency
  declarations remain part of TypeScript's program as required for type checking.

## Concerns

None.

## Owner acceptances

None required.

## Files changed

- `tsconfig.json`
- `docs/next-level/reports/hygiene-tsconfig.md`
