# Play phone screenshots, "Ink Night glow" (2026-11-16)

**ACCEPTED by the owner 2026-11-16 (final frames, credit lines included).**

Five 1080x1920 (9:16) RGB PNGs, no alpha. Owner choices on 2026-11-16: the Ink Night direction, the plain-benefit headlines, 5 frames, and layout variant A (tilted phones). **Nothing has been uploaded.** Uploading is the owner's step.

| # | Headline | Screen (from ../set-a-default and ../set-b-styles, captured 2026-10-06) |
|---|----------|-----------|
| 1 | Clear the Picture | Rocket board mid-play, Ink Night |
| 2 | Tap the Free Arrows | Heart board mid-play, Daylight |
| 3 | No Timers. No Rush. | Win panel, Ink Night |
| 4 | A New Board Every Level | Cat, star and heart boards fanned out |
| 5 | Unlock Cute Styles | Critter board, plus the "Your styles" list card |

## Claim checks
- **"A New Board Every Level"** is listing claim C7 (store/listing/play.md). It replaced the owner-picked "Hundreds of Pictures", which is false: there are 26 shapes.
- **"Unlock Cute Styles":** VERIFIED from the release flag list. `release/vc19.env` (= the vc18 set + 2) has `EXPO_PUBLIC_META_SKIN_PICKER=1` and `EXPO_PUBLIC_META_REWARD_BOOK=1`.
- **"No Timers. No Rush." and three hearts** are listing claims C4/C6.
- **Known gap, owner kept it (2026-11-16):** frames 1-4 come from the flags-default build. The shipped build also has `BOARD_GRID` and other look flags ON, so the boards differ slightly (the shipped boards have a dot grid). A recapture needs a vc19-flag test build.
- I avoided the Arrow-style "Book" capture because it shows a dated "Halloween · until 7 Nov" event.

## Rebuilding
`source/arrows.html` reads the captures by absolute path and `../fonts/fredoka-latin.woff2` (Fredoka, OFL). Running `source/render.sh arrows A` writes a 5400x1920 panorama and its five slices. Headless Chrome has to run outside the Claude sandbox.
