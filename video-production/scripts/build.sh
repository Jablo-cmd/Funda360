#!/usr/bin/env bash
# Reproduces the Funda360 60-second promo from source.
#
#   video-production/scripts/build.sh            # full build (uses existing screen captures)
#   CAPTURE=1 video-production/scripts/build.sh  # also re-capture the product screens
#
# Needs: ffmpeg/ffprobe, Python 3 with a venv (created under $WORK), and for
# CAPTURE=1 the app's production build plus Playwright Chromium.
# Downloads (once): Kokoro v1.0 ONNX weights from the kokoro-onnx GitHub release.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VP="$(cd "$HERE/.." && pwd)"
REPO="$(cd "$VP/.." && pwd)"
WORK="${WORK:-$VP/.work}"            # models, venv and intermediates (git-ignored)
OUT="$VP/renders/funda360-promo-60s.mp4"
SRT="$VP/captions/funda360-promo-60s.srt"
mkdir -p "$WORK/models" "$WORK/build" "$VP/renders"

if [ ! -x "$WORK/venv/bin/python" ]; then
  python3 -m venv "$WORK/venv"
  "$WORK/venv/bin/pip" install -q kokoro-onnx==0.6.1 soundfile numpy pillow pocketsphinx==5.1.1
fi
PY="$WORK/venv/bin/python"
for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  [ -s "$WORK/models/$f" ] || curl -sSL -o "$WORK/models/$f" "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/$f"
done

if [ "${CAPTURE:-0}" = 1 ]; then
  (cd "$REPO" && VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=x npm run build)
  (cd "$VP/capture" && PW_CHROMIUM="${PW_CHROMIUM:-}" npx playwright test -c capture.config.ts screens)
fi

echo "==> narration and captions"
"$PY" "$HERE/build_narration.py" "$WORK/models" "$VP/assets/narration"
echo "==> music"
"$PY" "$HERE/compose_music.py" "$VP/assets/music/funda360-theme.wav"
echo "==> picture (1800 frames)"
"$PY" "$HERE/render_video.py" "$WORK/build/video-only.mp4"
echo "==> mix"
"$PY" "$HERE/mix_audio.py" "$VP/assets/narration/narration.wav" "$VP/assets/music/funda360-theme.wav" "$WORK/build/mix.wav"

echo "==> loudness (two-pass loudnorm, -16 LUFS, -1.5 dBTP)"
read -r MI MTP MLRA MTH MOFF < <(ffmpeg -hide_banner -i "$WORK/build/mix.wav" \
  -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 |
  "$PY" -c 'import sys,json,re; d=json.loads(re.search(r"\{[^{}]*\}", sys.stdin.read(), re.S).group(0)); print(d["input_i"], d["input_tp"], d["input_lra"], d["input_thresh"], d["target_offset"])')
ffmpeg -y -hide_banner -loglevel error -i "$WORK/build/mix.wav" \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=$MI:measured_TP=$MTP:measured_LRA=$MLRA:measured_thresh=$MTH:offset=$MOFF:linear=true,aresample=48000" \
  -c:a pcm_s24le "$WORK/build/mix-norm.wav"

echo "==> mux"
ffmpeg -y -hide_banner -loglevel error -i "$WORK/build/video-only.mp4" -i "$WORK/build/mix-norm.wav" \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -ar 48000 -t 60 \
  -metadata title="Funda360 - Smarter Schools. Better Outcomes." -movflags +faststart "$OUT"
cp "$SRT" "$VP/renders/funda360-promo-60s.srt"

echo "==> QA"
"$PY" "$HERE/qa.py" "$OUT" "$VP/renders/funda360-promo-60s.srt" "$VP/assets/narration/timing.json"
echo "Done: $OUT"
