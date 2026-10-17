# Funda360 promotional video (60 s)

**"Funda360 — Smarter Schools. Better Outcomes."**

## Deliverables

| File | Contents |
| --- | --- |
| `renders/funda360-promo-60s.mp4` | Final film: 1920×1080, 30 fps, H.264 (yuv420p, CRF 18) with AAC 192 kb/s 48 kHz audio. 60.0 s. English captions burned in. |
| `renders/funda360-promo-60s.srt` | The same captions as a separate SRT file (for YouTube, LinkedIn or a player that adds its own captions). |
| `captions/funda360-promo-60s.srt` | SRT source written by the narration step. |
| `assets/narration/` | Narration per line (`line1.wav` … `line5.wav`), the placed 60 s track (`narration.wav`) and `timing.json` (line and caption timings). |
| `assets/music/funda360-theme.wav` | Original music bed. |
| `assets/screens/` | Real Funda360 screens (fictional demo data) used in the film. |
| `scripts/` | The pipeline (see below). |
| `capture/` | Playwright spec that captures the product screens. |

The MP4 and WAV files are produced by the pipeline; see "Reproducing the export".

## What the film contains

Narration script: `Funda360_voiceover_script.txt` (supplied by the owner on 2026-10-17), used word for word.

- **Timing.** The script's nominal timestamps (0/8/20/40/51 s) don't fit its lines at a natural pace: line 1 alone takes 8.5 s and the last line would run past 60 s. So each line starts just after the previous one ends; the order and wording are unchanged.
- **Production note.** The script's production note asks for genuine Funda360 screenshots; the product screens below already are.

| Time | Picture | Narration |
| --- | --- | --- |
| 00:00–00:09 | Line-art school drawn in at dawn ("07:30"), then six task cards: attendance registers, fee statements, admissions forms, timetables, assessment marks, staff records | "Running a school is about more than teaching. There are learners to manage, attendance to track, results to record, and parents to keep informed." |
| 00:09–00:17 | The cards converge into the Funda360 mark and wordmark; the real dashboard rises into view | "Meet Funda360, a smart school management platform designed to bring everything together in one place." |
| 00:17–00:37 | Real screens (Learner records, Daily attendance, Fees and collections, Attendance reporting, Admissions pipeline, "All in one place"), then "Built for the people who run schools": school leaders, educators, administrators and finance teams, each with the matching real screen | "From learner records and attendance to assessments, academic reports, school finances, and communication, Funda360 helps schools organise their daily work more easily. Teachers can focus on teaching. School leaders can make better-informed decisions. And schools can keep important information connected." |
| 00:37–00:48 | "Individual schools. / School groups. / Education programmes. / Organised. Connected." over an abstract rising line (no figures) | "Whether it's an individual school, a school group, or a larger education programme, Funda360 is designed to support organised, connected school management." |
| 00:48–01:00 | Funda360 mark (from `src/components/ui/Logo.tsx`) and wordmark; "Smarter Schools. / Better Outcomes." appears as it is spoken | "Funda360. Built to help schools work smarter and support better outcomes for learners. Funda360 — Smarter Schools. Better Outcomes." |

### Truthfulness

- **Product screens** are the real Funda360 application (production build), captured with Playwright.
  - Every backend request was answered with **fictional** data: school "Ridgeview Secondary School", invented learners, staff and payments. No real account, learner or production record appears.
  - The film says so on screen: "Funda360 interface shown with fictional demo data".
- **Only shipped features are shown:** learners, attendance, finance, admissions, attendance reporting and the principal dashboard.
  - Funda AI is not shown: it is not enabled or approved for schools.
  - There are no statistics, testimonials, customer logos, impact figures, URLs or contact details.
  - The percentages visible inside the demo dashboard are the fictional school's demo values, not claims about results.

## How each element was made

