# AGENTS.md

Operating notes for agents working in this repository.

## What this repository is

A single-skill package that publishes the `motion-video` agent skill. The
repository root **is** the plugin root: `plugin.json` and `skills/` both live at
the top level, and the three plugin manifests all point here. This is what makes
one checkout installable by `npx skills`, by the Claude Code plugin marketplace,
and by ChatGPT/Codex at once, without duplicating a single file.

## Ground rules

- **The skill lives at `skills/motion-video/` and nowhere else.** That path is
  what `npx skills`, the Claude Code plugin loader and portable Agent Plugins
  discovery all read. Do not move it, and do not create a second copy under a
  `plugins/` directory.
- **Never commit generated media.** Voice-over, music, sound effects, `mix.m4a`
  and renders stay out of git; `.gitignore` already covers the conventional
  paths. The generated audio is also provider-licensed, which is the reason the
  two reference editions are linked rather than bundled.
- **Treat the ids as public API.** The plugin id is `motion-video`, the
  marketplace id is `motion-video-skill`, and users install with
  `motion-video@motion-video-skill`. Renaming either one breaks every install
  command in the wild.
- **Bump versions together.** When the skill's version changes, update `version`
  in `plugin.json` and in both `.claude-plugin` manifests in the same commit.
- **Keep the manifests in sync** when the name, description, license,
  homepage or repository changes:
  - `plugin.json` — portable Agent Plugins manifest, read by ChatGPT and Codex
  - `.claude-plugin/plugin.json` — Claude Code plugin manifest
  - `.claude-plugin/marketplace.json` — Claude Code marketplace catalog
  - `.agents/plugins/marketplace.json` — ChatGPT/Codex repo marketplace catalog
- **Change the skill only when the task says so.** `skills/motion-video/` is a
  working, already-shipped skill. Packaging chores do not license edits to its
  scripts or its pipeline references.
- **Never print or commit API keys.** Credentials belong in `multix`'s own
  configuration, never in project files, plans or reports.

## Language and layout

- Repository documentation is English. `SKILL.md` may quote Vietnamese examples,
  because the captions the skill produces are Vietnamese by default.
- Markdown outside `README.md` and `AGENTS.md` belongs in `docs/` when it is
  meant to be published, and in `plans/` when it is working material.

## Verify before committing

```bash
python -m unittest discover -s skills/motion-video/scripts/tests
claude plugin validate .
npx skills add . --list
python -c "import json; [json.load(open(f, encoding='utf-8')) for f in ['plugin.json', '.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', '.agents/plugins/marketplace.json']]; print('json ok')"
```

The unit tests cover the beat-grid fitter and the arrangement checker against
synthetic audio. They need `ffmpeg`, `numpy` and `scipy`.

`npx skills add . --list` must report exactly one skill, `motion-video`. If it
reports none, the manifest wiring or the `SKILL.md` frontmatter is broken.

## Do not

- Do not commit `skills/*.zip`. It is a build artifact that duplicates
  `skills/motion-video/`; regenerate it locally if a release needs one.
- Do not let an `SKILL.md` path point at a file that is not in this repository.
  In a fresh clone, every path the skill mentions must resolve.
- Do not add a `docs/` page that restates `README.md`. Prefer extending the
  skill's own `references/` files, which is where the operational detail belongs.
