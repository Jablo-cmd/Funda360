"""Narration: synthesise each line with Kokoro, place it on the 60 s timeline,
and time the caption chunks from the real pauses in the speech.

Usage: python build_narration.py MODEL_DIR OUT_DIR
Writes OUT_DIR/narration.wav (48 kHz mono), OUT_DIR/timing.json and
../captions/funda360-promo-60s.srt.
"""

import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

VOICE = 'af_heart'  # Kokoro v1.0 female voice (Apache-2.0)
SPEED = 1.0
SR_OUT = 48_000
DUR = 60.0
HERE = Path(__file__).resolve().parent

# (scene start in seconds, text sent to TTS, caption chunks as shown on screen)
LINES = [
    (0.6, 'Every school day brings new opportunities to learn, grow, and achieve.',
     ['Every school day brings new opportunities to learn, grow, and achieve.']),
    (7.6, 'Behind every successful school is a team managing many moving parts.',
     ['Behind every successful school is a team managing many moving parts.']),
    (15.4, 'Funda three-sixty brings essential school management activities together, in one connected platform.',
     ['Funda360 brings essential school management activities together,', 'in one connected platform.']),
    (22.8, 'From learner information and attendance, to finances and reporting, teams can manage important information and everyday processes, in one place.',
     ['From learner information and attendance,', 'to finances and reporting,', 'teams can manage important information and everyday processes, in one place.']),
    (35.6, 'With clearer information and more organised workflows, school teams can spend less time managing complexity, and more time supporting learners.',
     ['With clearer information and more organised workflows,', 'school teams can spend less time managing complexity,', 'and more time supporting learners.']),
    (48.5, 'Better visibility. More informed decisions. A stronger foundation for better outcomes.',
     ['Better visibility.', 'More informed decisions.', 'A stronger foundation for better outcomes.']),
    (55.5, 'Funda three-sixty. Smarter schools. Better outcomes.',
     ['Funda360. Smarter Schools. Better Outcomes.']),
]


def resample(x: np.ndarray, sr_in: int, sr_out: int) -> np.ndarray:
    n_out = int(round(len(x) * sr_out / sr_in))
    return np.interp(np.linspace(0, len(x) - 1, n_out), np.arange(len(x)), x)


def pauses(x: np.ndarray, sr: int, min_gap=0.11, thresh_db=-38.0):
    """Midpoints (s) of silent gaps inside the speech."""
    hop = int(0.01 * sr)
    frames = len(x) // hop
    rms = np.array([np.sqrt(np.mean(x[i * hop:(i + 1) * hop] ** 2) + 1e-12) for i in range(frames)])
    db = 20 * np.log10(rms / (rms.max() + 1e-12))
    silent = db < thresh_db
    out, i = [], 0
    while i < frames:
        if silent[i]:
            j = i
            while j < frames and silent[j]:
                j += 1
            if i > 5 and j < frames - 5 and (j - i) * 0.01 >= min_gap:
                out.append(((i + j) / 2) * 0.01)
            i = j
        else:
            i += 1
    return out


def speech_bounds(x: np.ndarray, sr: int, thresh_db=-40.0):
    hop = int(0.01 * sr)
    rms = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2) + 1e-12) for i in range(0, len(x) - hop, hop)])
    db = 20 * np.log10(rms / rms.max())
    idx = np.where(db > thresh_db)[0]
    return idx[0] * 0.01, (idx[-1] + 1) * 0.01


def srt_time(t: float) -> str:
    ms = int(round(t * 1000))
    return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'


def main(model_dir: str, out_dir: str) -> None:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    k = Kokoro(f'{model_dir}/kokoro-v1.0.onnx', f'{model_dir}/voices-v1.0.bin')
    track = np.zeros(int(DUR * SR_OUT))
    captions, timing = [], []
    for scene, (start, text, chunks) in enumerate(LINES, start=1):
        samples, sr = k.create(text, voice=VOICE, speed=SPEED, lang='en-us')
        samples = np.asarray(samples, dtype=np.float64)
        sf.write(out / f'line{scene}.wav', samples, sr)
        s0, s1 = speech_bounds(samples, sr)
        gaps = pauses(samples, sr)
        # Chunk boundaries: the pause nearest each proportional split point.
        total_chars = sum(len(c) for c in chunks)
        bounds = [s0]
        acc = 0
        for c in chunks[:-1]:
            acc += len(c)
            target = s0 + (s1 - s0) * acc / total_chars
            cand = [g for g in gaps if g > bounds[-1] + 0.3]
            bounds.append(min(cand, key=lambda g: abs(g - target)) if cand else target)
        bounds.append(s1)
        for i, c in enumerate(chunks):
            a, b = start + bounds[i], start + bounds[i + 1]
            captions.append({'start': round(a - 0.05, 3), 'end': round(b + 0.25, 3), 'text': c, 'scene': scene})
        y = resample(samples, sr, SR_OUT)
        i0 = int(start * SR_OUT)
        if i0 + len(y) > len(track):
            raise SystemExit(f'line {scene} overruns the timeline')
        track[i0:i0 + len(y)] += y
        timing.append({'scene': scene, 'start': start, 'speech_start': round(start + s0, 3),
                       'speech_end': round(start + s1, 3), 'duration': round(len(samples) / sr, 3)})
    # Captions must not overlap.
    for a, b in zip(captions, captions[1:]):
        if a['end'] > b['start'] - 0.04:
            a['end'] = round(b['start'] - 0.04, 3)
    track /= np.max(np.abs(track)) / 0.9
    sf.write(out / 'narration.wav', track.astype(np.float32), SR_OUT, subtype='PCM_24')
    json.dump({'voice': VOICE, 'speed': SPEED, 'lines': timing, 'captions': captions}, open(out / 'timing.json', 'w'), indent=1)
    cap_dir = HERE.parent / 'captions'
    cap_dir.mkdir(exist_ok=True)
    with open(cap_dir / 'funda360-promo-60s.srt', 'w', encoding='utf-8') as f:
        for n, c in enumerate(captions, start=1):
            f.write(f"{n}\n{srt_time(c['start'])} --> {srt_time(c['end'])}\n{c['text']}\n\n")
    print(json.dumps(timing, indent=1))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
