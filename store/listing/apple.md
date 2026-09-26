# App Store listing copy — UNUSED DRAFT

Status: unused. iOS is deferred (plan §8 decision 15): no iOS build has been made since
2026-09-01 (docs/IOS_BOARD_PLAN.md) and no task uploads this file. It exists so the iOS copy
starts from the same checked, true claims as `store/listing/play.md`; every claim here is one of
that file's claims C1-C10 and must be re-verified on an iOS build before use. Apple indexes the
name, subtitle and keyword field, not the description.

Check with `node scripts/check-listing.js store/listing/play.md store/listing/apple.md` (limits:
name 30, subtitle 30, keywords 100, promotional text 170, description 4000).

## Name candidates (same as Play)

name_1: Arrows: Ink Night
name_2: Arrows – Calm Arrow Puzzle
name_3: Arrows: Clear the Picture

## Subtitle

subtitle: Calm taps. Clear the picture.

## Keywords

Comma-separated, no spaces. Drop any word that ends up in the chosen name (Apple indexes the
name already).

keywords: calm,relaxing,visual,search,shapes,picture,tap,lanes,minimal,casual,focus

## Promotional text

promotional_text: Every level is a picture made of arrows. Tap the ones with a clear way out and clear the picture. No timers, no rush.

## Description

description: |
  Arrows is a calm game about looking closely.

  Every level is a picture made entirely of arrows: a heart, a crescent moon, a flower, a rocket. Tap an arrow and it slides off the board in the direction it points, as long as nothing stands in its lane to the edge. Tap an arrow that is blocked and it costs a heart.

  Read the board, spot the arrows that are free to leave, and clear the picture.

  • No timers. Take as long as you like.
  • Every level opens with the whole picture on screen. Pinch to look closer; pinch out and the whole picture is back.
  • A new board every level, drawn as one of 26 shapes.
  • Three hearts per level for the lanes you misread.
  • Two looks: Daylight, black ink on white paper, and Ink Night, moonlit arrows on deep ink.

  Arrows is free and shows ads between some levels. Rewarded ads are always your choice: watch one for a hint, or to continue a level after your hearts run out.

## Claims → evidence

Subtitle and promotional text restate C1, C2, C3 and C5; the keywords "calm", "relaxing",
"focus" rest on C1, "visual", "search", "picture", "shapes", "tap", "lanes" on C2, C3, C5 and C7;
"minimal" and "casual" are register words (PRODUCT.md "Brand Personality"), not feature claims. The description is `store/listing/play.md`'s full description word for word; see
that file's list (C1-C10). Before any iOS use: re-check C6 (pinch and fit) and C9 (themes) on an
iOS build, re-run C7's count at that commit, and add the iOS ad and tracking (ATT) disclosures
that W8-12 owns.
