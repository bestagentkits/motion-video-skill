# Style: comic multiverse (Spider-Verse inspired)

Loud, hand-made comic energy: halftone Ben-Day dots, thick ink outlines,
cyan/magenta misregistration, RGB glitch cuts, halftone dot wipes, speed-line
bursts, graffiti, a skyline in exaggerated perspective, and motion "on twos".
Reference edition: the [published Dewee v3.34 comic
video](https://x.com/goon_nguyen/status/2103332658151555231), 151 s, 110 BPM,
voice Fenrir, drops at beats 40/152/200, signature "Zuey".

Choose it for hype launches, social cuts and anything that should feel young
and playful. Inspired by the look only: no Marvel names, logos or characters.

## Tokens

```css
--ink: #0d0a1a; --paper: #fff6e5; --cyan: #19d3ff; --magenta: #ff2e9a;
--red: #ff2b3a; --yellow: #ffd21f; --purple: #5b1fd1; --violet: #1a0b3d;
--orange: #ff7a1a; --green: #2ee59d;
--rx: 0;   /* misregistration offset, animated on beats */
```

Fonts (all OFL except Permanent Marker, Apache 2.0): Anton (headlines), Bangers
(labels, kickers, SFX words), Permanent Marker (signature, graffiti notes),
Be Vietnam Pro 700/800 (captions), JetBrains Mono (code, logs).

## Layers (back to front)

`#stage` wraps the whole world and receives the RGB glitch filter. Inside it:
five "universes" (`.uni#u-night|cyan|sun|punk|red`, full-frame gradient
backgrounds cross-faded per scene) → `#rays` (repeating-conic sunburst, slow
140° rotation) → `#skyline` (per-scene toggle) → `#tags` (graffiti PNG, slow
drift) → `#tone` (dots PNG with radial mask, pulses on beats) → `#shake` →
`#pulse` → scenes `#sc01…#sc16`. Above the stage: `#speed` → `#glitch-bars` →
`#dots` (halftone wipe) → `#flash` → `#hud` → `#captions` → `#sig` → `#grain`
(overlay PNG) → `#edge` vignette → `#fade`.

Baked textures in the project's `assets/images/`: `dots-ink.png`, `dots-cyan.png`,
`dots-pink*.png`, `grain.png`, `graffiti-tags.png`, `distress.png`,
`grid-dot.png`. They exist because the live radial-gradient versions blacked out
frames in the renderer.

## Components

- `.panel`: paper card, 6 px ink border, triple offset shadow
  `-6px -4px 0 cyan, 6px 4px 0 magenta, 16px 16px 0 ink`, halftone `::before`
  in a corner mask, optional `.hatch` cross-hatching, `.dark` variant with pink dots.
- `.hl`: Anton uppercase, yellow fill, 3 px ink stroke, text-shadow cyan/magenta
  offset by `var(--rx)` plus a stacked ink extrusion, `distress.png` mask.
- `.kick`: yellow Bangers caption box rotated −3°, hard ink shadow.
- Mascot: purple blob with cyan/magenta ghost copies behind it (print
  misregistration), halftone shading clipped to the body, accessories.
- HUD: a tilted comic corner box, "DEWEE COMICS / No. 01 / 12", flip counter
  and progress segments.
- Diagrams are drawn as comic panels: terminal logs, force-graph snapshots from
  the seeded rng, stamped `✓ allow` / `✗ deny` rows, bug sprites squashed on
  words.

## Motion language

- On twos: `on2(duration, baseEase)` quantises any ease to 12 steps per second,
  so poses hold like hand-drawn animation. Use it for character and UI motion;
  keep camera-ish moves (background drift, universe fades) smooth.
- Transitions: `none`, `glitch` (RGB split via SVG `feOffset` on `#rgb-r`/`#rgb-b`
  + slice bars, 0.28 s), `dots` (halftone dots swell to cover the frame then
  shrink, `--r` 0 → 46 → 0), `flip` (page turn from the left edge), `slam`
  (scale 1.3 → 1 with power4.in + shake), `fade` (outro only).
- Every cut also gets `flash` + `speed` lines (stronger on kick beats); the three
  drops get flash 0.8, shake 1.1–1.4 and full speed lines.
- Beat reactions: `--rx` misregistration kick on every other beat, `#tone`
  scale/opacity pulse, `#pulse` 1.2% scale on kick downbeats.
- Headline intro: kick label slides in, then each `.hl .w` flips up in 3D
  (rotationX −70 → 0) with a stagger.
- Outro drops the comic energy: universe to "night", rays dim, mascot floats
  with blinks, lines fade in slowly: "Coming soon → Real soon → September 2026
  → To be continued".

## Captions

Yellow narration box (5 px ink border, hard ink + cyan shadow), 40 px Be Vietnam
Pro 800, ink text; the current word turns `#a3005a`. Width stops at 1660 px so
it never touches the signature.

## Signature

`#sig` bottom-right (right 40, bottom 22): "Zuey" in Permanent Marker 76 px,
white fill with ink stroke and cyan/magenta/ink shadows, revealed with
`steps(8)` clip; a magenta underline stroke draws in after it.