| Element | Source | Licence / status |
| --- | --- | --- |
| Narration | **Kokoro v1.0** neural text-to-speech, female voice `af_heart` (US English), speed 1.0, synthesised locally (`scripts/build_narration.py`). The script says "Foonda three-sixty" so the voice says FOON-da (as in "food"), the owner's pronunciation; captions show "Funda360". | Kokoro-82M weights: Apache-2.0. `kokoro-onnx` 0.6.1: MIT. ONNX weights from the kokoro-onnx GitHub release `model-files-v1.0`. **AI-generated voice, not a human voice artist.** |
| Music | **Original composition**, synthesised in code (`scripts/compose_music.py`): D major, 96 BPM, piano, pad, plucked pulse, soft kick and a closing bell. The pulse enters at 0:05, the lift at 0:10 ("Meet Funda360"), the build at 0:37.5 and the resolution at 0:55, on the tagline. | No third-party recordings or samples. Owned by whoever owns this repository's code. |
| Motion graphics | Drawn in code (`scripts/render_video.py`): line art, icons, cards, the logo from the app's own SVG, and typography. | Repository code. |
| Typeface | Inter (the app's font). | SIL Open Font License 1.1. |
| Product screens | Funda360 production build, fictional data (`capture/screens.capture.ts`). | Own product. |
| Captions | Timed from the real pauses in the generated narration, not estimated. | — |
| QA speech recognition | PocketSphinx 5.1.1 with its bundled English model; used only to check the output, not part of the film. | BSD-style. |

Brand colours come from the app:

- navy `#0B1F3A`;
- blues `#174574` and `#386C9E`;
- light blue `#8FA7C4`;
- teal accents `#26A69A` and `#6ED6C8`;
- white.

## Not produced here, and why

**Live-action footage of real schools, learners and educators**: scenes 1, 2, 5 and 6 of the brief.

This environment has no video-generation service and no licensed stock-footage library. Hugging Face and other model hosts are blocked by the network policy, and no media API keys are configured.

Photographs of real children taken from the open web would need model releases and consent. So the human-centred scenes are told with motion graphics and role-based product views instead:

- no cartoon characters;
- no invented people;
- no AI-generated faces.

**To add footage:**

1. Obtain licensed clips with model releases for minors, or commission a shoot:
   - school arrival, about 7 s;
   - staff at work, about 8 s;
   - educators and leaders using a laptop or tablet, about 13 s;
   - a positive classroom and leadership moment, about 7 s.
2. Place them in `assets/footage/` and replace the background of the matching scene function in `render_video.py`. Narration, captions, music and timing stay as they are.

## Reproducing the export

```sh
# from the repository root
video-production/scripts/build.sh              # narration, music, picture, mix, mux, QA
CAPTURE=1 video-production/scripts/build.sh    # also re-captures the product screens
```

Requirements:

- `ffmpeg` and `ffprobe` with libx264;
- Python 3.10 or newer;
- network access to PyPI and GitHub releases, first run only;
- for `CAPTURE=1`: Node, the app's dev dependencies and Playwright Chromium. Set `PW_CHROMIUM=/path/to/chromium` if the pinned browser is not installed.

Intermediates, the venv and the model weights (about 350 MB) go in `video-production/.work/`, which is git-ignored.

Pipeline steps:

1. `capture/screens.capture.ts`: real screens at 1920×1080, browser clock pinned to Thursday 2026-10-15 at 09:30, fictional data.
2. `scripts/build_narration.py`: Kokoro narration placed at each scene's start, SRT timed from silence detection.
3. `scripts/compose_music.py`: 60.0 s music, 48 kHz stereo.
4. `scripts/render_video.py`: 1,800 frames composited in Python (Pillow) and piped to FFmpeg/libx264. Captions are burned in, except on the end card, which shows the same words.
5. `scripts/mix_audio.py`: narration over the music. The music is ducked by about 8 dB while the narrator speaks.
6. `build.sh`: two-pass `loudnorm` to −16 LUFS and −1.5 dBTP (web and social standard), then AAC mux with `+faststart`.
7. `scripts/qa.py`: automated checks (below).

## Quality checks (`scripts/qa.py`)

- **Format:** duration 60 s, 1920×1080, 30 fps, 1,800 frames, H.264 yuv420p, one AAC 48 kHz stream.
- **Picture:** no black frames (`blackdetect`).
- **Audio:**
  - no dropouts before the ending (`silencedetect`);
  - integrated loudness −16 ± 1 LUFS;
  - true peak ≤ −1 dBTP (no clipping).
- **Captions:**
  - one SRT block per caption;
  - ordered and not overlapping;
  - each scene's captions start and end with its narration;
  - the tagline is spelled "Smarter Schools. Better Outcomes.".
- **Narration intelligibility:** each line is decoded from the final mix, music included, by an offline recogniser and compared with the script.

  This proves the speech is present, correctly placed and clear enough for a small general-purpose recogniser. It does not judge how natural the voice sounds; that needs a human listen.

Visual QA was done on rendered stills of every scene: layout, legibility, caption placement, no overlapping text, and the brand close.
