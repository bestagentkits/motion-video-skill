# Style direction

Every video gets its own palette and type, chosen by the user from three
generated style frames before any script or audio work starts. The two style
references (`style-glass-keynote.md`, `style-comic-spiderverse.md`) supply the
motion grammar: layers, components, transitions, caption mechanics. Their
colour tokens describe the reference editions only; do not reuse them as a
default. Reusing them is why earlier videos all came out indigo and violet.

## The choice is a mandatory user gate

The user always picks the style. You never pick it for them. A brief, a brand
book, a design system, a coordinator's note or an instruction such as "do it
end to end" or "làm trọn gói" does not waive the gate. Skip it only when the
user has, in their own words in this task, named the direction to use or said
to skip the style choice. Record that quote in `style.json` as `"chosenBy"`.

When a brand book or token file already fixes the palette and type, still write
three directions. Keep the brand colours and fonts, and make the directions
differ in grammar, composition, texture, type scale and motion. The hue-family
rules in step 1 then do not apply.

## 1. Write three directions

Read the brief (topic, audience, brand colours if any, the energy the user
wants) and write three directions into `design/directions.md`. Each one has:

- **Name** and a one-sentence mood tied to the topic, not to a generic look.
- **Grammar**: `glass-keynote`, `comic-multiverse`, or `derived` (a new look
  built on one of the two grammars; name which one and what changes).
- **Palette**: the token roles in `style.json` below as hex values.
- **Fonts**: display, body, caption and mono faces. Use OFL or Apache fonts from
  Google Fonts. The caption face must cover Vietnamese diacritics (Be Vietnam
  Pro, Inter, Montserrat, Nunito, Lexend and similar); check the family's
  subsets before choosing it.
- **Motion notes**: two or three lines on how the grammar changes (easing,
  texture, how cuts feel).

Make the three genuinely different:

- Three different hue families for `bg` + `accent`. At least one direction has
  a light background.
- Purple, violet, indigo and lilac (hue about 250–300°) are allowed only when
  the brand or the user asks for them, and then in at most one direction.
- Not all three on the same grammar unless the user fixed the grammar.
- Brand colours from the brief appear in at least one direction.
- Check caption contrast in each palette: `captionInk` on `captionBg` and
  `captionHl` on `captionBg` at 4.5:1 or better.

Mark exactly one direction **Recommended**: the one that best fits the
project's domain, audience and brief. Write down why in one sentence, naming
what in the domain it matches, such as the product category, the audience's
visual vernacular, the brand or the tone of the facts. Do not recommend a
direction because it is the safest or the easiest to build.

## 2. Generate one style frame per direction

Generate one 16:9 image per direction through `multix`, the CLI this skill
already uses for audio, and save it as `design/directions/<a|b|c>.webp`:

```bash
multix gemini generate --aspect-ratio 16:9 --size 2K --prompt "$(cat design/directions/a.prompt.txt)" --output design/directions/a.webp
```

Run it from a temp directory, as `generate-audio-assets.mjs` does, because
multix drops copies into `./multix-output`. Any other image model the agent
has works too; the brief is what matters. Start the three runs together and
wait for all three. The frame is a mock still of the real video, so the brief
must describe the video's own layout:

```text
Purpose: style frame (mock still) for a 1920x1080 motion-graphic video about <topic>. Landscape 16:9.
Layout: headline top-left at about x=120, y=380; one <grammar component: glass card / comic panel> on the right showing <a real feature from the script>; a caption band across the bottom at y≈960, left of a small handwritten signature in the bottom-right corner.
Exact text to render:
- headline, large: <3–5 words from the real cover line>
- card title: <feature name>
- caption band, 44 px: <one real Vietnamese caption line, diacritics exact>
Visual direction: <grammar summary>, palette <hex list with roles>, display face in the style of <font>, <texture/material notes>, <motion notes as a still: blur, speed lines, misregistration>.
Avoid: purple or violet unless listed in the palette, logos of real companies, extra text, watermarks.
```

Read each preview and check it before showing the user. The text must be
exact, the palette must match the hex list, and the layout must match the
brief. Rerun a frame once when it drifts.

## 3. Ask the user and wait

Show the three frames side by side. Open them with the Read tool and give the
paths, or publish a small comparison page when the runtime supports artifacts.
Then ask one question and stop:

- With the `AskUserQuestion` tool: one question with the three directions as
  options. Put the recommended one first with "(Recommended)" at the end of its
  label. Each option's description gives the mood, the palette and the reason
  it fits (or does not fit) the domain. The user can type a mix under "Other"
  ("B's palette with A's grammar").
- Without that tool (a delegated worker, a relay, a channel or a headless run):
  send the question as your reply, with the frame paths, the three options, the
  recommended one marked "(Recommended)" and its reason. Then end the turn. If
  you were delegated by another agent, return the question to it and ask it to
  relay the question to the user.

Do not scaffold, script, generate audio or pick a direction while you wait.
Silence is not consent: do not go ahead with the recommended option because
nobody answered.

## 4. Lock `design/style.json`

Write the chosen direction, including any mix the user asked for:

```json
{
  "name": "Signal Teal",
  "grammar": "glass-keynote",
  "frame": "design/directions/b.webp",
  "chosenBy": "user picked B (Recommended) on 2026-09-28",
  "mood": "calm operator console for a release about reliability",
  "palette": {
    "bg": "#06201f", "surface": "#0d302e", "ink": "#eefaf7", "mute": "#9cc5bf",
    "accent": "#2fd3b8", "accent2": "#ffb547", "ok": "#4ade80", "warn": "#fbbf24", "fail": "#f87171",
    "captionBg": "rgba(4, 22, 21, 0.78)", "captionInk": "#ffffff", "captionUnread": "rgba(255, 255, 255, 0.5)", "captionHl": "#7ff5e0"
  },
  "fonts": { "display": "Sora", "body": "Sora", "caption": "Be Vietnam Pro", "mono": "JetBrains Mono" },
  "motion": ["smooth expo eases", "wipe band in accent2 on kick cuts"],
  "avoid": ["purple", "violet"]
}
```

The values above are an example of the shape, not a default palette.

From here on `style.json` is the only source of colour and type:

- `index.html` declares `:root` tokens from it (`--bg`, `--surface`, `--ink`,
  `--mute`, `--accent`, `--accent-2`, `--ok`, `--warn`, `--fail`, `--cap-bg`,
  `--cap-ink`, `--cap-unread`, `--cap-hl`). Components use the tokens, never raw
  hex. Gradients, orbs, halftone tints and the mascot body are derived from
  `accent`/`accent2`/`surface`.
- Download the chosen fonts as local TTF files into `assets/fonts/`.
- Baked PNG textures (halftone dots, grain) are tinted with the palette.
- Review snapshots against `style.json` and the chosen frame before render.

## Restyles

A restyle of an existing video repeats this step with the old project's script
and facts. The reference editions' palettes are allowed only when the user
asks for that exact look.
