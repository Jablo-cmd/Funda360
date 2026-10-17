"""Renders the Funda360 60-second promo (1920x1080, 30 fps) frame by frame
and pipes it to FFmpeg. Product screens are real Funda360 captures with
fictional demo data (capture/screens.capture.ts); everything else is drawn
here. Captions come from assets/narration/timing.json.

Usage: python render_video.py OUT_VIDEO_ONLY.mp4 [--frames a:b] [--stills DIR]
"""

import argparse
import json
import math
import subprocess
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SCREENS = ROOT / 'assets' / 'screens'
W, H, FPS, DUR = 1920, 1080, 30, 60.0
NFRAMES = int(DUR * FPS)

# Brand: navy and blue from the app's tokens (src/styles), teal and white accents.
NAVY = (11, 31, 58)
NAVY_D = (7, 21, 41)
BLUE = (23, 69, 116)
BLUE_M = (56, 108, 158)
BLUE_L = (143, 167, 196)
TEAL = (38, 166, 154)
TEAL_L = (110, 214, 200)
WHITE = (255, 255, 255)
MIST = (234, 241, 247)
INK = (15, 35, 60)

FONT_DIR = '/usr/share/fonts/opentype/inter/'


@lru_cache(None)
def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    name = {'regular': 'Inter-Regular', 'medium': 'Inter-Medium', 'semibold': 'Inter-SemiBold', 'bold': 'Inter-Bold',
            'display': 'InterDisplay-SemiBold', 'displaybold': 'InterDisplay-Bold'}[weight]
    return ImageFont.truetype(FONT_DIR + name + '.otf', size)


# ---------------------------------------------------------------- easing
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def prog(t, t0, t1):
    return clamp((t - t0) / (t1 - t0)) if t1 > t0 else float(t >= t0)


def ease_out(x):
    return 1 - (1 - x) ** 3


def ease_io(x):
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def fade(t, t_in, t_out, d_in=0.5, d_out=0.5):
    return ease_io(prog(t, t_in, t_in + d_in)) * (1 - ease_io(prog(t, t_out - d_out, t_out)))


