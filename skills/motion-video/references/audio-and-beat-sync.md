# Audio and beat sync

## Voice-over

- Model `gemini-3.8-flash-tts` through `multix gemini generate-speech`, one call
  per scene with all its lines joined. Style prompts that worked:
  - hype: "Hyped animated superhero movie trailer narrator with hip-hop swagger.
    Fast, punchy, playful, big grin in the voice, crisp diction, dramatic little
    pauses before reveals." (voice Fenrir, comic)
  - keynote: "Energetic, upbeat tech product launch announcer. Confident, warm
    and playful, fast pace, crisp diction, smiling voice." (voice Puck, glass keynote)
  - outro: "Calm, warm and intimate, slow and soft, a quiet hopeful promise at
    the end of a movie."
- Energetic lines are sped up 8% in the mix (`TEMPO = 1.08`, ffmpeg `atempo`);
  outro lines keep natural pace.
- Each line is cut from the scene WAV between its aligned first/last word with
  0.08 s pre-roll and 0.15 s tail, never past the midpoint to the neighbour line,
  then placed on the timeline independently. That is what lets a single line
  ("Let's go!") sit in a silent stop or a word ("Nits") hit a drop.

## Sound effects

`data/sfx.json`: `{ id, prompt, duration }` → `multix elevenlabs sfx --prompt-influence 0.6`.
`data/cues.json` places them; each cue has `sfx`, optional `vol` (default 0.5),
`offset`, and exactly one anchor:

| Anchor | Meaning |
|---|---|
| `scene` + `word` (+ `nth`) | onset of that spoken word |
| `beat` | quarter note n of the music grid |
| `abs` | absolute seconds |
| `scene` + `at` | seconds after the scene cut |

Prefer word and beat anchors; they survive re-timing. The comic edition used
19 SFX files and 62 cues.

## Music generation

MiniMax Music answered HTTP 410 for new accounts and fal.ai was not configured,
so both videos use ElevenLabs Music composition plans:

```bash
multix elevenlabs music --plan data/music-plan.json --format mp3_44100_192 --output ./assets/audio/music/bgm-raw.mp3
```

- Put BPM, key and instrumentation in `positive_global_styles`, and write the
  intent of each section into its local styles (intro, build, drop, groove,
  breakdown, final drop, tail). Ask for a "hard stop / one beat of silence" before
  the first drop if the script has a shout line there.
- ElevenLabs does not honour `duration_ms` per section. Expect the drops in the
  wrong places and fix that with the arrangement step, not by re-rolling.
- Generate the calm ending as a separate short composition (`outro-plan.json`)
  and fade it in under the main track's tail (`OUTRO_BED`).
- Keep the previous `bgm-raw.mp3` before regenerating so you can compare.

## Beat grid

`scripts/fit-beat-grid.py` fits a constant-tempo grid (BPM, BEAT0) to low-band +
full-band onsets and prints one row per bar: kick marks (`K`/`.`) and RMS dB.
Read the energy column to find the source's own intro, builds, drops and
breakdowns. librosa is deliberately not used; its import hung on Windows.

## Bar-splice arrangement

`data/music-arrangement.json` maps target beat ranges to source beats:

```json
{ "source": "./assets/audio/music/bgm-raw.mp3", "output": "./assets/audio/music/bgm.flac",
  "bpm": 110, "beat0": 0.04, "crossfade": 0.025, "fadeOut": { "beat": 244, "seconds": 6.5 },
  "segments": [ { "to": [0, 16], "from": 0, "role": "intro" }, { "to": [40, 76], "from": 76, "role": "drop A" } ] }
```

- Copy whole bars (multiples of 4 beats) so phrasing stays musical; take each
  target drop from a source bar where a build resolves into a drop.
- A gap between segments (e.g. target beats 38–40 left empty) becomes a silent
  stop: the classic place for a shout line right before the drop.
- Joins are 25 ms crossfades that end exactly on the target downbeat.
- The first segment must start at 0 s. If it starts later, ffmpeg `amix`
  re-bases the stream and every segment shifts (a uniform 40 ms lag happened).
- Verify with `scripts/verify-arrangement.py <project>`; the reference result was
  within ±0.5 ms for all nine segments.

## Timeline anchors

In `build-timeline.mjs`: `KICK` lists beat ranges where the full beat plays
(drives visual pulses), `DROPS` the drop beats (big flash/shake/speed lines),
`ANCHORS` pins scene cuts and line onsets to `beat(n)` or seconds. Scenes without
anchors cut on the first beat at least 0.12 s after the previous voice ends.
Comic anchors: "Let's go!" at beat 38 (silent stop), feature 01 at drop A
(beat 40), feature 07 at drop C (152), the word "Nits" on the final drop (200),
outro on the calm bed from 136.4 s.

## Mix

```text
music  -5 dB  -> sidechaincompress(threshold=0.03, ratio=3, attack=15, release=350, makeup=1) keyed by the voice bus
voice  per-scene gain to -16 LUFS, peaks <= -1 dBFS
sfx    per-file gain to -16 LUFS, cue vol on top
sum -> 3.5 s fade out -> two-pass loudnorm I=-14 TP=-1.5 LRA=11 -> AAC 192k 48 kHz (./assets/audio/mix.m4a)
```

Balance target: music ~5 dB under the voice while speaking and near voice level
in the gaps. The first edition used −7 dB with ratio 5 / threshold 0.02: the
music sat ~10 dB under the voice and viewers reported "there is no music".
Measure with `build-timeline.mjs --stems` + `scripts/measure-mix-balance.py`
instead of trusting the numbers by ear on laptop speakers.

The voice bus is also rendered to a mono envelope at the video frame rate
(`data/vo-envelope.json`, `TIMING.env`) that drives mouths and waveforms.
