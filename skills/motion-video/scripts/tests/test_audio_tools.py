"""Regression tests for the beat-grid and arrangement checkers on synthetic audio.

Run: python -m unittest discover -s scripts/tests   (needs ffmpeg, numpy, scipy)
"""
import json
import re
import subprocess
import sys
import tempfile
import unittest
import wave
from pathlib import Path

import numpy as np

SCRIPTS = Path(__file__).resolve().parents[1]
SR = 44100


def write_wav(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def kick_track(bpm, beat0, seconds, seed=0):
    """Sine-sweep kicks on every beat plus a little noise so the envelope is not trivial."""
    rng = np.random.default_rng(seed)
    x = rng.normal(0, 0.01, int(seconds * SR)).astype(np.float32)
    t = np.arange(int(0.12 * SR)) / SR
    kick = np.sin(2 * np.pi * (120 - 400 * t) * t) * np.exp(-t * 30)
    beat = 60 / bpm
    n = 0
    while beat0 + n * beat + 0.12 < seconds:
        i = int((beat0 + n * beat) * SR)
        x[i: i + len(kick)] += 0.8 * kick
        n += 1
    return x


def run(script, *args):
    return subprocess.run([sys.executable, str(SCRIPTS / script), *map(str, args)], capture_output=True, text=True)


class FitBeatGridTest(unittest.TestCase):
    def test_recovers_tempo_and_phase(self):
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / "click.wav"
            write_wav(f, kick_track(110, 0.25, 30))
            r = run("fit-beat-grid.py", f)
            self.assertEqual(r.returncode, 0, r.stderr)
            m = re.search(r"BPM ([\d.]+) BEAT0 ([\d.]+)", r.stdout)
            self.assertIsNotNone(m, r.stdout)
            self.assertAlmostEqual(float(m.group(1)), 110, delta=0.1)
            self.assertAlmostEqual(float(m.group(2)), 0.25, delta=0.015)
            self.assertIn("KKKK", r.stdout)


class VerifyArrangementTest(unittest.TestCase):
    def _project(self, d, shift_s):
        root = Path(d)
        (root / "data").mkdir()
        rng = np.random.default_rng(1)
        src = rng.normal(0, 0.2, 20 * SR).astype(np.float32)  # noise has a sharp correlation peak
        beat = 0.5  # 120 BPM
        out = np.zeros_like(src)
        # target beats 0-16 <- source 0-16, target 16-32 <- source 8-24
        out[: 8 * SR] = src[: 8 * SR]
        a = 8 * SR + int(shift_s * SR)
        out[a: 16 * SR] = src[4 * SR: 12 * SR - int(shift_s * SR)]
        write_wav(root / "src.wav", src)
        write_wav(root / "out.wav", out)
        plan = {"source": "src.wav", "output": "out.wav", "bpm": 120, "beat0": 0,
                "segments": [{"to": [0, 16], "from": 0}, {"to": [16, 32], "from": 8}]}
        (root / "data/music-arrangement.json").write_text(json.dumps(plan))
        return root

    def test_aligned_splice_passes(self):
        with tempfile.TemporaryDirectory() as d:
            r = run("verify-arrangement.py", self._project(d, 0))
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_drifted_splice_fails(self):
        with tempfile.TemporaryDirectory() as d:
            r = run("verify-arrangement.py", self._project(d, 0.04))
            self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
            self.assertIn("DRIFT", r.stdout)


if __name__ == "__main__":
    unittest.main()
