# Style: glass keynote

A calm, premium tech-launch look: deep `--bg` space, drifting colour orbs,
frosted glass cards, gradient display type with an italic serif accent. Reads
like a product keynote. Reference edition: the 144 s Dewee v3.34 launch video
(124 BPM, voice Puck, drop at beat 36).

Choose it for product launches, changelogs and explainers where clarity and
polish matter more than energy.

## Tokens (reference edition only)

These are the Dewee v3.34 edition's colours. A new video takes its palette from
`design/style.json` (see `style-direction.md`) and maps it onto the same roles:
`--bg` → bg, `--ink` → ink, `--mute`/`--dim` → mute, `--lilac`/`--violet` →
accent, `--pink`/`--sky` → accent2, `--grad` → accent → accent2.

```css
--bg: #070817; --ink: #f5f3ff; --mute: #aeacd6; --dim: #8f8dbb;
--lilac: #c4b5fd; --violet: #8b5cf6; --pink: #f0abfc; --sky: #60a5fa;
--green: #34d399; --amber: #fbbf24; --red: #f87171;
--stroke: rgba(196, 181, 253, 0.26);
--grad: linear-gradient(100deg, #f0abfc 0%, #a78bfa 45%, #60a5fa 100%);
```

Fonts: Plus Jakarta Sans (variable, 800 for headlines), Instrument Serif Italic
(accent words inside headlines, gradient-filled), JetBrains Mono (kickers, labels,
code), Be Vietnam Pro 600–800 (captions: full Vietnamese diacritics).

## Layers (back to front)

`#bg` → `#orbs` (three large radial glows, 48 s sine drift loops) → `#grid`
(dot grid, radial mask, brightens on beats) → `#vignette` → `#pulse` wrapper →
scenes → `#wipe` (rotated light band swept across on kick cuts) → HUD →
captions → `#flash` → `#fade`.

## Components

- `.kicker`: mono uppercase label with a gradient number badge, top-left at 120/88.
- `.h1`: 70 px Plus Jakarta 800, `-0.035em` tracking, `<em>` words in Instrument
  Serif italic with `--grad` text fill.
- `.card`: glass panel, vertical `--surface` gradient at 94% alpha, 1.5 px `--stroke`
  border, radius 24, deep soft shadow plus an inner top highlight.
- `.chip` pills with state colours (green ok, amber warn, red fail, sky info, "new").
- Chat bubbles, terminal lines (`.term-line`), level badge (`.lvl`, amber
  gradient) with an XP bar, odometer `.tile` digits (`odo` helper), 3D flip cards
  (`.face.front` / `.face.back`, `backface-visibility: hidden`), data packets and
  sparks moving along drawn SVG paths.
- `.slam`: 200 px gradient word for the big number/statement moments.
- Mascot: soft blob in the accent colour with accessories (headphones, cape, glasses), plus a
  small HUD mascot that squashes on every kick.

## Motion language

- Transitions: `none`, `up` (y 110 → 0, power3.out 0.5 s), `zoom` (scale 1.3 →
  1, expo.out), `flip` (rotationY −70, perspective 2200), `iris` (clip-path
  circle 0 → 80%), `fade` for the outro. Rotate through them so no two neighbour
  scenes share a transition.
- Out: fade + scale 0.95 in 0.22 s; the scene before the drop zooms through
  (scale 2.2) into it.
- Eases are smooth (power3/expo/back); nothing is stepped.
- Cuts get a light flash (0.14, or 0.3 on kick beats) and the `#wipe` band on kicks.

## Captions

Translucent pill (`--cap-bg`, radius 20, 46 px caption face 700), unread words
`--cap-unread`, the current word `--cap-hl`, then `--cap-ink`. The reference used
`rgba(10, 8, 30, 0.72)`, `#e9d5ff` and white.

## Known issue in the reference

Its mix used music −7 dB with sidechain ratio 5 / threshold 0.02, which sat the
music ~10 dB under the voice. Use the balance from `audio-and-beat-sync.md` for
new work. It has no signature; add the one from `composition-contract.md` if the
video needs it.
