# Composition contract

Rules every `index.html` follows, independent of the visual style. The skeleton
at `assets/templates/index-skeleton.html` implements all of them.

## HyperFrames runtime

- Root: `<div id="root" data-composition-id="main" data-start="0" data-duration="N"
  data-width="1920" data-height="1080">`. `build-timeline.mjs` rewrites
  `data-duration` on `#root` and `#mix` from `DURATION`.
- One paused GSAP timeline registered as `window.__timelines["main"]`; the
  renderer seeks it frame by frame. End with `tl.set({}, {}, T.duration)` so the
  timeline length equals the video length.
- Audio is one element: `<audio id="mix" src="./assets/audio/mix.m4a" data-start="0"
  data-duration="N" data-track-index="10" data-volume="1">`. Never let the page
  play separate VO/SFX files; the ffmpeg mix is the single source of sound.
- GSAP from `cdn.jsdelivr.net/npm/gsap@3.14.2`; fonts as local TTF files with
  `font-display: block`.

## Determinism

- All times come from `window.TIMING` (injected between `/*TIMING:BEGIN*/` and
  `/*TIMING:END*/`). No `Date`, no `requestAnimationFrame`, no CSS animations or
  transitions: only timeline tweens.
- Randomness only through the seeded `rng(seed)` helper.
- Build all DOM synchronously before the first tween (mascots, word spans,
  generated rows, SVG nodes). Nothing is created during playback.
- Use `immediateRender: false` on `fromTo` tweens that reuse a shared layer
  (flash, wipe, dots, speed lines, RGB offsets); otherwise the first tween's
  start state leaks to time 0.

## TIMING shape

```text
duration, fps, beat0, beatLen, kick[[from,to)], drops[beat], outroBeat,
scenes{ id: { start, end, lines[{ on, off, words[[word, start, end]] }] } },
captions[{ start, end, words[[text, start]] }], sfx[{ sfx, vol, t }], env[frame] (0..1)
```

Words are lower-cased with punctuation stripped (`"let's"`, `"v334"`), so look
them up that way.

## Helpers

| Helper | Use |
|---|---|
| `B(n)` | time of quarter note n |
| `isKick(n)` | beat n is inside a full-beat range; scale reactions by it |
| `W(sid, word, nth)` / `WE(...)` | onset / end of a spoken word; warns and falls back to scene start when missing |
| `envKeys(el, t0, t1, step, map)` | keyframes from the voice envelope (mouths, waveforms, meters) |
| `pop`, `rise`, `slideX`, `flipIn`, `draw`, `typeIn`, `bump`, `odo`, `fadeOut` | entrance vocabulary shared by both styles |
| `flash`, `shake` | cut/drop punctuation on shared layers |

Choreograph with word anchors: "the chip appears on the word *OAuth*", not
"0.8 s after the scene starts". Re-timing the voice then moves visuals with it.

## Scene windows

A `WINDOWS` table lists `[selector, scene id, transition, ...style fields]`. One
loop turns it into: transition in at the scene start, transition out just before
the next scene start (the out-transition matches the next window's kind), a
flash/speed accent on cuts scaled by `isKick`, and `intro(sc, t0)` for the
scene's headline. Scene starts come from `TIMING.scenes`, which already sit on
beats. Big moments (`TIMING.drops`) get their own flash + shake.

## Beat reactions

Loop `n` over beats until `outroBeat`; on kick beats pulse a background layer
(orbs or halftone), on kick downbeats scale a `#pulse` wrapper by ~1%. Keep it
subtle: reactions are texture, cuts and drops carry the rhythm.

## Captions

- Vietnamese karaoke: one `.cap` per caption chunk (≤ 9 words, split at
  punctuation), each word a span that highlights at its borrowed English onset.
- Bottom band only, width stops left of the signature (1660 px of 1920 in the
  comic edition). Nothing else may live in that band: `check` will flag overlap.

## Mascot and HUD

- Mascot is inline SVG built by a `mascot(uid, accessory)` function with
  `.m-move` (position), `.m-squash` (squash/stretch from the feet), `.m-face`
  (fake head turn by sliding the face), `.m-eyes`, `.m-pupils`, `.m-mouth`.
  Accessories per scene (headphones, cape, glasses) make it reusable.
- Talking = `envKeys` on `.m-mouth` scaleY between line on/off.
- A HUD counter (feature n / 12 + progress segments) runs from the first
  feature scene to the last and hides for cover and outro.

## Renderer limits

- More than ~40 elements with `radial-gradient`, `filter: blur()` or
  `clip-path` on screen produced black frames. Bake textures (halftone dots,
  grain, graffiti, distress) into PNG tiles under the project's `assets/images/` and use them as
  `background-image` or `mask-image`.
- Attach SVG filters (RGB split) only while an effect runs: `tl.set(el, { filter:
  "url(#rgb)" })` and back to `none` a few frames later.
- `visibility` toggles are cheaper than `opacity: 0` for heavy full-frame layers
  (halftone wipes).
- Keep `index.html` in one file unless it gets unwieldy; lint warns above ~1000
  lines (`composition_file_too_large`) but renders fine. The references are
  1332 and 1636 lines.

## Signature

"Zuey" handwritten signature bottom-right from 1.0 s to the end: text revealed
with a stepped `clipPath`, underline drawn with `strokeDashoffset`. Style it to
match the video (marker font with misregistration for comic).
