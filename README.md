# Motion Video

An agent skill that produces a beat-synced 1920×1080 30 fps motion-graphic video:
the scene cuts land on the music's beats, the reveals land on the spoken words,
and the audio is broadcast-clean.

```bash
npx skills add bestagentkits/motion-video-skill
```

MIT licensed. Works with Claude Code, Codex, Cursor, OpenCode, Gemini CLI, Pi and
any other agent that reads Agent Skills.

## Demo

The comic-multiverse edition of the Dewee v3.34 release video, produced by this
skill from a single prompt:

**→ [Watch the 151 s demo on X](https://x.com/goon_nguyen/status/2103332658151555231)**

The same release also has a 144 s glass-keynote edition. Neither working project
is bundled with this repository, because the generated voice-over, music and SFX
are large and provider-licensed.

## What it does

Each run follows one fixed pipeline, and every step writes the file the next step
reads, so the order matters:

1. Pin the outcome: topic and sources, style, duration, voice language, ending.
2. Scaffold `assets/videos/<slug>/` from the bundled templates.
3. Generate the voice-over, sound effects and music through the `multix` CLI.
4. Align the voice-over to the script, so every word has a real timestamp.
5. Fit the beat grid, then splice music bars so the drops fall where the script
   needs them.
6. Build the timeline and the audio mix, then measure the voice/music balance.
7. Author `index.html` against the composition contract and the chosen style.
8. Lint, check, snapshot and render with HyperFrames, remux the untouched mix,
   and encode a smaller social version.

A run is finished only when the measurable checks pass: `hyperframes lint` and
`check` clean, every music segment within ±2 ms of its target beat, music about
4–6 dB under speech, 1920×1080 at 30 fps, and EBU R128 around −14 LUFS with a
true peak no higher than −1 dBFS.

## Two styles

| Style | Style reference | Demo | Feel |
|---|---|---|---|
| Comic multiverse | [`references/style-comic-spiderverse.md`](skills/motion-video/references/style-comic-spiderverse.md) | [151 s edition](https://x.com/goon_nguyen/status/2103332658151555231) | loud, playful, hand-made |
| Glass keynote | [`references/style-glass-keynote.md`](skills/motion-video/references/style-glass-keynote.md) | 144 s edition | premium, calm, clear |

A restyle is a new project directory, so the first edition always stays intact.

## Install

### Any agent, with `npx skills`

The fastest route, and the one that works across agents:

```bash
# See what the repository offers without installing
npx skills add bestagentkits/motion-video-skill --list

# Install into the detected agents inside this project
npx skills add bestagentkits/motion-video-skill

# Install globally for Claude Code, without prompts
npx skills add bestagentkits/motion-video-skill -g -a claude-code -y

# Use it once, without installing
npx skills use bestagentkits/motion-video-skill@motion-video | claude
```

Useful flags: `-g` installs to your user directory instead of the project,
`-a <agent>` targets specific agents such as `claude-code` or `codex`, `--copy`
copies instead of symlinking, and `-y` skips the prompts.

### Claude Code plugin marketplace

```text
/plugin marketplace add bestagentkits/motion-video-skill
/plugin install motion-video@motion-video-skill
/reload-plugins
```

The same thing from a shell:

```bash
claude plugin marketplace add bestagentkits/motion-video-skill
claude plugin install motion-video@motion-video-skill
```

Invoke the skill as `/motion-video:motion-video`, or just describe the video you
want and let Claude route to it.

### ChatGPT and Codex plugins

The repository ships a portable [Agent Plugins](https://developers.openai.com/plugins/build/plugins)
manifest at the root and a repo marketplace catalog, which is the layout ChatGPT
and Codex expect for a skills-only plugin:

```bash
codex plugin marketplace add bestagentkits/motion-video-skill
codex plugin marketplace list
```

In the ChatGPT desktop app, open the Plugins Directory, select the marketplace,
and Install. For a personal marketplace instead of a repo one, add an entry to
`~/.agents/plugins/marketplace.json` pointing at this repository root.

Public listing in the universal ChatGPT/Codex Plugins Directory is a separate
step that goes through OpenAI's
[submission portal](https://developers.openai.com/plugins/deploy/submission) and
its review process; the package here is already in the submitted shape.

### Manual install

Copy `skills/motion-video/` into your agent's skills directory. Any of these
locations work, depending on the agent and the scope you want:

| Agent | Project scope | User scope |
|---|---|---|
| Claude Code | `.claude/skills/motion-video/` | `~/.claude/skills/motion-video/` |
| Codex, Cursor, Gemini CLI, OpenCode | `.agents/skills/motion-video/` | `~/.<agent>/skills/motion-video/` |
| Pi | `.pi/skills/motion-video/` | `~/.pi/agent/skills/motion-video/` |

## Requirements

| Requirement | Why |
|---|---|
| Node.js 20+ | The pipeline scripts are ESM and run with `node`. |
| Python 3.10+ with `numpy` and `scipy` | Beat-grid fitting, arrangement verification, mix-balance measurement. |
| `ffmpeg` and `ffprobe` on `PATH` | Decoding, mixing, remuxing, loudness and black-frame checks. |
| The `multix` CLI, authenticated with a Gemini key and an ElevenLabs key | Voice-over, sound effects, music composition plans and forced alignment. |
| `npx --yes hyperframes@0.7.99` | Lint, check, snapshot, preview and render. No install step is needed. |

Keep API keys in the `multix` CLI's own configuration. The skill never prints key values
and never writes them into project files, plans or reports.

## Quick start

Install the skill, then ask your agent for the video:

```text
Make a 100-second launch video for the 3.34 release with a voice-over,
captions and music, in the comic multiverse style.
```

To drive the pipeline yourself, start from the templates:

```bash
mkdir -p assets/videos/my-video
cp -r skills/motion-video/assets/templates/scripts skills/motion-video/assets/templates/data \
      skills/motion-video/assets/templates/hyperframes.json \
      skills/motion-video/assets/templates/index-skeleton.html \
      assets/videos/my-video/
cd assets/videos/my-video
# rename data/*.example.json to data/*.json,
# and index-skeleton.html to index.html
```

Then follow
[`references/production-pipeline.md`](skills/motion-video/references/production-pipeline.md)
step by step. In the skill's own documentation, `<skill>` means the installed
skill directory, for example `~/.claude/skills/motion-video`.

## What is in the box

```text
.
├── .agents/plugins/marketplace.json    ChatGPT / Codex repo marketplace catalog
├── .claude-plugin/
│   ├── marketplace.json                Claude Code marketplace catalog
│   └── plugin.json                     Claude Code plugin manifest
├── plugin.json                         Portable Agent Plugins 1.0 manifest
├── skills/motion-video/
│   ├── SKILL.md                        Routing and the definition of done
│   ├── references/
│   │   ├── production-pipeline.md      Every command, scaffold to social encode
│   │   ├── audio-and-beat-sync.md      Voice, cues, music plans, splice, mix
│   │   ├── composition-contract.md     TIMING shape, helpers, determinism
│   │   ├── style-glass-keynote.md      Tokens, layers, transitions, captions
│   │   └── style-comic-spiderverse.md  The second style, same contract
│   ├── scripts/
│   │   ├── fit-beat-grid.py            BPM, BEAT0 and a per-bar kick/energy table
│   │   ├── verify-arrangement.py       Splice lag per segment; exits 1 on drift
│   │   ├── measure-mix-balance.py      Music under speech versus in the gaps
│   │   └── tests/                      Regression tests on synthetic audio
│   └── assets/templates/
│       ├── index-skeleton.html         Composition skeleton
│       ├── hyperframes.json            Renderer configuration
│       ├── scripts/                    Voice, SFX, music, alignment, timeline
│       └── data/                       Example script, cues, SFX, music, outro
├── AGENTS.md                           Operating notes for agents working here
├── README.md
└── LICENSE
```

The plugin root is the repository root, so `skills/` sits at the top level and no
file is duplicated between the skill package and the plugin manifests.

## Tests

```bash
python -m unittest discover -s skills/motion-video/scripts/tests
```

The suite runs the beat-grid fitter and the arrangement checker against synthetic
audio, so it needs `ffmpeg`, `numpy` and `scipy`, and no network access.

## License

MIT. See [LICENSE](LICENSE).

No generated media is bundled. The skill instructs the agent to use open-licensed
(SIL OFL or Apache) fonts from Google Fonts, and it produces its voice-over, music
and sound effects inside your own provider accounts.
