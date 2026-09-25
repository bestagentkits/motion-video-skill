# Production pipeline

The end-to-end flow that produced both reference videos. Each step feeds a file
to the next, so run them in this order. Paths are relative to the project dir
(e.g. `assets/videos/<slug>/`) and written `./scripts/...` for the project's
copies; `<skill>` is this skill's directory.

## 0. Scaffold

```text
<project>/
  index.html                 composition (start from <skill>/assets/templates/index-skeleton.html)
  hyperframes.json           copy <skill>/assets/templates/hyperframes.json
  data/                      script.json, sfx.json, cues.json, music-plan.json, outro-plan.json, music-arrangement.json
  scripts/                   copy <skill>/assets/templates/scripts/*.mjs and <skill>/scripts/fit-beat-grid.py
  assets/fonts/              local TTF files (OFL/Apache fonts from Google Fonts)
  assets/images/             baked texture tiles (PNG)
  assets/audio/{vo,sfx,music}/
  renders/
```

Start the data files from `<skill>/assets/templates/data/*.example.json`.
Keep one project per video; a restyle of an existing video is a new project dir
so the first edition stays untouched.

## 1. Facts and script

- Collect facts only from primary sources (release notes, repo docs, code). Every
  on-screen label must trace to one; write the evidence into a short report
  under `plans/reports/` before scripting.
- `data/script.json`: `voice` (model, voice, style), `outroStyle`, `scenes[]`.
  Each scene has `id` (`sNN-slug`, used as the VO file name and the timing key),
  optional `outro: true`, and `lines[]` with `en` (displayed/aligned text),
  optional `say` (pronunciation for TTS, e.g. "three point thirty-four"), and `vi`
  (caption). Keep one idea per line: lines are the unit of placement.
- Budget: ~150 words of VO per minute at TEMPO 1.08. The references are 144 s and
  151 s with 16 scenes (cover, stats, 12 features, stability, outro).

## 2. Generate audio (multix)

```bash
node ./scripts/generate-audio-assets.mjs vo      # Gemini TTS, one WAV per scene
node ./scripts/generate-audio-assets.mjs sfx     # ElevenLabs SFX from data/sfx.json
node ./scripts/generate-audio-assets.mjs music   # ElevenLabs Music from music-plan.json + outro-plan.json
```

`--force` regenerates, `--only=id1,id2` limits to some scenes/SFX. The script runs
multix in a temp dir because multix drops copies into `./multix-output`.
Credentials come from multix's own config; never print or copy key values.
Music details, the arrangement and the mix are in `audio-and-beat-sync.md`.

## 3. Align the voice

```bash
node ./scripts/align-voiceover.mjs        # ElevenLabs forced alignment -> data/vo-lines.json
```

Warnings like `12 aligned words vs 13 script tokens` mean `say`/`en` tokenize
differently from what was spoken; fix the text or re-generate that scene.

## 4. Beat grid and music arrangement

```bash
python ./scripts/fit-beat-grid.py ./assets/audio/music/bgm-raw.mp3 --min-bpm 100 --max-bpm 130
# edit data/music-arrangement.json (bpm, beat0, segments) from the bar table
node ./scripts/arrange-music.mjs          # -> ./assets/audio/music/bgm.flac
python <skill>/scripts/verify-arrangement.py .   # every segment lag within +-2 ms
```

## 5. Timeline and mix

Edit the `EDIT` block of `./scripts/build-timeline.mjs` (KICK ranges, DROPS,
OUTRO_BED, DURATION, ANCHORS), then:

```bash
node ./scripts/build-timeline.mjs --dry       # schedule only: scene starts (with beat numbers) and line spans
node ./scripts/build-timeline.mjs             # + captions, SFX cues, audio mix, voice envelope, TIMING injection
node ./scripts/build-timeline.mjs --no-audio  # timing only (keeps the existing mix and envelope)
node ./scripts/build-timeline.mjs --stems     # also writes stems for the balance check
python <skill>/scripts/measure-mix-balance.py .
```

Read every warning: `clips the previous voice`, `overlaps previous line`,
`voice runs past its scene end`, `cue: "word" #n not found`. Each one is a
visible or audible defect; fix the anchor or the cue rather than ignoring it.

## 6. Composition

Author `index.html` against `composition-contract.md` and one style reference.
Choreograph each scene with `W(sid, "word")` so reveals land on the spoken word.

## 7. Validate

```bash
npx --yes hyperframes@0.7.99 lint
npx --yes hyperframes@0.7.99 check
npx --yes hyperframes@0.7.99 snapshot --at 2,18.5,40,80,120,148 --describe false
```

`check` flags overlaps and contrast; use `data-layout-allow-overlap` only on
intentional overlaps (stacked cards, mascots over panels). Snapshots are large
PNGs: downscale to JPEG before viewing them if the tool context is limited.
Look at every scene's busiest moment, the caption band and the signature.

## 8. Render, restore the mix, verify

```bash
npx --yes hyperframes@0.7.99 render -q high -f 30 --strict -o renders/<slug>.mp4
ffmpeg -y -i renders/<slug>.mp4 -i ./assets/audio/mix.m4a -map 0:v:0 -map 1:a:0 -c copy -movflags +faststart renders/out.mp4
# replace renders/<slug>.mp4 with renders/out.mp4
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,sample_rate,channels -show_entries format=duration renders/<slug>.mp4
ffmpeg -i renders/<slug>.mp4 -af ebur128=peak=true -f null -          # ~ -14 LUFS, peak <= -1 dBFS
ffmpeg -i renders/<slug>.mp4 -vf blackdetect=d=0.1:pix_th=0.05 -an -f null -   # no black segments except the fades
```

The remux matters: the renderer re-encodes AAC and pushed the true peak to
0.0 dBFS in the first edition; copying the untouched `mix.m4a` keeps −14 LUFS /
−1.5 dBTP.

## 9. Social encode

```bash
ffmpeg -y -i renders/<slug>.mp4 -c:v libx264 -preset slow -crf 21 -maxrate 6M -bufsize 12M \
  -pix_fmt yuv420p -profile:v high -level 4.1 -g 60 -c:a aac -b:a 192k -ar 48000 \
  -movflags +faststart renders/<slug>-social.mp4
```

Result on the comic edition: 406 MB → 101.6 MB, SSIM 0.977. Check with
`ffmpeg -i social.mp4 -i master.mp4 -lavfi ssim -f null -` when quality matters.

## 10. Studio preview

```bash
npx --yes hyperframes@0.7.99 preview --port 3002 --no-open .
```

Run it as a tracked background process, reuse it if the port is already held
by this project, and stop it when the session ends.

## Rebuild cheatsheet

| Changed | Re-run |
|---|---|
| Script text of a scene | `generate-audio-assets vo --only=<id> --force` → `align-voiceover --force` → `build-timeline` |
| Music track | `fit-beat-grid` → edit arrangement → `arrange-music` → `verify-arrangement` → `build-timeline` |
| Anchors / cues | `build-timeline` (audio changes) or `--no-audio` (captions/timing only) |
| Visuals only | `lint` → `check` → `render` → remux |
