"""Final audio mix: narration over the original music, with the music ducked
while the narrator speaks. Loudness is normalised afterwards by FFmpeg
(loudnorm, -16 LUFS integrated, -1.5 dBTP) in build.sh.

Usage: python mix_audio.py NARRATION.wav MUSIC.wav OUT.wav
"""

import sys

import numpy as np
import soundfile as sf

SR = 48_000
DUR = 60.0
MUSIC_BED = 0.42      # music level with no speech
MUSIC_DUCKED = 0.17   # music level under speech (about -8 dB)
ATTACK, RELEASE = 0.12, 0.6


def envelope(x, sr):
    """Speech presence 0..1 from a smoothed RMS envelope."""
    hop = int(0.01 * sr)
    n = len(x) // hop
    rms = np.sqrt(np.array([np.mean(x[i * hop:(i + 1) * hop] ** 2) for i in range(n)]) + 1e-12)
    on = (20 * np.log10(rms / rms.max()) > -42).astype(float)
    # Hold short gaps between words so the music does not pump.
    hold = np.convolve(on, np.ones(35), 'same') > 0
    env = np.zeros(n)
    a, r = 0.01 / ATTACK, 0.01 / RELEASE
    for i in range(1, n):
        target = 1.0 if hold[i] else 0.0
        step = a if target > env[i - 1] else r
        env[i] = env[i - 1] + (target - env[i - 1]) * min(1.0, step * 3)
    return np.repeat(env, hop)[: len(x)]


def main(narr_path, music_path, out_path):
    voice, sr1 = sf.read(narr_path)
    music, sr2 = sf.read(music_path)
    assert sr1 == SR and sr2 == SR, 'expected 48 kHz inputs'
    n = int(SR * DUR)
    voice = np.pad(voice, (0, max(0, n - len(voice))))[:n]
    music = np.pad(music, ((0, max(0, n - len(music))), (0, 0)))[:n]
    env = envelope(voice, SR)
    env = np.pad(env, (0, n - len(env)))
    gain = MUSIC_BED + (MUSIC_DUCKED - MUSIC_BED) * env
    mix = music * gain[:, None] + voice[:, None] * 0.95
    peak = np.max(np.abs(mix))
    if peak > 0.97:
        mix *= 0.97 / peak
    sf.write(out_path, mix.astype(np.float32), SR, subtype='PCM_24')
    print(f'peak before normalisation {20 * np.log10(peak):.1f} dBFS')


if __name__ == '__main__':
    main(*sys.argv[1:4])
