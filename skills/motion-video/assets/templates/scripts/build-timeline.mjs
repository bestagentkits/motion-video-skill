// Builds the master timeline for the composition:
// - places every voice-over line on the music's beat grid (scene cuts land on beats),
// - times the Vietnamese captions against the spoken English words,
// - resolves SFX cues (word / beat / scene-relative / absolute),
// - renders the final audio mix (ducked music + VO + SFX, loudness-normalized) with ffmpeg,
// - injects the timing data into index.html and writes data/timeline.json.
// Usage: node scripts/build-timeline.mjs [--no-audio] [--dry] [--stems]
// Template from the motion-video skill: edit the block marked EDIT (grid sections, anchors, duration) per project.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const script = readJson("data/script.json");
const vo = readJson("data/vo-lines.json");
const noAudio = process.argv.includes("--no-audio");
const dry = process.argv.includes("--dry"); // print the schedule only
const stems = process.argv.includes("--stems"); // also write the ducked-music and voice stems to the temp dir
const cues = dry ? [] : readJson("data/cues.json");
const work = join(os.tmpdir(), `${basename(root)}-mix`);
mkdirSync(work, { recursive: true });

// ---------- EDIT per project: grid sections, duration and musical anchors ----------
// Music grid of bgm.flac (see scripts/arrange-music.mjs): quarter note n sits at BEAT0 + n * BEAT.
// The raw ElevenLabs track was fitted at 110 BPM from its onsets, then re-arranged on that same grid.
const arrangement = readJson("data/music-arrangement.json");
const BEAT0 = arrangement.beat0;
const BEAT = 60 / arrangement.bpm;
const beat = (n) => BEAT0 + BEAT * n;
const nextBeat = (t) => beat(Math.ceil((t - BEAT0) / BEAT - 1e-6));
// Quarter-note ranges [from, to) where the full beat plays; the rest is intro, builds, silent stop, breakdown, tail.
const KICK = [[40, 76], [88, 140], [152, 188], [200, 244]];
const DROPS = [40, 152, 200]; // drop A, drop C, final drop
const OUTRO_BEAT = arrangement.fadeOut.beat; // the main track fades out from here
const OUTRO_BED = 132.2; // the calm outro composition (outro-raw.mp3) starts here, under the tail of the main track
const DURATION = 151;
const FPS = 30;
const TEMPO = 1.08; // energetic lines play 8% faster; outro lines keep their natural pace
const CUT_AFTER = 0.12; // the next scene cuts on the first beat at least this long after the last spoken word
const VO_LEAD = 0.05; // voice segment begins this long after a scene cut
const SEG_PRE = 0.08; // audio kept before a line's first word
const SEG_POST = 0.15; // audio kept after a line's last word

// Hand-placed anchors in global seconds. `scene` = cut time, `lines[i]` = onset of line i's first word.
// Scenes without an anchor cut on the next beat after the previous voice ends.
const ANCHORS = {
  "s01-cover": { scene: 0, lines: [beat(3), beat(14)] }, // the cover slams in first, then the narrator
  "s02-stats": { scene: beat(20), lines: [beat(22), beat(38)] }, // "Let's go!" sits in the silent stop before the drop
  "s03-jev": { scene: beat(40), lines: [beat(40) + 0.12] }, // drop A opens power 01
  "s09-backup": { scene: beat(152), lines: [beat(152) + 0.12] }, // drop C opens power 07
  "s12-advisor": { lines: [null, beat(200)] }, // the final drop hits on "Nits"
  "s16a-outro": { scene: 136.4, lines: [136.8, 140.0] }, // the outro breathes on the calm bed
  "s16b-outro": { scene: 141.6, lines: [141.9] },
  "s16c-outro": { scene: 143.6, lines: [143.9] },
};

const norm = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, "");
const round = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;

// ---------- END EDIT ----------

