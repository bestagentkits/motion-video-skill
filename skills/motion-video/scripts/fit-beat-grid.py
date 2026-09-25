"""Estimate tempo, beat phase and per-bar kick/energy profile of a music file.

Usage: python scripts/fit-beat-grid.py <music file> [--min-bpm 100] [--max-bpm 130]
Decodes with ffmpeg (full band + <150 Hz band), fits a constant-tempo grid to
the onset envelopes, then prints one row per bar: kick hits per beat ("K" or ".")
and RMS. Use the printed BPM/BEAT0 in data/music-arrangement.json and pick
build/drop bars from the energy column. Needs ffmpeg, numpy and scipy
(librosa is avoided on purpose: its import can hang on Windows).
"""
import argparse
import subprocess

import numpy as np
from scipy.ndimage import maximum_filter1d

SR = 11025
HOP = 128
FPS = SR / HOP


def decode(path, af):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-af", af, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32)


def frames_rms(x):
    n = len(x) // HOP
    return np.sqrt((x[: n * HOP].reshape(n, HOP) ** 2).mean(axis=1) + 1e-12)


def onset(x):
    e = np.log(frames_rms(x) + 1e-5)
    return np.maximum(0, np.diff(e, prepend=e[0]))


def fit_grid(env, dur, min_bpm, max_bpm):
    """Return (bpm, beat0) of the constant grid whose beats hit the most onset energy."""
    n = len(env)
    best = None
    for bpm in np.arange(min_bpm, max_bpm + 0.01, 0.02):
        beat = 60 / bpm
        b0s = np.arange(0, beat, 0.004)
        k = np.arange(int((dur - beat) / beat))
        idx = np.clip(np.round((b0s[:, None] + beat * k[None, :]) * FPS).astype(int), 0, n - 1)
        s = env[idx].mean(axis=1)
        j = int(s.argmax())
        if best is None or s[j] > best[0]:
            best = (float(s[j]), float(bpm), float(b0s[j]))
    return best[1], best[2]


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("file")
    ap.add_argument("--min-bpm", type=float, default=100)
    ap.add_argument("--max-bpm", type=float, default=130)
    a = ap.parse_args()

    full = decode(a.file, "anull")
    low = decode(a.file, "lowpass=f=150,lowpass=f=150")
    dur = len(full) / SR
    low_on, full_on, rms = onset(low), onset(full), frames_rms(full)
    n = min(len(low_on), len(full_on))
    env = maximum_filter1d(low_on[:n] / (low_on.max() + 1e-9) + 0.5 * full_on[:n] / (full_on.max() + 1e-9), 3)

    bpm, b0 = fit_grid(env, dur, a.min_bpm, a.max_bpm)
    beat = 60 / bpm
    print(f"{a.file}\n duration {dur:.2f}s  grid fit: BPM {bpm:.2f} BEAT0 {b0:.3f}")

    nb = int((dur - b0) / beat)
    lo = maximum_filter1d(low_on, 5)
    kick = np.array([lo[min(len(lo) - 1, int(round((b0 + i * beat) * FPS)))] for i in range(nb)])
    thr = np.percentile(kick, 70) * 0.4
    for bar in range(nb // 4):
        ks = kick[bar * 4: bar * 4 + 4]
        t = b0 + bar * 4 * beat
        i0, i1 = int(t * FPS), int((t + 4 * beat) * FPS)
        db = 20 * np.log10(rms[i0:i1].mean() + 1e-9)
        marks = "".join("K" if k > thr else "." for k in ks)
        print(f" beat {bar*4:3d} {t:7.2f}s  {marks}  {db:6.1f} dB  " + "#" * max(0, int(db + 40)))


if __name__ == "__main__":
    main()
