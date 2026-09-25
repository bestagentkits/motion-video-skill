// Forced-aligns every voice-over clip against its spoken text (ElevenLabs align via multix)
// and writes data/vo-lines.json: per scene, per line start/end in clip-local seconds.
// Usage: node scripts/align-voiceover.mjs [--force]
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = JSON.parse(readFileSync(join(root, "data/script.json"), "utf8"));
const force = process.argv.includes("--force");
const alignDir = join(root, "data/align");
const workDir = join(os.tmpdir(), `${basename(root)}-multix`);
mkdirSync(alignDir, { recursive: true });
mkdirSync(workDir, { recursive: true });

const quote = (v) => `"${String(v).replace(/"/g, '\\"')}"`;
const run = (argv) =>
  new Promise((ok, fail) => {
    const child = spawn("multix", argv.map(quote), { shell: true, cwd: workDir });
    let log = "";
    child.stdout.on("data", (d) => (log += d));
    child.stderr.on("data", (d) => (log += d));
    child.on("close", (code) => (code === 0 ? ok(log) : fail(new Error(log.slice(-600)))));
  });

const spoken = (line) => line.say || line.en;
const tokens = (text) => text.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t));

const queue = [...script.scenes];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const s = queue.shift();
      const out = join(alignDir, `${s.id}.json`);
      if (existsSync(out) && !force) continue;
      const text = s.lines.map(spoken).join(" ");
      await run(["elevenlabs", "align", "--input", join(root, `assets/audio/vo/${s.id}.wav`), "--text", text, "--output", out]);
      console.log(`aligned ${s.id}`);
    }
  }),
);

// Map aligned words back onto script lines by token count (alignment keeps text order).
const result = {};
for (const s of script.scenes) {
  const align = JSON.parse(readFileSync(join(alignDir, `${s.id}.json`), "utf8"));
  const words = align.words.filter((w) => /[\p{L}\p{N}]/u.test(w.text));
  let i = 0;
  const lines = s.lines.map((line) => {
    const n = tokens(spoken(line)).length;
    const seg = words.slice(i, i + n);
    i += n;
    return { start: seg[0].start, end: seg[seg.length - 1].end, words: seg.map((w) => ({ t: w.text, s: w.start, e: w.end })) };
  });
  if (i !== words.length) console.warn(`${s.id}: ${words.length} aligned words vs ${i} script tokens`);
  result[s.id] = { speechStart: lines[0].start, speechEnd: lines[lines.length - 1].end, lines };
}
writeFileSync(join(root, "data/vo-lines.json"), JSON.stringify(result, null, 1));
for (const [id, v] of Object.entries(result)) console.log(id, v.speechStart.toFixed(2), v.speechEnd.toFixed(2), v.lines.map((l) => `${l.start.toFixed(2)}-${l.end.toFixed(2)}`).join(" | "));