// ---------- 1. schedule voice lines ----------
const scenes = [];
let prevOff = 0;
let prevVoEnd = 0;
for (const s of script.scenes) {
  const a = ANCHORS[s.id] || {};
  const tempo = s.outro ? 1 : TEMPO;
  const src = vo[s.id].lines;
  // Segment bounds: pad each line, but never cross the midpoint of the gap to its neighbour.
  const segs = src.map((l, i) => {
    const prevMid = i ? (src[i - 1].end + l.start) / 2 : 0;
    const nextMid = i < src.length - 1 ? (l.end + src[i + 1].start) / 2 : Infinity;
    return { a: Math.max(0, l.start - SEG_PRE, prevMid), b: Math.min(l.end + SEG_POST, nextMid) };
  });
  const sceneAt = a.scene ?? nextBeat(prevOff + CUT_AFTER);
  if (sceneAt < prevVoEnd - 0.2) console.warn(`${s.id}: cut at ${sceneAt.toFixed(2)} clips the previous voice (${prevVoEnd.toFixed(2)})`);
  const lines = [];
  src.forEach((l, i) => {
    const seg = segs[i];
    const lead = (l.start - seg.a) / tempo;
    let place;
    if (a.lines?.[i] != null) place = a.lines[i] - lead;
    else if (i === 0) place = sceneAt + VO_LEAD;
    else place = lines[i - 1].place + (seg.a - segs[i - 1].a) / tempo; // keep the natural gap
    if (i > 0 && place < lines[i - 1].segEnd + 0.05) {
      console.warn(`${s.id} line ${i}: overlaps previous line, pushed later`);
      place = lines[i - 1].segEnd + 0.05;
    }
    const at = (x) => place + (x - seg.a) / tempo;
    lines.push({
      place,
      segEnd: place + (seg.b - seg.a) / tempo,
      seg,
      tempo,
      on: at(l.start),
      off: at(l.end),
      words: l.words.map((w) => [norm(w.t), round(at(w.s)), round(at(w.e))]),
      vi: s.lines[i].vi,
    });
  });
  prevVoEnd = lines[lines.length - 1].segEnd;
  prevOff = lines[lines.length - 1].off;
  scenes.push({ id: s.id, start: sceneAt, lines });
}
scenes.forEach((s, i) => (s.end = i < scenes.length - 1 ? scenes[i + 1].start : DURATION));
if (dry) {
  for (const s of scenes) {
    const b = ((s.start - BEAT0) / BEAT).toFixed(1);
    console.log(`${s.id.padEnd(18)} ${s.start.toFixed(2).padStart(7)} (b${b}) → ${s.end.toFixed(2).padStart(7)}  ` + s.lines.map((l) => `${l.on.toFixed(2)}–${l.off.toFixed(2)}`).join(" | "));
  }
  process.exit(0);
}
for (const s of scenes) {
  for (const l of s.lines) if (l.segEnd > s.end + 0.01) console.warn(`${s.id}: voice runs past its scene end (${l.segEnd.toFixed(2)} > ${s.end.toFixed(2)})`);
}

// ---------- 2. Vietnamese captions ----------
// Each VI word borrows the onset of the proportionally matching EN word; long lines are split at punctuation.
const MAX_CHUNK = 9;
const captions = [];
for (const s of scenes) {
  for (const l of s.lines) {
    const toks = l.vi.split(/\s+/).filter(Boolean);
    const en = l.words;
    const words = toks.map((t, i) => ({ t, s: en[Math.min(en.length - 1, Math.floor((i * en.length) / toks.length))][1] }));
    for (let i = 1; i < words.length; i++) if (words[i].s <= words[i - 1].s) words[i].s = round(words[i - 1].s + 0.07);
    let cur = [];
    const flush = () => cur.length && (captions.push({ scene: s.id, lineOff: l.off, words: cur }), (cur = []));
    words.forEach((w, i) => {
      cur.push(w);
      const left = words.length - i - 1;
      const punct = /[,.:;?!]$/.test(w.t);
      if (left === 0) return;
      if ((punct && cur.length >= 3 && left >= 2 && words.length > MAX_CHUNK) || cur.length >= MAX_CHUNK) flush();
    });
    flush();
  }
}
captions.forEach((c, i) => {
  c.start = round(c.words[0].s - 0.12);
  const next = captions[i + 1];
  const natural = next && next.lineOff === c.lineOff ? next.words[0].s - 0.12 : c.lineOff + 0.5;
  c.end = round(next ? Math.min(natural, next.words[0].s - 0.16) : natural);
});

// ---------- 3. SFX cues ----------
const wordTime = (sceneId, word, nth = 1) => {
  const s = scenes.find((x) => x.id === sceneId);
  if (!s) throw new Error(`cue: unknown scene ${sceneId}`);
  const hits = s.lines.flatMap((l) => l.words).filter((w) => w[0] === word);
  if (hits.length < nth) throw new Error(`cue: "${word}" #${nth} not found in ${sceneId}`);
  return hits[nth - 1][1];
};
const sfxEvents = cues.map((c) => {
  let t;
  if (c.word) t = wordTime(c.scene, c.word, c.nth);
  else if (c.beat != null) t = beat(c.beat);
  else if (c.abs != null) t = c.abs;
  else t = scenes.find((x) => x.id === c.scene).start + c.at;
  return { sfx: c.sfx, vol: c.vol ?? 0.5, t: Math.max(0, round(t + (c.offset || 0))) };
});

