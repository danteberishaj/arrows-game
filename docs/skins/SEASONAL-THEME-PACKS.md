# Seasonal theme packs (draft, WINTER-01, 2026-11-18)

Goal: each season dresses the app with its own art and sound, so returning players keep finding something new. Every season adds a pack; the code path stays the same.

Status:
- First pack: Winter, in `src/ui/winter/`.
- This doc sets the contract that spring and later packs follow.
- The code generalises when the second pack arrives (YAGNI until then).

## What a pack contains

| Slot | Asset | Contract |
| --- | --- | --- |
| Menu top | `<pack>-top-{day,night}.webp` | Full-width strip under the header. It is cropped to its content and its aspect is generated (see `paintedAspects.ts`). |
| Menu bottom | `<pack>-bottom-{day,night}.webp` | Full-width scene anchored to the bottom. Its objects stay ≥4 % from the side edges, and the centre-top stays low. |
| Night glow (optional) | `<pack>-glow-night.webp` | The only animated layer: opacity only, UI thread, ≥2.5 s half-cycle, sine in-out, `ReduceMotion.System`. |
| Board ground | `<pack>-boardground-{day,night}.webp` | Sits under the arrows, inside the board viewport. It never sits under the HUD text. |
| Board tint | `board: {light, dark, decor}` in the skin spec | The contrast gate (outline ≥3:1 on both boards) decides. |
| Ambience | 1–3 beds, `assets/audio/ambience/<pack>-*.m4a` | CC0 or an equivalent licence, recorded in CREDITS.md. Each bed is checked with earshot (realness, describe/match, loop seam) and mastered to about −30 LUFS. |
| Skins | Seasonal entries in `rewardCatalogue.ts` | Book-only, petal price and window as for Halloween/Winter. Never a new save key. |

Total art budget is about 500 KB of WebP per pack (Winter, painted: about 430 KB).

## Pipeline (proven on Winter)

1. **Style board.**
   - Codex built-in imagegen draws 6–8 styles in one shared layout (top strip, empty centre, bottom scene); see `artifacts/WINTER-01/concepts/styles/prompt.txt`.
   - The owner picks the styles worth building.
2. **Layer generation.**
   - For each chosen style, Codex draws the top and the bottom as separate transparent PNGs, with day and night in the same composition.
   - The prompt cites the previous layer's file, which keeps the style locked across layers.
   - Gotchas:
     - run `/Users/gentlegen/.local/bin/codex` with `< /dev/null`, or it waits on stdin forever;
     - the nvm `codex` is a broken npm global.
3. **Post-processing.** `scripts/art/winter/codex-post.py` does it:
   - unions the alpha crop, so day and night stay pixel-aligned;
   - scales to 1440 wide and adds a warm halo under the night lights;
   - writes the WebPs and the aspect file.
4. **3D route (alternative).**
   - Blender 5.2 headless (`scripts/art/winter/menu.py`) plus Voyager CC0 materials and HDRIs.
   - It gives full control (lights that cast real light, exact layout). The painted route won the Winter A/B on finish.
5. **QA build.**
   - `EXPO_PUBLIC_QA_WINTER_SWITCH=1` shows chips that switch looks, board decor and beds live.
   - `EXPO_PUBLIC_QA_DATE` forces the season.
   - The "+20 ✿" chip grants petals for testing.
6. **Gates.**
   - Contrast audit and reduced-motion policy tests.
   - Device screenshots in light and dark.
   - Owner sign-off on the device.

## Keeping it fresh without noise (proposals, owner to decide)

- **Several styles per season, one at a time.** Options: rotate weekly inside the season, or let the player choose in Settings, or both.
- **Sub-seasons.**
  - Christmas look (Dec 1–26).
  - New Year look (Dec 27–Jan 2): gold, fireworks.
  - Plain winter (Jan 3–Feb 28).
  - The winter skins span all three.
- **Motion stays quiet.** The menu is seen many times a day, so the only motion is one slow glow per pack (Emil: frequency decides). Delight goes in rare moments instead, e.g. a first-open-of-season reveal and the level-clear burst.
- **Calendar candidates:**
  - Valentine's (Feb 7–15);
  - Spring (Mar 1–May 31), with Easter inside it;
  - Summer (Jun–Aug);
  - Autumn (Sep–Oct), with Halloween inside it (exists);
  - Winter (exists).
