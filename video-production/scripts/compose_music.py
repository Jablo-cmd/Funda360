"""Original background music for the Funda360 60-second promo.

Everything is synthesised here from sine partials, filtered noise and a
plucked-string model, so there is no third-party recording or sample and no
licence to clear. 96 BPM (one 4/4 bar = 2.5 s), D major, I-V-vi-IV.

  0-7.5 s    piano + pad (the school day)
  7.5-15 s   adds a muted 8th-note pulse (moving parts)
  15-48 s    lift: arpeggio, soft kick, fuller pad (the platform, people)
  48-55 s    build: brighter voicing (better outcomes)
  55-60 s    resolution: sustained tonic with a bell, natural tail

Usage: python compose_music.py OUT.wav
"""

import sys

import numpy as np
import soundfile as sf

SR = 48_000
DUR = 60.0
BAR = 2.5
BEAT = BAR / 4
N = int(SR * DUR)
rng = np.random.default_rng(360)


def midi_hz(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


# D major I-V-vi-IV; voicings as MIDI notes (bass, chord tones).
CHORDS = [
    (38, [62, 66, 69, 74]),  # D
    (45, [61, 64, 69, 73]),  # A
    (47, [62, 66, 71, 74]),  # Bm
    (43, [62, 67, 71, 74]),  # G
]


def env_adsr(n, a, d, s, r, sr=SR):
    a_n, d_n, r_n = int(a * sr), int(d * sr), int(r * sr)
    s_n = max(n - a_n - d_n - r_n, 0)
    e = np.concatenate([
        np.linspace(0, 1, a_n, endpoint=False),
        np.linspace(1, s, d_n, endpoint=False),
        np.full(s_n, s),
        np.linspace(s, 0, r_n),
    ])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))


def piano(freq, dur, vel=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k, amp in enumerate([1.0, 0.45, 0.22, 0.12, 0.06, 0.03], start=1):
        f = freq * k * (1 + 0.0004 * k * k)  # slight inharmonicity
        decay = np.exp(-t * (1.2 + 0.9 * k))
        out += amp * np.sin(2 * np.pi * f * t) * decay
    attack = np.minimum(t / 0.004, 1.0)
    return vel * out * attack


def pad(freqs, dur, vel=0.12):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f in freqs:
        for det in (-0.12, 0.0, 0.12):  # cents-level chorus via Hz detune
            ff = f * 2 ** (det / 12)
            out += np.sin(2 * np.pi * ff * t) + 0.25 * np.sin(2 * np.pi * 2 * ff * t)
    out /= max(len(freqs) * 3, 1)
    return vel * out * env_adsr(n, 0.9, 0.5, 0.8, 1.2)


def pluck(freq, dur, vel=0.18):
    """Karplus-Strong plucked string, damped (muted pulse)."""
    n = int(dur * SR)
    period = max(int(SR / freq), 2)
    buf = rng.uniform(-1, 1, period)
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % period]
        buf[i % period] = 0.5 * (buf[i % period] + buf[(i + 1) % period]) * 0.985
    return vel * out


def kick(vel=0.35):
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 52 + 70 * np.exp(-t * 28)
    phase = 2 * np.pi * np.cumsum(f) / SR
    return vel * np.sin(phase) * np.exp(-t * 9)


def bell(freq, dur, vel=0.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = sum(a * np.sin(2 * np.pi * freq * r * t) * np.exp(-t * d)
              for r, a, d in [(1, 1, 0.9), (2.76, 0.4, 1.6), (5.4, 0.2, 2.8), (8.9, 0.08, 4)])
    return vel * out


def place(track, sig, start, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    left, right = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    track[i:i + len(sig), 0] += sig * gain * left
    track[i:i + len(sig), 1] += sig * gain * right


def reverb(x, seconds=2.2, wet=0.22):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = rng.normal(0, 1, n) * np.exp(-t * 3.2)
        ir[: int(0.012 * SR)] = 0  # pre-delay
        ir /= np.sqrt(np.sum(ir ** 2))
        size = 1 << int(np.ceil(np.log2(len(x) + n)))
        y = np.fft.irfft(np.fft.rfft(x[:, ch], size) * np.fft.rfft(ir, size), size)[: len(x)]
        out[:, ch] = y
    return (1 - wet) * x + wet * out


def main(path: str) -> None:
    mix = np.zeros((N, 2))
    bars = int(DUR / BAR)  # 24
    for b in range(bars):
        t0 = b * BAR
        bass, chord = CHORDS[b % 4]
        final = t0 >= 55.0
        if final:
            break
        # Pad throughout, fuller after the lift.
        pad_gain = 0.8 if t0 < 15 else 1.15
        place(mix, pad([midi_hz(m) for m in chord], BAR + 1.0), t0, pad_gain)
        # Piano: sparse broken chord in the intro, gentle quarter notes later.
        if t0 < 15:
            for i, m in enumerate([chord[0], chord[2], chord[1], chord[3]]):
                place(mix, piano(midi_hz(m), 2.2, 0.32), t0 + i * BEAT, 1.0, pan=-0.2 + 0.13 * i)
        else:
            for i in range(4):
                m = chord[[0, 2, 1, 2][i]] + (12 if t0 >= 48 and i == 3 else 0)
                place(mix, piano(midi_hz(m), 1.6, 0.3), t0 + i * BEAT, 1.0, pan=-0.15 + 0.1 * i)
        # Bass note on each bar from 7.5 s.
        if t0 >= 7.5:
            place(mix, piano(midi_hz(bass), 2.4, 0.42), t0, 0.9)
        # Muted 8th-note pulse from 7.5 s ("moving parts").
        if t0 >= 7.5:
            for i in range(8):
                vel = 0.12 if i % 2 else 0.16
                place(mix, pluck(midi_hz(chord[1] - 12), 0.3, vel), t0 + i * BEAT / 2, 1.0, pan=0.35)
        # Lift from 15 s: arpeggio and soft kick on beats 1 and 3.
        if t0 >= 15:
            arp = [chord[0], chord[1], chord[2], chord[3], chord[2], chord[1], chord[2], chord[3]]
            for i, m in enumerate(arp):
                place(mix, piano(midi_hz(m + 12), 0.9, 0.11), t0 + i * BEAT / 2, 1.0, pan=0.4 - 0.1 * (i % 3))
            for i in (0, 2):
                place(mix, kick(0.3 if t0 < 48 else 0.36), t0 + i * BEAT)
    # Resolution at 55 s: D major, long sustain, bell.
    t_end = 55.0
    place(mix, pad([midi_hz(m) for m in [62, 66, 69, 74, 78]], 5.0, 0.16), t_end, 1.2)
    for i, m in enumerate([50, 62, 66, 69, 74]):
        place(mix, piano(midi_hz(m), 5.0, 0.34), t_end + i * 0.06, 1.0, pan=-0.2 + 0.1 * i)
    place(mix, bell(midi_hz(86), 4.5, 0.14), t_end + 0.3, 1.0, pan=0.2)
    place(mix, kick(0.32), t_end)

    mix = reverb(mix)
    # Fade in over 0.6 s, and fade the tail to silence by 60 s.
    t = np.arange(N) / SR
    mix *= np.clip(t / 0.6, 0, 1)[:, None]
    mix *= np.clip((DUR - t) / 2.5, 0, 1)[:, None] ** 1.5
    mix /= np.max(np.abs(mix)) / 0.89  # peak normalise (loudness is set in the final mix)
    sf.write(path, mix.astype(np.float32), SR, subtype='PCM_24')


if __name__ == '__main__':
    main(sys.argv[1])
