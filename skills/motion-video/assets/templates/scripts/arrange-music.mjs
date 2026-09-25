// Re-arranges the generated music track on its own beat grid so its drops land where the video needs them.
// ElevenLabs does not honour composition-plan section lengths, so whole bars are copied from the raw track
// to target beats (data/music-arrangement.json) and joined with short crossfades that finish on each downbeat.
// Usage: node scripts/arrange-music.mjs
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plan = JSON.parse(readFileSync(join(root, "data/music-arrangement.json"), "utf8"));
const BEAT = 60 / plan.bpm;
const at = (n) => plan.beat0 + BEAT * n; // same grid for source and target
const XF = plan.crossfade;
const FMT = "aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo";

const graph = [`[0:a]${FMT},asplit=${plan.segments.length}${plan.segments.map((_, i) => `[s${i}]`).join("")}`];
plan.segments.forEach(({ to: [a, b], from }, i) => {
  // each piece spans [downbeat(a) - XF, downbeat(b)]: it fades in before its first downbeat and out before the next piece's.
  // The first piece starts at 0 s: the mixed stream is re-based to its earliest sample, so nothing may start later.
  const pre = i === 0 ? at(a) : XF;
  const src = at(from) - pre;
  const len = (b - a) * BEAT + pre;
  const dst = at(a) - pre;
  graph.push(
    `[s${i}]atrim=start=${src.toFixed(4)}:duration=${len.toFixed(4)},asetpts=PTS-STARTPTS,` +
      `afade=t=in:d=${pre || 0.005},afade=t=out:st=${(len - XF).toFixed(4)}:d=${XF},adelay=delays=${Math.round(dst * 1000)}:all=1[p${i}]`,
  );
});
const end = at(plan.segments.at(-1).to[1]);
const fade = at(plan.fadeOut.beat);
graph.push(
  `${plan.segments.map((_, i) => `[p${i}]`).join("")}amix=inputs=${plan.segments.length}:normalize=0:dropout_transition=0,` +
    `afade=t=out:st=${fade.toFixed(3)}:d=${plan.fadeOut.seconds},atrim=0:${end.toFixed(3)}[out]`,
);

const out = join(root, plan.output);
execFileSync("ffmpeg", ["-hide_banner", "-v", "error", "-y", "-i", join(root, plan.source), "-filter_complex", graph.join(";"), "-map", "[out]", "-c:a", "flac", out]);
for (const { to: [a, b], from, role } of plan.segments) {
  console.log(`beats ${String(a).padStart(3)}–${String(b).padEnd(3)} (${at(a).toFixed(2)}s) ← source beat ${from}  ${role}`);
}
console.log(`music -> ${out} (${end.toFixed(2)}s, fade from ${fade.toFixed(2)}s)`);
