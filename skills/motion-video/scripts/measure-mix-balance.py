"""Measure how loud the ducked music sits under the voice-over and in the gaps.

Usage: python scripts/measure-mix-balance.py <project dir> [--stems-dir DIR] [--body START END]
Needs the stems written by `node scripts/build-timeline.mjs --stems`
(stem-music.wav and stem-voice.wav in the mix temp dir, printed by that run)
and data/timeline.json for the spoken line windows. Prints the RMS of the
music while someone speaks, the music in the gaps, and the voice.
Target from the reference projects: music ~5 dB under the voice during speech
and near voice level in the gaps. ~10 dB under reads as "there is no music".
"""
import argparse
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np

SR = 8000


def decode(path):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32)


def db(x):
    return 10 * np.log10(np.mean(x ** 2) + 1e-12)


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("root")
    ap.add_argument("--stems-dir", help="defaults to <temp>/<project name>-mix")
    ap.add_argument("--body", nargs=2, type=float, metavar=("START", "END"),
                    help="seconds to measure (default: 1 s to the outro start or the end)")
    a = ap.parse_args()
    root = Path(a.root).resolve()
    stems = Path(a.stems_dir) if a.stems_dir else Path(tempfile.gettempdir()) / f"{root.name}-mix"
    timeline = json.loads((root / "data/timeline.json").read_text(encoding="utf8"))
    spans = [(l["on"], l["off"]) for s in timeline["scenes"].values() for l in s["lines"]]

    m, v = decode(stems / "stem-music.wav"), decode(stems / "stem-voice.wav")
    n = min(len(m), len(v))
    m, v = m[:n], v[:n]
    speech = np.zeros(n, bool)
    for on, off in spans:
        speech[int(on * SR): int(off * SR)] = True
    start, end = a.body or (1.0, n / SR)
    body = np.zeros(n, bool)
    body[int(start * SR): int(end * SR)] = True

    under, gaps, voice = db(m[speech & body]), db(m[body & ~speech]), db(v[speech & body])
    print(f"music under speech {under:.1f} dB | music in gaps {gaps:.1f} dB | voice {voice:.1f} dB")
    print(f"music sits {voice - under:.1f} dB under the voice; gaps are {100 * np.mean(~speech[body]):.0f}% of the body")


if __name__ == "__main__":
    main()