// ---------- 4. audio mix ----------
const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-nostats", "-y", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26 });
// ffmpeg writes its analysis reports (ebur128, loudnorm) to stderr.
const stderrOf = (args) => spawnSync("ffmpeg", ["-hide_banner", "-nostats", ...args], { encoding: "utf8" }).stderr;
const loudness = (file) => {
  const log = stderrOf(["-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"]);
  const I = Number(/I:\s+(-?[\d.]+) LUFS/.exec(log.slice(log.lastIndexOf("Summary")))[1]);
  const peak = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(log.slice(log.lastIndexOf("Summary")))[1]);
  return { I, peak };
};
const gainFor = (file, target) => {
  const { I, peak } = loudness(file);
  return Math.min(target - I, -1 - peak); // dB, never push a peak above -1 dBFS
};

let env = [];
if (!noAudio) {
  const inputs = [join(root, arrangement.output)];
  const graph = [];
  const FMT = "aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo";
  // main track, then the calm outro bed faded in under its tail
  inputs.push(join(root, "assets/audio/music/outro-raw.mp3"));
  graph.push(`[0:a]${FMT},atrim=0:${DURATION},volume=-5dB[main]`);
  graph.push(`[1:a]${FMT},volume=-5dB,afade=t=in:d=2.5,adelay=delays=${Math.round(OUTRO_BED * 1000)}:all=1[bed]`);
  graph.push(`[main][bed]amix=inputs=2:normalize=0:dropout_transition=0[mus]`);

  // voice: one input per scene file, split into its line segments
  const voLabels = [];
  for (const s of scenes) {
    const file = join(root, `assets/audio/vo/${s.id}.wav`);
    const idx = inputs.push(file) - 1;
    const g = gainFor(file, -16);
    const outs = s.lines.map((_, i) => `[v${idx}_${i}]`);
    graph.push(`[${idx}:a]${FMT},volume=${g.toFixed(2)}dB,asplit=${outs.length}${outs.join("")}`);
    s.lines.forEach((l, i) => {
      const len = (l.seg.b - l.seg.a) / l.tempo;
      const tempo = l.tempo !== 1 ? `,atempo=${l.tempo}` : "";
      const lbl = `[vl${idx}_${i}]`;
      graph.push(
        `[v${idx}_${i}]atrim=start=${l.seg.a.toFixed(4)}:end=${l.seg.b.toFixed(4)},asetpts=PTS-STARTPTS${tempo},` +
          `afade=t=in:d=0.02,afade=t=out:st=${Math.max(0, len - 0.05).toFixed(4)}:d=0.05,adelay=delays=${Math.round(l.place * 1000)}:all=1${lbl}`,
      );
      voLabels.push(lbl);
    });
  }
  const voOuts = stems ? "[vobus][voside][voenv][vostem]" : "[vobus][voside][voenv]";
  graph.push(`${voLabels.join("")}amix=inputs=${voLabels.length}:normalize=0:dropout_transition=0,asplit=${stems ? 4 : 3}${voOuts}`);
  // moderate ducking: the music sits ~5 dB under speech and comes back to voice level in the gaps
  const duck = "sidechaincompress=threshold=0.03:ratio=3:attack=15:release=350:makeup=1";
  graph.push(stems ? `[mus][voside]${duck},asplit=2[musd][musstem]` : `[mus][voside]${duck}[musd]`);

  // sound effects: one input per distinct file
  const sfxLabels = [];
  const byFile = new Map();
  sfxEvents.forEach((e) => byFile.set(e.sfx, [...(byFile.get(e.sfx) || []), e]));
  for (const [id, evs] of byFile) {
    const file = join(root, `assets/audio/sfx/${id}.mp3`);
    const idx = inputs.push(file) - 1;
    const g = gainFor(file, -16);
    const outs = evs.map((_, i) => `[x${idx}_${i}]`);
    graph.push(`[${idx}:a]${FMT},volume=${g.toFixed(2)}dB,asplit=${outs.length}${outs.join("")}`);
    evs.forEach((e, i) => {
      const lbl = `[xl${idx}_${i}]`;
      graph.push(`[x${idx}_${i}]volume=${e.vol},adelay=delays=${Math.round(e.t * 1000)}:all=1${lbl}`);
      sfxLabels.push(lbl);
    });
  }
  graph.push(
    `[musd][vobus]${sfxLabels.join("")}amix=inputs=${2 + sfxLabels.length}:normalize=0:dropout_transition=0,` +
      `afade=t=out:st=${DURATION - 3.5}:d=3.5,atrim=0:${DURATION},apad=whole_dur=${DURATION}[out]`,
  );
  graph.push(`[voenv]pan=mono|c0=0.5*c0+0.5*c1,aresample=24000,apad=whole_dur=${DURATION},atrim=0:${DURATION}[env]`);

  const graphFile = join(work, "mix-graph.txt");
  writeFileSync(graphFile, graph.join(";\n"));
  writeFileSync(join(work, "mix-inputs.json"), JSON.stringify(inputs)); // lets the graph be re-run for stem checks
  const premix = join(work, "premix.wav");
  const envRaw = join(work, "vo-env.f32");
  // --stems writes the ducked music and the voice bus so scripts/measure-mix-balance.py can check the balance
  const stemOut = stems
    ? ["-map", "[musstem]", "-c:a", "pcm_s16le", join(work, "stem-music.wav"), "-map", "[vostem]", "-c:a", "pcm_s16le", join(work, "stem-voice.wav")]
    : [];
  ff([...inputs.flatMap((f) => ["-i", f]), "-/filter_complex", graphFile, "-map", "[out]", "-c:a", "pcm_s16le", premix, "-map", "[env]", "-f", "f32le", envRaw, ...stemOut]);
  if (stems) console.log(`stems -> ${join(work, "stem-music.wav")}, ${join(work, "stem-voice.wav")}`);

  // two-pass loudness normalization to -14 LUFS / -1.5 dBTP
  const LN = "loudnorm=I=-14:TP=-1.5:LRA=11";
  const m = JSON.parse(/\{[\s\S]*?\}/.exec(stderrOf(["-i", premix, "-af", `${LN}:print_format=json`, "-f", "null", "-"]).split("[Parsed_loudnorm")[1])[0]);
  const pass2 = `${LN}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  const mixOut = join(root, "assets/audio/mix.m4a");
  ff(["-i", premix, "-af", pass2, "-ar", "48000", "-c:a", "aac", "-b:a", "192k", mixOut]);
  console.log(`mix -> ${mixOut} (premix ${m.input_i} LUFS -> -14)`);

  // voice envelope at the video frame rate (drives the mascot mouth and the waveform)
  const buf = readFileSync(envRaw);
  const samples = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4));
  const per = 24000 / FPS;
  const rms = [];
  for (let f = 0; f < DURATION * FPS; f++) {
    let sum = 0;
    for (let i = f * per; i < (f + 1) * per && i < samples.length; i++) sum += samples[i] * samples[i];
    rms.push(Math.sqrt(sum / per));
  }
  const sorted = rms.filter((x) => x > 0.005).sort((x, y) => x - y);
  const ref = sorted[Math.floor(sorted.length * 0.9)] || 1;
  env = rms.map((x) => round(Math.min(1, x / ref), 2));
  writeFileSync(join(root, "data/vo-envelope.json"), JSON.stringify(env));
} else {
  env = readJson("data/vo-envelope.json");
}

// ---------- 5. write timing + inject into the composition ----------
const timing = {
  duration: DURATION,
  fps: FPS,
  beat0: BEAT0,
  beatLen: round(BEAT, 6),
  kick: KICK,
  drops: DROPS,
  outroBeat: OUTRO_BEAT,
  scenes: Object.fromEntries(
    scenes.map((s) => [s.id, { start: round(s.start), end: round(s.end), lines: s.lines.map((l) => ({ on: round(l.on), off: round(l.off), words: l.words })) }]),
  ),
  captions: captions.map((c) => ({ start: c.start, end: c.end, words: c.words.map((w) => [w.t, w.s]) })),
  sfx: sfxEvents,
  env,
};
writeFileSync(join(root, "data/timeline.json"), JSON.stringify({ ...timing, env: undefined }, null, 1));

const htmlPath = join(root, "index.html");
let html = readFileSync(htmlPath, "utf8");
const block = `/*TIMING:BEGIN*/window.TIMING=${JSON.stringify(timing)};/*TIMING:END*/`;
if (!html.includes("/*TIMING:BEGIN*/")) throw new Error("index.html is missing the /*TIMING:BEGIN*/ marker");
html = html.replace(/\/\*TIMING:BEGIN\*\/[\s\S]*?\/\*TIMING:END\*\//, () => block);
// the studio may prepend data-hf-id attributes, so match id anywhere in the tag
html = html.replace(/(<div\b[^>]*?\bid="root"[^>]*?data-duration=")[\d.]+"/, `$1${DURATION}"`);
html = html.replace(/(<audio\b[^>]*?\bid="mix"[^>]*?data-duration=")[\d.]+"/, `$1${DURATION}"`);
writeFileSync(htmlPath, html);

for (const s of scenes) {
  console.log(
    `${s.id.padEnd(18)} ${s.start.toFixed(2).padStart(7)} → ${s.end.toFixed(2).padStart(7)}  ` +
      s.lines.map((l) => `${l.on.toFixed(2)}–${l.off.toFixed(2)}`).join(" | "),
  );
}
console.log(`captions ${captions.length}, sfx ${sfxEvents.length}, env frames ${env.length}`);
