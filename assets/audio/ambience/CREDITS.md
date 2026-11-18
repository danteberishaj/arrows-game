# Winter ambience beds (WINTER-01, META_AMBIENCE)

All sources are real recordings from Freesound under **Creative Commons 0 (CC0 1.0, public domain dedication)**:
commercial use allowed, no attribution required, no per-user obligations. Credits below are given as a courtesy.
Licence read on each sound's own page on 2026-11-18 (link `creativecommons.org/publicdomain/zero/1.0/`).
Source audio = the Freesound HQ preview (Ogg Vorbis) of each sound; no account or login used.

The tune in `winter-musicbox.m4a` is "Jingle Bells" (James Lord Pierpont, 1857): the composition is in the public domain.

Every file: 48 kHz AAC-LC in .m4a, loops seamlessly (the seam is a crossfade baked into the file), loudness
normalised to about -30 LUFS integrated measured over the looped file, true peak at most -3 dBTP. Code only trimmed,
filtered, levelled, crossfaded and limited the recordings; no sound was synthesized.

| file | length | sources (Freesound id, title, author) | edits |
|---|---|---|---|
| `winter-fireside.m4a` (96 kbps stereo, 436 KB) | 36.0 s | [444920](https://freesound.org/s/444920/) "Fire crackling in fireplace" by NomadApe; [399538](https://freesound.org/s/399538/) "Windchime soft" by Vendarro | fire trimmed 5.0-43.0 s (avoids the two loudest pops at 43.97 / 47.81 s), 2.0 s equal-power loop crossfade, sharpest pops limited to 16 dB over the bed RMS (lookahead limiter, 30 ms release); chime 0-9 s, 7 kHz low-pass, 0.8 s / 3 s fades, placed once at 14.0 s, 9 LU under the fire |
| `winter-musicbox.m4a` (64 kbps mono, 267 KB) | 32.1 s | [546207](https://freesound.org/s/546207/) "Jingle Bells on a Music Box.wav" by MJvGent | trimmed 12.30-44.80 s: the whole tune after the winding-ratchet clicks at 2-12 s, starting and ending in room tone; 60 Hz high-pass; 0.4 s loop crossfade inside the room tone (the seam is the box's natural breath between plays) |
| `winter-wind-bells.m4a` (96 kbps stereo, 429 KB) | 35.0 s | [211057](https://freesound.org/s/211057/) "WinterWindPlusChimes.wav" by kvgarlic; [550317](https://freesound.org/s/550317/) "sleigh bells recording.7ST fade.wav" by beerbelly38 | wind trimmed 103.0-141.0 s (skips a gust / passing-vehicle swell at 97.5-102 s), 3.0 s equal-power loop crossfade; two sleigh-bell jingles (22.70-23.30 s, 33.16-33.80 s) low-passed at 4.5 kHz for distance, placed at 11.0 s and 27.5 s, peaks 14 / 12 dB over the bed RMS |

Measured on the decoded .m4a (trimmed to the container duration, looped):

| file | integrated | true peak | LRA |
|---|---|---|---|
| winter-fireside | -30.0 LUFS | -14.4 dBTP | 1.9 LU |
| winter-musicbox | -30.1 LUFS | -11.1 dBTP | 5.3 LU |
| winter-wind-bells | -29.9 LUFS | -15.2 dBTP | 5.5 LU |
