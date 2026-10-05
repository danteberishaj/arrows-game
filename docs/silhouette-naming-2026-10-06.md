# Silhouette naming (W3-19) — owner ruling

2026-10-06. **Result: House, Teacup, Bell and Umbrella PASS by owner judgement.**

- **Owner ruling (2026-10-06):** "those shapes are distinguishable".
- **Material reviewed:** the deck in `~/Desktop/Arrows-shape-test/`. It is the four numbered crops of
  `artifacts/W3-18/owner-recognition-sheet.png`, each showing a gallery tile and a mid-game board.

**Deviation from the W3-19 protocol, recorded honestly.** The task asked for a blind naming test: people who had not
seen the shape list, asked "what object is this?" with no options. The owner instead judged recognisability himself.
The owner knew the shape names, so this is an owner override, not blind evidence.

**Risks carried forward from W3-18:**
- Umbrella's hook reads weakly at 12 rows.
- House's chimney disappears at 14 rows.

Neither is re-measured here. A later blind test or tester feedback can still cut a shape, but only through a new
generator version once v2 is frozen (W3-21).

**Consequence:** the four ids may be added to `V2_ADMITTED_SHAPE_IDS` (`src/core/shapeCatalogue.ts`) and removed
from `PENDING_RECOGNITION`. This re-deals v2, so both v2 corpus fingerprints are re-pinned in the admission commit,
before the W3-21 freeze.
