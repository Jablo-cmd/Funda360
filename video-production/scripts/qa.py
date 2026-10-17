"""Automated QA of the rendered promo. Exits non-zero on any failure.

Checks: container/stream metadata (ffprobe), duration, resolution, frame
rate, codecs; black frames and silences (ffmpeg detect filters); integrated
loudness and true peak (ebur128); caption timing against the narration; and
narration intelligibility with an offline speech recogniser (PocketSphinx,
bundled English model): each narrated line is decoded from the FINAL mix
(music included) and compared with the script.

Usage: python qa.py VIDEO.mp4 CAPTIONS.srt TIMING.json
"""

import json
import re
import subprocess
import sys

import numpy as np

failures = []


def check(name, ok, detail=''):
    print(f"{'PASS' if ok else 'FAIL'}  {name}{('  -- ' + detail) if detail else ''}")
    if not ok:
        failures.append(name)


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.stderr + r.stdout


def main(video, srt, timing_path):
    probe = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', video],
                                      capture_output=True, text=True).stdout)
    v = next(s for s in probe['streams'] if s['codec_type'] == 'video')
    a = [s for s in probe['streams'] if s['codec_type'] == 'audio']
    dur = float(probe['format']['duration'])
    check('duration is 60 s (+/- 1 frame)', abs(dur - 60.0) <= 1 / 30 + 0.01, f'{dur:.3f} s')
    check('video 1920x1080', (v['width'], v['height']) == (1920, 1080), f"{v['width']}x{v['height']}")
    check('30 fps', v['r_frame_rate'] in ('30/1', '30000/1000'), v['r_frame_rate'])
    check('H.264, yuv420p', v['codec_name'] == 'h264' and v['pix_fmt'] == 'yuv420p', f"{v['codec_name']} {v['pix_fmt']}")
    nb = int(v.get('nb_frames', 0))
    check('1800 video frames', nb == 1800, str(nb))
    check('one AAC audio stream, 48 kHz', len(a) == 1 and a[0]['codec_name'] == 'aac' and a[0]['sample_rate'] == '48000',
          f"{a[0]['codec_name']} {a[0]['sample_rate']}" if a else 'none')

    black = run(['ffmpeg', '-hide_banner', '-i', video, '-vf', 'blackdetect=d=0.1:pic_th=0.98:pix_th=0.08', '-an', '-f', 'null', '-'])
    blacks = re.findall(r'black_start:([\d.]+) black_end:([\d.]+)', black)
    check('no black frames or gaps (>= 0.1 s)', not blacks, str(blacks))

    loud = run(['ffmpeg', '-hide_banner', '-i', video, '-af', 'ebur128=peak=true', '-vn', '-f', 'null', '-'])
    summ = loud[loud.rfind('Summary:'):]
    i_lufs = float(re.search(r'I:\s+(-?[\d.]+) LUFS', summ).group(1))
    tp = float(re.search(r'Peak:\s+(-?[\d.]+) dBFS', summ).group(1))
    check('integrated loudness -16 LUFS +/- 1', abs(i_lufs + 16) <= 1, f'{i_lufs} LUFS')
    check('true peak <= -1.0 dBTP (no clipping)', tp <= -1.0, f'{tp} dBTP')

    sil = run(['ffmpeg', '-hide_banner', '-i', video, '-af', 'silencedetect=n=-50dB:d=0.5', '-vn', '-f', 'null', '-'])
    silences = re.findall(r'silence_start: (-?[\d.]+)', sil)
    starts = [float(x) for x in silences]
    # The music fades to silence only after the final frame of narration.
    check('no audio dropouts before the ending', all(s > 58.5 for s in starts), str(starts))

    timing = json.load(open(timing_path))
    caps = timing['captions']
    srt_blocks = open(srt, encoding='utf-8').read().strip().split('\n\n')
    check('SRT has one block per caption', len(srt_blocks) == len(caps), f'{len(srt_blocks)} vs {len(caps)}')
    ordered = all(c['start'] < c['end'] for c in caps) and all(x['end'] <= y['start'] for x, y in zip(caps, caps[1:]))
    check('captions are ordered and do not overlap', ordered)
    for line in timing['lines']:
        lc = [c for c in caps if c['scene'] == line['scene']]
        ok = abs(lc[0]['start'] - line['speech_start']) < 0.2 and abs(lc[-1]['end'] - line['speech_end']) < 0.5
        check(f"captions follow narration, scene {line['scene']}", ok,
              f"speech {line['speech_start']}-{line['speech_end']}, captions {lc[0]['start']}-{lc[-1]['end']}")
    check('end card spells "Smarter Schools. Better Outcomes."',
          any('Smarter Schools. Better Outcomes.' in c['text'] for c in caps))

    # Narration intelligibility in the final mix.
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', video, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'],
                         capture_output=True).stdout
    audio = np.frombuffer(pcm, dtype=np.int16)
    from pocketsphinx import Decoder
    dec = Decoder()
    total_ref = total_hit = 0
    for line in timing['lines']:
        ref = ' '.join(c['text'] for c in caps if c['scene'] == line['scene'])
        ref_words = re.findall(r"[a-z']+", ref.lower().replace('funda360', 'funda'))
        seg = audio[int(line['speech_start'] * 16000 - 1600):int(line['speech_end'] * 16000 + 3200)]
        dec.start_utt()
        dec.process_raw(seg.tobytes(), full_utt=True)
        dec.end_utt()
        hyp = dec.hyp().hypstr.lower() if dec.hyp() else ''
        hyp_words = set(re.findall(r"[a-z']+", hyp))
        content = [w for w in ref_words if len(w) > 3 and w != 'funda']
        hits = sum(w in hyp_words for w in content)
        total_ref += len(content)
        total_hit += hits
        print(f"      scene {line['scene']}: recognised {hits}/{len(content)} content words  [{hyp}]")
    recall = total_hit / max(total_ref, 1)
    # PocketSphinx is a small general-purpose model: a recall well above chance shows clear,
    # correctly placed speech; it is not a measure of how natural the voice sounds.
    check('narration recognisable in the final mix (content-word recall >= 60%)', recall >= 0.6, f'{recall:.0%}')

    print(f"\n{'ALL CHECKS PASSED' if not failures else str(len(failures)) + ' CHECK(S) FAILED: ' + ', '.join(failures)}")
    sys.exit(1 if failures else 0)


if __name__ == '__main__':
    main(*sys.argv[1:4])