# ---------------------------------------------------------------- drawing helpers
@lru_cache(None)
def text_img(text, weight, size, color=WHITE, tracking=0):
    f = font(weight, size)
    if tracking:
        widths = [f.getlength(ch) + tracking for ch in text]
        w = int(sum(widths)) + 4
    else:
        w = int(f.getlength(text)) + 4
    asc, desc = f.getmetrics()
    img = Image.new('RGBA', (w, asc + desc + 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if tracking:
        x = 0
        for ch, cw in zip(text, widths):
            d.text((x, 2), ch, font=f, fill=color + (255,))
            x += cw
    else:
        d.text((0, 2), text, font=f, fill=color + (255,))
    return img


def paste(dst, img, x, y, alpha=1.0):
    if alpha <= 0.003:
        return
    if alpha < 0.997:
        img = img.copy()
        a = img.getchannel('A').point(lambda v: int(v * alpha))
        img.putalpha(a)
    dst.alpha_composite(img, (int(round(x)), int(round(y))))


def paste_scaled(dst, img, cx, cy, scale, alpha=1.0, resample=Image.BICUBIC):
    if alpha <= 0.003 or scale <= 0.01:
        return
    w, h = max(1, int(img.width * scale)), max(1, int(img.height * scale))
    im = img.resize((w, h), resample) if (w, h) != img.size else img
    x, y = int(round(cx - w / 2)), int(round(cy - h / 2))
    # Clip to the canvas (alpha_composite needs a non-negative destination).
    sx, sy = max(0, -x), max(0, -y)
    if sx or sy or x + w > dst.width or y + h > dst.height:
        im = im.crop((sx, sy, min(w, dst.width - x), min(h, dst.height - y)))
        x, y = x + sx, y + sy
        if im.width <= 0 or im.height <= 0:
            return
    paste(dst, im, x, y, alpha)


def rounded_panel(w, h, r, fill, shadow=0, shadow_alpha=90, border=None):
    pad = shadow * 2
    img = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    if shadow:
        sh = Image.new('RGBA', img.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle((pad, pad + shadow // 2, pad + w, pad + h + shadow // 2), r, fill=(0, 10, 25, shadow_alpha))
        img = sh.filter(ImageFilter.GaussianBlur(shadow / 2))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((pad, pad, pad + w, pad + h), r, fill=fill, outline=border, width=2 if border else 0)
    return img, pad


def ss(img, factor=2):
    """Downscale a supersampled layer (anti-aliasing)."""
    return img.resize((img.width // factor, img.height // factor), Image.LANCZOS)


def radial(w, h, strength=1.0):
    """Alpha mask: 1 at the centre falling smoothly to 0 at the ellipse edge (no box edges)."""
    import numpy as np
    y, x = np.mgrid[0:h, 0:w]
    r = np.sqrt(((x - w / 2) / (w / 2)) ** 2 + ((y - h / 2) / (h / 2)) ** 2)
    v = np.clip(1 - r, 0, 1)
    v = v * v * (3 - 2 * v)  # smoothstep
    return Image.fromarray((v * 255 * strength).astype('uint8'), 'L')


def glow_layer(w, h, colour, strength):
    layer = Image.new('RGBA', (w, h), colour + (0,))
    layer.putalpha(radial(w, h, strength))
    return layer


def gradient(w, h, top, bottom, glow=None):
    """Vertical gradient with an optional radial glow (x, y, radius, colour, strength)."""
    base = Image.linear_gradient('L').resize((w, h))
    img = Image.composite(Image.new('RGB', (w, h), bottom), Image.new('RGB', (w, h), top), base).convert('RGBA')
    if glow:
        gx, gy, gr, gc, gs = glow
        big = Image.new('RGBA', (w + 4 * gr, h + 4 * gr), (0, 0, 0, 0))
        big.alpha_composite(glow_layer(gr * 2, gr * 2, gc, gs), (gx - gr + 2 * gr, gy - gr + 2 * gr))
        img.alpha_composite(big.crop((2 * gr, 2 * gr, 2 * gr + w, 2 * gr + h)))
    return img


# ---------------------------------------------------------------- icons (line glyphs, drawn at 4x)
def icon(kind, size=64, color=WHITE, stroke=3.2):
    S = 4
    s = size * S
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    w = int(stroke * S)
    c = color + (255,)

    def L(*pts):
        d.line([(x * s, y * s) for x, y in pts], fill=c, width=w, joint='curve')
        for x, y in (pts[0], pts[-1]):
            d.ellipse((x * s - w / 2, y * s - w / 2, x * s + w / 2, y * s + w / 2), fill=c)

    def R(x0, y0, x1, y1, r=0.08):
        d.rounded_rectangle((x0 * s, y0 * s, x1 * s, y1 * s), r * s, outline=c, width=w)

    def C(x, y, r):
        d.ellipse(((x - r) * s, (y - r) * s, (x + r) * s, (y + r) * s), outline=c, width=w)

    if kind == 'calendar':
        R(.16, .22, .84, .84)
        L((.16, .40), (.84, .40))
        L((.34, .14), (.34, .28)); L((.66, .14), (.66, .28))
        L((.32, .58), (.42, .68), (.62, .50))
    elif kind == 'coins':
        C(.40, .40, .22); C(.60, .62, .22)
        L((.40, .30), (.40, .50))
    elif kind == 'form':
        R(.22, .12, .78, .88)
        L((.34, .32), (.66, .32)); L((.34, .48), (.66, .48)); L((.34, .64), (.54, .64))
    elif kind == 'clock':
        C(.5, .5, .34); L((.5, .30), (.5, .5), (.64, .60))
    elif kind == 'chart':
        L((.16, .16), (.16, .84), (.84, .84))
        L((.28, .66), (.46, .48), (.60, .58), (.82, .30))
    elif kind == 'people':
        C(.38, .34, .12); C(.66, .38, .10)
        d.arc((.18 * s, .52 * s, .58 * s, 1.0 * s), 180, 360, fill=c, width=w)
        d.arc((.50 * s, .56 * s, .84 * s, .96 * s), 180, 360, fill=c, width=w)
    elif kind == 'leader':
        C(.5, .30, .14)
        d.arc((.24 * s, .50 * s, .76 * s, 1.02 * s), 180, 360, fill=c, width=w)
        L((.5, .62), (.5, .74))
    elif kind == 'book':
        L((.5, .26), (.5, .82))
        d.line([(.5 * s, .26 * s), (.18 * s, .20 * s), (.18 * s, .76 * s), (.5 * s, .82 * s), (.82 * s, .76 * s), (.82 * s, .20 * s), (.5 * s, .26 * s)], fill=c, width=w, joint='curve')
    elif kind == 'folder':
        d.line([(.14 * s, .30 * s), (.40 * s, .30 * s), (.48 * s, .38 * s), (.86 * s, .38 * s), (.86 * s, .80 * s), (.14 * s, .80 * s), (.14 * s, .30 * s)], fill=c, width=w, joint='curve')
    elif kind == 'id':
        R(.14, .24, .86, .78)
        C(.34, .46, .08); L((.52, .44), (.74, .44)); L((.52, .58), (.68, .58))
    return img.resize((size, size), Image.LANCZOS)


# ---------------------------------------------------------------- logo (from src/components/ui/Logo.tsx)
@lru_cache(None)
def logo_mark(size, fill=(18, 52, 91)):
    S = 8
    s = size * S
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    k = s / 32
    d.rounded_rectangle((0, 0, s, s), 6 * k, fill=fill + (255,))
    w = int(2 * k)
    # Path "M9 21.5V11.8c0-.66.54-1.2 1.2-1.2h8.6" and "M9.6 16.2h7" (round caps).
    pts = [(9, 21.5), (9, 11.8)]
    arc = [(9 + 1.2 - 1.2 * math.cos(a), 11.8 - 1.2 * math.sin(a)) for a in [i * math.pi / 2 / 8 for i in range(9)]]
    pts += arc + [(18.8, 10.6)]
    d.line([(x * k, y * k) for x, y in pts], fill=WHITE + (255,), width=w, joint='curve')
    d.line([(9.6 * k, 16.2 * k), (16.6 * k, 16.2 * k)], fill=WHITE + (255,), width=w)
    for x, y in [(9, 21.5), (18.8, 10.6), (9.6, 16.2), (16.6, 16.2)]:
        d.ellipse((x * k - w / 2, y * k - w / 2, x * k + w / 2, y * k + w / 2), fill=WHITE + (255,))
    return img.resize((size, size), Image.LANCZOS)


@lru_cache(None)
def wordmark(size, second=TEAL_L):
    a = text_img('Funda', 'bold', size, WHITE)
    b = text_img('360', 'bold', size, second)
    img = Image.new('RGBA', (a.width + b.width - 4, a.height), (0, 0, 0, 0))
    img.alpha_composite(a, (0, 0))
    img.alpha_composite(b, (a.width - 4, 0))
    return img


# ---------------------------------------------------------------- static layers
class Assets:
    def __init__(self):
        self.bg_navy = gradient(W, H, NAVY_D, BLUE, glow=(1500, 260, 900, TEAL, 0.22))
        self.bg_dawn = self.make_dawn()
        self.sun = glow_layer(1200, 1200, (255, 236, 200), 0.6)
        self.end_glow = glow_layer(900, 900, TEAL, 0.45)
        self.school = self.make_school()
        self.bg_soft = gradient(W, H, (16, 44, 80), NAVY_D, glow=(420, 900, 1000, TEAL, 0.18))
        self.screens = {p.stem: Image.open(p).convert('RGBA') for p in sorted(SCREENS.glob('*.png'))}
        self.windows = {k: self.browser(v) for k, v in self.screens.items()}
        self.cards = [self.task_card(*c) for c in CARDS]
        self.role_icons = {k: icon(k, 46, WHITE, 3.0) for k in ('leader', 'book', 'folder', 'coins')}

    @staticmethod
    def make_dawn():
        img = gradient(W, H, (8, 24, 47), (24, 78, 118))
        big = Image.new('RGBA', (W + 2400, H + 1400), (0, 0, 0, 0))
        big.alpha_composite(glow_layer(2400, 1300, TEAL_L, 0.55), (1200 + W // 2 - 1200, 700 + 760 - 650))
        img.alpha_composite(big.crop((1200, 700, 1200 + W, 700 + H)))
        return img

    @staticmethod
    def make_school():
        """Line-art school building, drawn at 2x for anti-aliasing."""
        S = 2
        img = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        c = WHITE + (235,)
        cs = WHITE + (120,)
        w = 3 * S

        def P(*pts, col=c, width=w):
            d.line([(x * S, y * S) for x, y in pts], fill=col, width=width, joint='curve')

        def Rr(x0, y0, x1, y1, col=c, width=w, r=0):
            d.rounded_rectangle((x0 * S, y0 * S, x1 * S, y1 * S), r * S, outline=col, width=width)

        base = 760
        # Ground line
        P((180, base), (1740, base), col=cs, width=2 * S)
        # Central block with pediment
        Rr(760, 470, 1160, base)
        P((730, 470), (960, 360), (1190, 470), (730, 470))
        d.ellipse(((960 - 34) * S, (415 - 34) * S, (960 + 34) * S, (415 + 34) * S), outline=c, width=w)
        P((960, 415), (960, 395)); P((960, 415), (975, 422))
        # Columns and door
        for x in (800, 860, 1060, 1120):
            P((x, 500), (x, base - 30))
        Rr(915, 600, 1005, base - 30, r=6)
        P((960, 600), (960, base - 30), col=cs, width=2 * S)
        for i, y in enumerate((base - 30, base - 15)):
            P((880 - i * 12, y), (1040 + i * 12, y))
        # Wings
        for x0, x1 in ((420, 760), (1160, 1500)):
            Rr(x0, 540, x1, base)
            P((x0 - 12, 540), (x1 + 12, 540))
            for row, y in enumerate((575, 660)):
                for i in range(4):
                    wx = x0 + 34 + i * ((x1 - x0 - 68) // 4)
                    Rr(wx, y, wx + 50, y + 52, r=3)
                    P((wx + 25, y), (wx + 25, y + 52), col=cs, width=2 * S)
        # Flag
        P((1290, 540), (1290, 330))
        d.polygon([(1290 * S, 334 * S), (1372 * S, 352 * S), (1290 * S, 372 * S)], outline=c, width=w)
        # Trees
        for tx in (300, 1640):
            P((tx, base), (tx, 680))
            d.ellipse(((tx - 58) * S, 560 * S, (tx + 58) * S, 690 * S), outline=c, width=w)
        # Path
        P((960, base), (900, 900), (820, 1080), col=cs, width=2 * S)
        P((960, base), (1020, 900), (1100, 1080), col=cs, width=2 * S)
        return ss(img, S)

    @staticmethod
    def browser(screen):
        """A clean browser window around a 1920x1080 capture, scaled to 1440 wide."""
        sw = 1440
        sh = int(screen.height * sw / screen.width)
        bar = 44
        panel, pad = rounded_panel(sw, sh + bar, 18, (248, 250, 252, 255), shadow=36, shadow_alpha=130)
        d = ImageDraw.Draw(panel)
        for i, col in enumerate([(237, 106, 94), (245, 190, 79), (98, 197, 84)]):
            cx, cy = pad + 26 + i * 22, pad + bar // 2
            d.ellipse((cx - 6, cy - 6, cx + 6, cy + 6), fill=col + (255,))
        d.rounded_rectangle((pad + sw // 2 - 200, pad + 10, pad + sw // 2 + 200, pad + bar - 10), 12, fill=(229, 234, 240, 255))
        t = text_img('Funda360', 'medium', 17, (90, 104, 122))
        panel.alpha_composite(t, (pad + sw // 2 - t.width // 2, pad + 11))
        shot = screen.resize((sw, sh), Image.LANCZOS)
        mask = Image.new('L', (sw, sh), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, -20, sw, sh), 18, fill=255)
        panel.paste(shot, (pad, pad + bar), mask)
        return panel

    @staticmethod
    def task_card(title, kind):
        w, h = 330, 150
        panel, pad = rounded_panel(w, h, 18, (255, 255, 255, 250), shadow=26, shadow_alpha=110)
        d = ImageDraw.Draw(panel)
        d.rounded_rectangle((pad + 22, pad + 24, pad + 82, pad + 84), 14, fill=MIST + (255,))
        panel.alpha_composite(icon(kind, 40, BLUE, 3.4), (pad + 32, pad + 34))
        panel.alpha_composite(text_img(title, 'semibold', 24, INK), (pad + 100, pad + 30))
        for i, frac in enumerate((0.78, 0.55)):
            y = pad + 92 + i * 22
            d.rounded_rectangle((pad + 100, y, pad + 100 + int((w - 130) * frac), y + 10), 5, fill=(222, 229, 238, 255))
        return panel


CARDS = [
    ('Attendance registers', 'calendar'),
    ('Fee statements', 'coins'),
    ('Admissions forms', 'form'),
    ('Timetables', 'clock'),
    ('Assessment marks', 'chart'),
    ('Staff records', 'people'),
]
# Scattered positions (centre x, y, angle) for scene 2.
CARD_POS = [(470, 300, -6), (1450, 290, 5), (960, 470, -2), (440, 660, 4), (1480, 650, -5), (1000, 760, 3)]


# ---------------------------------------------------------------- captions
class Captions:
    def __init__(self, timing_path):
        self.items = json.load(open(timing_path))['captions']
        self.cache = {}

    def render(self, text):
        if text in self.cache:
            return self.cache[text]
        f = font('medium', 40)
        words = text.split()
        if f.getlength(text) <= 1280:
            lines = [text]
        else:
            # Two balanced lines: the split that minimises the longer line.
            best = min(range(1, len(words)), key=lambda i: max(f.getlength(' '.join(words[:i])), f.getlength(' '.join(words[i:]))))
            lines = [' '.join(words[:best]), ' '.join(words[best:])]
        lh = 54
        tw = max(int(f.getlength(l)) for l in lines)
        bw, bh = tw + 64, lh * len(lines) + 30
        img = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle((0, 0, bw, bh), 14, fill=(6, 18, 36, 190))
        for i, l in enumerate(lines):
            lw = f.getlength(l)
            d.text(((bw - lw) / 2, 13 + i * lh), l, font=f, fill=(255, 255, 255, 255))
        self.cache[text] = img
        return img

    def draw(self, frame, t):
        for c in self.items:
            if 'Smarter Schools. Better Outcomes.' in c['text']:  # the end card shows the same words
                continue
            if c['start'] <= t <= c['end']:
                a = min(prog(t, c['start'], c['start'] + 0.12), 1 - prog(t, c['end'] - 0.12, c['end']))
                img = self.render(c['text'])
                paste(frame, img, (W - img.width) / 2, H - 70 - img.height, a)


# ---------------------------------------------------------------- scenes
def scene1(f, A, t):
    """00:00-00:07 The school day."""
    f.alpha_composite(A.bg_dawn)
    # The sun-glow rises and brightens.
    rise = ease_out(prog(t, 0, 6.5))
    paste(f, A.sun, W // 2 - 600, int(560 - 140 * rise) - 600, 0.45 + 0.55 * rise)
    # The building draws in from the centre outwards, with a slow push-in.
    reveal = ease_io(prog(t, 0.2, 2.6))
    if reveal > 0:
        half = int(W / 2 * reveal) + 2
        mask = Image.new('L', (W, H), 0)
        ImageDraw.Draw(mask).rectangle((W // 2 - half, 0, W // 2 + half, H), fill=255)
        school = A.school.copy()
        school.putalpha(Image.composite(school.getchannel('A'), Image.new('L', (W, H), 0), mask))
        paste_scaled(f, school, W / 2, H / 2 + 20, 1.0 + 0.04 * prog(t, 0, 7))
    # Learners arriving: soft points travelling up the path to the door.
    d = ImageDraw.Draw(f)
    for i in range(14):
        p = ((t - 1.0) * 0.16 + i * 0.071) % 1.0
        if t < 1.0 + i * 0.12:
            continue
        side = -1 if i % 2 else 1
        x = 960 + side * (140 * (1 - p) + 18) * (0.5 + 0.5 * (1 - p))
        y = 1080 - 300 * p
        r = 7 - 3 * p
        a = int(220 * min(1, p * 4) * min(1, (1 - p) * 5))
        col = (TEAL_L if i % 3 else (255, 225, 170)) + (a,)
        d.ellipse((x - r, y - r, x + r, y + r), fill=col)
    # Time label.
    a = fade(t, 1.6, 7.2, 0.8, 0.6)
    paste(f, text_img('07:30', 'display', 64, WHITE), 140, 120, a)
    paste(f, text_img('A NEW SCHOOL DAY BEGINS', 'semibold', 22, TEAL_L, tracking=3), 144, 200, a)


def scene2(f, A, t):
    """00:07-00:15 Many moving parts."""
    f.alpha_composite(A.bg_navy)
    lt = t - 7.0
    a_head = fade(t, 7.8, 13.8, 0.7, 0.6)
    paste(f, text_img('MANY MOVING PARTS', 'semibold', 22, TEAL_L, tracking=3), 140, 120, a_head)
    converge = ease_io(prog(t, 13.4, 15.6))
    for i, (card, (cx, cy, ang)) in enumerate(zip(A.cards, CARD_POS)):
        appear = ease_out(prog(lt, 0.2 + i * 0.32, 0.9 + i * 0.32))
        if appear <= 0:
            continue
        bob = math.sin(lt * 0.9 + i * 1.7) * 9
        x = cx + math.cos(lt * 0.5 + i) * 6
        y = cy + bob + (1 - appear) * 40
        x = x + (W / 2 - x) * converge
        y = y + (H / 2 - y) * converge
        angle = ang * (1 - converge) + math.sin(lt * 0.6 + i) * 1.2 * (1 - converge)
        scale = 1.0 - 0.75 * converge
        img = card.rotate(angle, resample=Image.BICUBIC, expand=True)
        paste_scaled(f, img, x, y, scale, appear * (1 - prog(t, 15.2, 15.7)))


def scene3(f, A, t):
    """00:15-00:22 Introducing Funda360."""
    f.alpha_composite(A.bg_navy)
    # Logo mark grows out of the converged cards, then the wordmark.
    m = ease_out(prog(t, 15.4, 16.2))
    lift = ease_io(prog(t, 18.4, 19.4))
    mark = logo_mark(140)
    wm = wordmark(104)
    group_w = mark.width + 34 + wm.width
    gx = W / 2 - group_w / 2 * ease_out(prog(t, 16.2, 16.9))
    cy = H / 2 - 30 - 330 * lift
    s = (0.6 + 0.4 * m) * (1 - 0.45 * lift)
    paste_scaled(f, mark, gx + mark.width / 2 * s if lift else gx + mark.width / 2, cy, s, m)
    wa = ease_out(prog(t, 16.4, 17.0))
    if wa:
        wx = gx + (mark.width + 34) * s
        paste_scaled(f, wm, wx + wm.width * s / 2, cy + 4 * s, s, wa)
    tag = text_img('One connected platform', 'medium', 40, BLUE_L)
    paste_scaled(f, tag, W / 2, cy + 120 * (1 - 0.45 * lift), 1 - 0.45 * lift, ease_out(prog(t, 17.2, 17.8)) * (1 - prog(t, 18.4, 18.8)))
    # The live dashboard rises into view.
    r = ease_io(prog(t, 18.6, 20.0))
    if r > 0:
        win = A.windows['01-dashboard']
        zoom = 0.80 + 0.06 * r + 0.04 * prog(t, 20.0, 22.0)
        paste_scaled(f, win, W / 2, H / 2 + 110 + (1 - r) * 500, zoom, r)


# Product montage: (start, end, screen, label, focus (fx, fy) in screen coords 0..1)
MONTAGE = [
    (22.0, 24.6, '02-learners', 'Learner records', (0.42, 0.40)),
    (24.6, 26.6, '03-attendance', 'Daily attendance', (0.45, 0.45)),
    (26.6, 28.6, '04-finance', 'Fees and collections', (0.62, 0.30)),
    (28.6, 30.6, '06-reports', 'Attendance reporting', (0.62, 0.40)),
    (30.6, 32.4, '05-admissions', 'Admissions pipeline', (0.55, 0.38)),
]


def scene4(f, A, t):
    """00:22-00:35 One connected platform."""
    f.alpha_composite(A.bg_soft)
    for i, (t0, t1, key, label, (fx, fy)) in enumerate(MONTAGE):
        if not (t0 - 0.3 <= t <= t1 + 0.3):
            continue
        # Short crossfade: the outgoing view fades out while the next one fades in.
        a = min(ease_io(prog(t, t0 - 0.15, t0 + 0.15)), 1 - ease_io(prog(t, t1 - 0.15, t1 + 0.15))) if i else (
            1 - ease_io(prog(t, t1 - 0.15, t1 + 0.15)))
        win = A.windows[key]
        p = prog(t, t0 - 0.3, t1 + 0.3)
        zoom = 1.02 + 0.12 * ease_io(p)
        # Drift towards the focus area while zooming.
        ox = (0.5 - fx) * 700 * ease_io(p)
        oy = (0.5 - fy) * 380 * ease_io(p)
        slide = (1 - ease_out(prog(t, t0 - 0.15, t0 + 0.35))) * 30 if i else 0
        paste_scaled(f, win, W / 2 + ox + slide, H / 2 + 40 + oy, zoom, a)
        chip = label_chip(label)
        ca = ease_out(prog(t, t0, t0 + 0.4)) * (1 - prog(t, t1 - 0.25, t1))
        paste(f, chip, 120, 60 + (1 - ease_out(prog(t, t0, t0 + 0.4))) * 16, ca)
    # "In one place": the views come together around the dashboard.
    g = ease_io(prog(t, 32.2, 33.4))
    if g > 0:
        keys = ['02-learners', '03-attendance', '04-finance', '06-reports']
        pos = [(-1, -1), (1, -1), (-1, 1), (1, 1)]
        for k, (sx, sy) in zip(keys, pos):
            cx = W / 2 + sx * 430 * g
            cy = H / 2 - 30 + sy * 230 * g
            paste_scaled(f, A.windows[k], cx, cy + 30, 0.40, g * (1 - prog(t, 34.6, 35.2)))
        paste_scaled(f, A.windows['01-dashboard'], W / 2, H / 2, 0.46 + 0.06 * prog(t, 33.4, 35.0), ease_out(prog(t, 32.8, 33.6)) * (1 - prog(t, 34.6, 35.2)))
        chip = label_chip('All in one place')
        paste(f, chip, 120, 60, ease_out(prog(t, 32.6, 33.2)) * (1 - prog(t, 34.6, 35.0)))
    # Honest labelling of the product footage.
    note = text_img('Funda360 interface shown with fictional demo data', 'regular', 20, BLUE_L)
    paste(f, note, W - note.width - 120, 76, fade(t, 22.2, 35.0, 0.6, 0.4) * 0.9)


@lru_cache(None)
def label_chip(text):
    t = text_img(text, 'semibold', 30, WHITE)
    w, h = t.width + 62, 62
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, w, h), 31, fill=TEAL + (235,))
    img.alpha_composite(t, (31, (h - t.height) // 2 - 1))
    return img


ROLES = [
    (35.8, 'leader', 'School leaders', 'Learners, staff, attendance and fees at a glance', '01-dashboard', (0.17, 0.10, 0.99, 0.62)),
    (38.4, 'book', 'Educators', 'Class registers and assessments', '03-attendance', (0.27, 0.05, 0.89, 0.80)),
    (41.0, 'folder', 'Administrators', 'Learner records and admissions', '05-admissions', (0.27, 0.04, 0.89, 0.62)),
    (43.6, 'coins', 'Finance teams', 'Billing, payments and outstanding balances', '04-finance', (0.27, 0.05, 0.89, 0.60)),
]


@lru_cache(None)
def role_row(i):
    _, kind, title, line, _, _ = ROLES[i]
    w, h = 820, 112
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((0, 14, 84, 98), fill=TEAL + (255,))
    ic = icon(kind, 46, WHITE, 3.0)
    img.alpha_composite(ic, (19, 33))
    img.alpha_composite(text_img(title, 'semibold', 36, WHITE), (110, 12))
    img.alpha_composite(text_img(line, 'regular', 25, BLUE_L), (112, 62))
    return img


@lru_cache(None)
def role_crop(i):
    key, box = ROLES[i][4], ROLES[i][5]
    scr = ASSETS.screens[key]
    x0, y0, x1, y1 = [int(v * s) for v, s in zip(box, (scr.width, scr.height, scr.width, scr.height))]
    crop = scr.crop((x0, y0, x1, y1))
    # Fit inside 860 x 640.
    k = min(860 / crop.width, 640 / crop.height)
    crop = crop.resize((int(crop.width * k), int(crop.height * k)), Image.LANCZOS)
    panel, pad = rounded_panel(crop.width, crop.height, 20, (255, 255, 255, 255), shadow=34, shadow_alpha=140)
    mask = Image.new('L', crop.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, crop.width, crop.height), 20, fill=255)
    panel.paste(crop, (pad, pad), mask)
    return panel


def scene5(f, A, t):
    """00:35-00:48 Technology that empowers people."""
    f.alpha_composite(A.bg_soft)
    a_all = 1 - prog(t, 47.6, 48.2)
    paste(f, text_img('BUILT FOR THE PEOPLE WHO RUN SCHOOLS', 'semibold', 22, TEAL_L, tracking=3), 140, 140, ease_out(prog(t, 35.2, 35.9)) * a_all)
    active = 0
    for i, (t0, *_rest) in enumerate(ROLES):
        if t >= t0:
            active = i
        a = ease_out(prog(t, t0, t0 + 0.6)) * a_all
        row = role_row(i)
        dim = 1.0 if i == active else 0.45
        paste(f, row, 140 + (1 - ease_out(prog(t, t0, t0 + 0.6))) * -40, 250 + i * 150, a * dim)
        if i == active:
            # Accent bar beside the active role.
            ImageDraw.Draw(f).rounded_rectangle((112, 262 + i * 150, 118, 350 + i * 150), 3, fill=TEAL_L + (int(255 * a),))
    # Product detail for the active role (crossfade between crops).
    for i, (t0, *_rest) in enumerate(ROLES):
        t1 = ROLES[i + 1][0] if i + 1 < len(ROLES) else 48.2
        a = min(ease_io(prog(t, t0 - 0.2, t0 + 0.5)), 1 - ease_io(prog(t, t1 - 0.2, t1 + 0.3)))
        if a <= 0:
            continue
        crop = role_crop(i)
        drift = 8 * math.sin((t - t0) * 0.8)
        paste_scaled(f, crop, 1420, 520 + drift, 0.96 + 0.03 * prog(t, t0, t1), a * a_all)


# Shown as the narrator names each kind of school (times from the narration's pauses).
OUTCOMES = [(37.7, 'Individual schools.'), (39.1, 'School groups.'), (40.2, 'Education programmes.'), (44.0, 'Organised. Connected.')]


def scene6(f, A, t):
    """00:37-00:48 Every kind of school."""
    f.alpha_composite(A.bg_navy)
    # Abstract rising line (no figures, no axes).
    d = ImageDraw.Draw(f)
    p = ease_io(prog(t, 37.3, 46.5))
    pts = [(x, 880 - 0.36 * (x - 900) - 30 * math.sin(x / 120.0)) for x in range(900, 1780, 10)]
    n = max(2, int(len(pts) * p))
    d.line(pts[:n], fill=TEAL + (150,), width=5, joint='curve')
    if n > 2:
        x, y = pts[n - 1]
        d.ellipse((x - 9, y - 9, x + 9, y + 9), fill=TEAL_L + (230,))
    out = 1 - prog(t, 47.9, 48.6)
    for i, (t0, txt) in enumerate(OUTCOMES):
        a = ease_out(prog(t, t0, t0 + 0.5)) * out
        big = i < 3
        img = text_img(txt, 'displaybold' if big else 'display', 84 if big else 64, WHITE if big else TEAL_L)
        y = [230, 350, 470, 630][i]
        paste(f, img, 160 + (1 - ease_out(prog(t, t0, t0 + 0.5))) * 30, y, a)


def scene7(f, A, t):
    """00:48-01:00 Brand close; the tagline appears as it is spoken."""
    f.alpha_composite(A.bg_navy)
    a = ease_out(prog(t, 48.4, 49.2))
    s = 0.82 + 0.18 * ease_out(prog(t, 48.4, 49.3))
    paste(f, A.end_glow, W // 2 - 450, 420 - 450, a)
    mark = logo_mark(150)
    paste_scaled(f, mark, W / 2, 400, s, a)
    wm = wordmark(110)
    paste_scaled(f, wm, W / 2, 560, 1.0, ease_out(prog(t, 48.9, 49.6)))
    l1 = text_img('Smarter Schools.', 'display', 56, WHITE)
    l2 = text_img('Better Outcomes.', 'display', 56, TEAL_L)
    paste(f, l1, W / 2 - l1.width / 2, 680 + (1 - ease_out(prog(t, 55.4, 56.0))) * 20, ease_out(prog(t, 55.4, 56.0)))
    paste(f, l2, W / 2 - l2.width / 2, 752 + (1 - ease_out(prog(t, 56.5, 57.1))) * 20, ease_out(prog(t, 56.5, 57.1)))


# (start, end, scene, warp). Scenes 1-5 were animated on the first cut's timeline;
# warp = (new_a, new_b, old_a, old_b) maps film time onto that timeline, so each
# scene keeps its animation and follows the current narration
# (Funda360_voiceover_script.txt).
SCENES = [
    (0, 4.9, scene1, (0, 4.9, 0, 7.3)),           # "Running a school is about more than teaching."
    (4.3, 9.0, scene2, (4.3, 9.0, 6.7, 15.0)),    # learners, attendance, results, parents
    (9.0, 16.6, scene3, (9.0, 16.6, 15.0, 22.0)), # "Meet Funda360"
    (16.6, 28.4, scene4, (16.6, 28.4, 22.0, 35.2)),  # records, attendance, finances, reports
    (28.1, 37.3, scene5, (28.1, 37.3, 34.9, 48.2)),  # teachers and school leaders
    (37.0, 48.6, scene6, None),                   # individual schools, groups, programmes
    (48.3, 60.0, scene7, None),                   # brand close
]
# Crossfades where two scenes overlap.
XFADE = {(0, 1): (4.3, 4.9), (3, 4): (28.1, 28.4), (4, 5): (37.0, 37.3), (5, 6): (48.3, 48.6)}


def scene_time(t, warp):
    if warp is None:
        return t
    na, nb, oa, ob = warp
    return oa + (t - na) * (ob - oa) / (nb - na)

ASSETS = None


def render_frame(n, A, caps):
    t = n / FPS
    frame = None
    active = [i for i, (a, b, _, _) in enumerate(SCENES) if a <= t < b or (i == len(SCENES) - 1 and t >= a)]
    for i in active:
        layer = Image.new('RGBA', (W, H), NAVY + (255,))
        SCENES[i][2](layer, A, scene_time(t, SCENES[i][3]))
        if frame is None:
            frame = layer
        else:
            key = (active[0], i)
            t0, t1 = XFADE.get(key, (SCENES[i][0], SCENES[i - 1][1]))
            frame = Image.blend(frame, layer, ease_io(prog(t, t0, t1)))
    caps.draw(frame, t)
    return frame.convert('RGB')


def main():
    global ASSETS
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('--frames', default=f'0:{NFRAMES}')
    ap.add_argument('--stills')
    args = ap.parse_args()
    ASSETS = Assets()
    caps = Captions(ROOT / 'assets' / 'narration' / 'timing.json')
    a, b = (int(x) for x in args.frames.split(':'))
    if args.stills:
        Path(args.stills).mkdir(parents=True, exist_ok=True)
        for n in range(a, b):
            render_frame(n, ASSETS, caps).save(f'{args.stills}/f{n:04d}.png')
        return
    ff = subprocess.Popen(
        ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
         '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', str(FPS), args.out],
        stdin=subprocess.PIPE)
    for n in range(a, b):
        ff.stdin.write(render_frame(n, ASSETS, caps).tobytes())
        if n % 150 == 0:
            print(f'frame {n}/{b}', flush=True)
    ff.stdin.close()
    if ff.wait() != 0:
        raise SystemExit('ffmpeg failed')


if __name__ == '__main__':
    main()
