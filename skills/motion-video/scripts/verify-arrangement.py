"""Check that every bar-spliced segment of the arranged music sits on its target beat.

Usage: python scripts/verify-arrangement.py <project dir> [--tolerance-ms 2]
Reads data/music-arrangement.json, decodes the source and the arranged output,
and cross-correlates 2 s of each segment (1 s after its start, away from the
crossfade) against the source bars it was copied from. A lag other than ~0 ms
means the splice drifted, e.g. amix re-based the stream because the first
segment did not start at 0 s. Exits 1 when any lag exceeds the tolerance.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

SR = 22050


def decode(path):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32)


def lag_ms(out, src, t_out, t_src, span=2.0, search=2000):
    L = int(span * SR)
    x = out[int(t_out * SR): int(t_out * SR) + L]
    i = int(t_src * SR)
    best = max(range(-search, search + 1), key=lambda k: float(np.dot(x, src[i + k: i + k + L])) if i + k >= 0 else -1e9)
    return best / SR * 1000


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("root")
    ap.add_argument("--tolerance-ms", type=float, default=2.0)
    a = ap.parse_args()
    root = Path(a.root)
    plan = json.loads((root / "data/music-arrangement.json").read_text(encoding="utf8"))
    src, out = decode(root / plan["source"]), decode(root / plan["output"])
    beat = 60 / plan["bpm"]
    at = lambda n: plan["beat0"] + beat * n
    bad = 0
    for s in plan["segments"]:
        a0, _ = s["to"]
        lag = lag_ms(out, src, at(a0) + 1.0, at(s["from"]) + 1.0)
        ok = abs(lag) <= a.tolerance_ms
        bad += not ok
        print(f"target beat {a0:3d} <- source beat {s['from']:3d}: lag {lag:+.1f} ms {'ok' if ok else 'DRIFT'}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
