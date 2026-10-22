#!/usr/bin/env python3
"""Сборка текстур для реалистичной графики.

Вход — папка с исходниками (скачиваются отдельно, см. README):
  babylon/  grass.png dirt.jpg sand.jpg ground.jpg rockyGround_basecolor.png   (Babylon.js Assets, CC BY 4.0)
  eztree/   bark/*_color_1k.jpg bark/*_normal_1k.jpg leaves/*_color.png         (ez-tree, MIT; кора — Poly Haven и TextureCan, CC0)
Выход — src/assets/:
  terrain/  albedo-{hi,lo}.webp — слои земли столбиком (RGB), height-{hi,lo}.webp — их высоты (серое),
            layers.json — порядок слоёв и средние цвета
  trees/    кора (цвет и нормали), листва с альфой, вайи пальмы, кожица кактуса
  misc/     атлас пучков травы с цветами, нормали волн, шум для облаков
Скала, снег, лесная подстилка, трава, пальма, кактус, волны и шум генерируются здесь же.

Запуск: python3 -I scripts/build-textures.py <папка-исходников>
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

SRC = sys.argv[1] if len(sys.argv) > 1 else 'assets-src'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'assets')
for d in ('terrain', 'trees', 'misc'):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)


def load_rgb(path, size):
    im = Image.open(path).convert('RGB')
    if im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    return np.asarray(im).astype(np.float64) / 255.0


def to8(arr):
    return np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8)


def save(arr, path, quality=86, lossless=False):
    if arr.ndim == 2:
        im = Image.fromarray(to8(arr), 'L')
    else:
        im = Image.fromarray(to8(arr), 'RGBA' if arr.shape[2] == 4 else 'RGB')
    im.save(path, 'WEBP', quality=quality, lossless=lossless, method=6)


def blur_wrap(a, radius):
    """Гауссово размытие с повтором краёв (бесшовно) через БПФ. Работает и для неквадратных картинок."""
    h, w = a.shape[:2]
    k2 = np.fft.fftfreq(w)[None, :] ** 2 + np.fft.fftfreq(h)[:, None] ** 2
    g = np.exp(-2 * (np.pi * radius) ** 2 * k2)
    if a.ndim == 2:
        return np.fft.ifft2(np.fft.fft2(a) * g).real
    return np.stack([np.fft.ifft2(np.fft.fft2(a[..., c]) * g).real for c in range(a.shape[2])], -1)


def spectral(n, beta, seed, fmin=1.0, fmax=None, aniso=1.0):
    """Бесшовный фрактальный шум: спектр 1/f^beta со случайными фазами; aniso > 1 вытягивает по вертикали."""
    r = np.random.default_rng(seed)
    f = np.fft.fftfreq(n) * n
    k = np.sqrt(f[None, :] ** 2 + (f[:, None] * aniso) ** 2)
    amp = np.where(k >= fmin, np.power(np.maximum(k, 1e-6), -beta / 2), 0)
    if fmax:
        amp *= np.exp(-((k / fmax) ** 4))
    a = np.fft.ifft2(amp * np.exp(1j * r.uniform(0, 2 * np.pi, (n, n)))).real
    a -= a.min()
    return a / a.max()


def voronoi(n, cx, cy, seed, x, y):
    """Бесшовные клетки Вороного на сетке cx×cy: F1, F2 (в пикселях), номер клетки и смещение до её центра."""
    r = np.random.default_rng(seed)
    pts = r.uniform(0.1, 0.9, (cy, cx, 2))
    gx = x * (cx / n)
    gy = y * (cy / n)
    ix = np.floor(gx).astype(int)
    iy = np.floor(gy).astype(int)
    f1 = np.full(x.shape, np.inf)
    f2 = np.full(x.shape, np.inf)
    cid = np.zeros(x.shape, int)
    ldx = np.zeros(x.shape)
    ldy = np.zeros(x.shape)
    for oy in (-1, 0, 1):
        for ox in (-1, 0, 1):
            jx = ix + ox
            jy = iy + oy
            p = pts[jy % cy, jx % cx]
            dx = (jx + p[..., 0] - gx) * (n / cx)
            dy = (jy + p[..., 1] - gy) * (n / cy)
            d = np.sqrt(dx * dx + dy * dy)
            closer = d < f1
            f2 = np.where(closer, f1, np.minimum(f2, d))
            cid = np.where(closer, (jy % cy) * cx + (jx % cx), cid)
            ldx = np.where(closer, dx, ldx)
            ldy = np.where(closer, dy, ldy)
            f1 = np.minimum(f1, d)
    return f1, f2, cid, ldx, ldy


def normalize(h):
    h = h - h.min()
    return h / max(h.max(), 1e-9)


def luminance_height(rgb, blur=1.2, detail=0.35):
    lum = rgb[..., 0] * 0.3 + rgb[..., 1] * 0.59 + rgb[..., 2] * 0.11
    base = blur_wrap(lum, blur * 6)
    return normalize(blur_wrap(lum, blur) * (1 - detail) + (lum - base + 0.5) * detail)


def match_mean(rgb, target):
    """Подогнать средний цвет (sRGB 0..255) — у фото разная экспозиция."""
    m = rgb.reshape(-1, 3).mean(0)
    return np.clip(rgb * (np.array(target) / 255.0) / m, 0, 1)


def stamp_wrap(draw_fn, size, x, y, reach):
    """Нарисовать фигуру и её копии за краями — чтобы плитка оставалась бесшовной."""
    for ox in (-size, 0, size):
        for oy in (-size, 0, size):
            if -reach < x + ox < size + reach and -reach < y + oy < size + reach:
                draw_fn(x + ox, y + oy)


# ---------- Процедурные слои земли ----------
def cliff_rock(n):
    """Скальная стена: сколы с наклонными гранями, трещины-отдельности, слоистость, потёки и лишайник."""
    y, x = np.mgrid[0:n, 0:n].astype(np.float64)
    w1 = spectral(n, 3.0, 51, fmin=2) - 0.5
    w2 = spectral(n, 3.0, 52, fmin=2) - 0.5
    f1, f2, cid, ldx, ldy = voronoi(n, 5, 9, 53, x + w1 * n * 0.22, y + w2 * n * 0.12)
    r = np.random.default_rng(54)
    cells = 5 * 9
    base, sx, sy = r.uniform(0, 1, cells), r.normal(0, 1, cells), r.normal(0, 1, cells)
    plane = base[cid] * 0.6 + (sx[cid] * ldx + sy[cid] * ldy) / n * 2.2
    edge = np.clip((f2 - f1) / (n * 0.012), 0, 1)
    mid = spectral(n, 2.4, 55, fmin=5)
    ridge = 1 - np.abs(spectral(n, 2.2, 56, fmin=6) * 2 - 1)
    fine = spectral(n, 1.4, 57, fmin=40)
    strata = np.sin((y / n * 11 + w1 * 1.4) * 2 * np.pi) * 0.5 + 0.5
    joints = np.clip((1 - np.abs(spectral(n, 2.0, 60, fmin=3, aniso=3.5) * 2 - 1) - 0.93) * 14, 0, 1)
    h = plane * 0.26 + mid * 0.32 + ridge ** 3 * 0.12 + fine * 0.1 + strata * 0.08 - joints * 0.12
    h = normalize(blur_wrap(h * (0.55 + 0.45 * edge ** 0.5), 0.6))
    tone = r.uniform(-1, 1, cells)[cid] * 0.6
    dark, midc, light = np.array([84, 80, 74]) / 255, np.array([128, 122, 112]) / 255, np.array([168, 160, 146]) / 255
    t = np.clip(h * 1.15 - 0.05, 0, 1)[..., None]
    col = np.where(t < 0.5, dark + (midc - dark) * t * 2, midc + (light - midc) * (t * 2 - 1))
    col *= 1 + 0.06 * tone[..., None] * np.array([1.0, 0.9, 0.75])
    rust = np.clip((spectral(n, 2.6, 58, fmin=3, aniso=0.35) - 0.58) * 3, 0, 1)[..., None]
    col = col * (1 - 0.25 * rust) + np.array([110, 86, 62]) / 255 * 0.25 * rust
    lich = (np.clip((spectral(n, 1.6, 59, fmin=12) - 0.66) * 4, 0, 1) * np.clip(h * 2 - 0.6, 0, 1))[..., None]
    col = col * (1 - 0.45 * lich) + np.array([146, 148, 116]) / 255 * 0.45 * lich
    ao = np.clip(0.55 + 0.45 * edge ** 0.35, 0, 1) * (0.8 + 0.2 * h) * (1 - 0.35 * joints)
    col *= ao[..., None] * (0.88 + 0.24 * fine[..., None])
    return np.clip(col, 0, 1), h


def snow(n):
    soft = spectral(n, 3.4, 21, fmin=2)
    drift = spectral(n, 2.2, 23, fmin=6, aniso=0.5)
    grain = spectral(n, 1.2, 22, fmin=60)
    h = normalize(soft * 0.7 + drift * 0.2 + grain * 0.1)
    col = np.array([0.93, 0.95, 0.98]) * (0.9 + 0.1 * h[..., None]) + (np.array([0.82, 0.88, 0.97]) - 0.9) * (1 - h[..., None]) * 0.3
    return np.clip(col, 0, 1), h


def dry_grass(grass_rgb):
    """Выгоревшая трава для переходов к степи и пустыне: тот же рисунок, другие оттенки."""
    lum = grass_rgb.mean(-1, keepdims=True)
    out = lum * np.array([0.72, 0.62, 0.36]) * 1.6 + grass_rgb * 0.15
    return match_mean(out, [150, 130, 78])


def forest_floor(dirt, n, seed=71):
    """Лесная подстилка: земля, опавшие листья, хвоя и веточки (рисуется вдвое крупнее и сжимается)."""
    S = 2
    N = n * S
    k = n / 1024
    big = Image.fromarray(to8(dirt), 'RGB').resize((N, N), Image.BILINEAR)
    hmap = Image.new('L', (N, N), 0)
    d = ImageDraw.Draw(big)
    dh = ImageDraw.Draw(hmap)
    r = np.random.default_rng(seed)
    leaf_cols = [(104, 78, 48), (118, 88, 54), (86, 64, 42), (126, 102, 64), (84, 78, 50), (98, 66, 42)]
    for _ in range(2000):
        x, y = r.uniform(0, N), r.uniform(0, N)
        a = r.uniform(0, np.pi)
        L = r.uniform(10, 26) * S * k * 2
        W = L * r.uniform(0.35, 0.55)
        c = np.array(leaf_cols[r.integers(len(leaf_cols))]) * r.uniform(0.8, 1.08)
        col = tuple(int(v) for v in np.clip(c, 0, 255))
        vein = tuple(int(v * 0.8) for v in col)
        shade = int(r.uniform(90, 200))

        def leaf(px, py):
            pts = []
            for t in np.linspace(0, 2 * np.pi, 14, endpoint=False):
                lx = np.cos(t) * L / 2
                ly = np.sin(t) * W / 2 * (1 - 0.35 * np.cos(t))
                pts.append((px + lx * np.cos(a) - ly * np.sin(a), py + lx * np.sin(a) + ly * np.cos(a)))
            d.polygon(pts, fill=col)
            dh.polygon(pts, fill=shade)
            d.line([(px - np.cos(a) * L / 2, py - np.sin(a) * L / 2), (px + np.cos(a) * L / 2, py + np.sin(a) * L / 2)],
                   fill=vein, width=max(1, int(S * k * 2)))

        stamp_wrap(leaf, N, x, y, L)
    for _ in range(1800):  # хвоя и травинки
        x, y = r.uniform(0, N), r.uniform(0, N)
        a = r.uniform(0, np.pi)
        L = r.uniform(8, 20) * S * k * 2
        col = (int(r.uniform(90, 130)), int(r.uniform(70, 95)), int(r.uniform(40, 55)))

        def needle(px, py):
            seg = [(px, py), (px + np.cos(a) * L, py + np.sin(a) * L)]
            d.line(seg, fill=col, width=max(1, int(S * k * 1.5)))
            dh.line(seg, fill=150, width=max(1, int(S * k * 1.5)))

        stamp_wrap(needle, N, x, y, L)
    for _ in range(90):  # веточки
        x, y = r.uniform(0, N), r.uniform(0, N)
        a = r.uniform(0, np.pi)
        L = r.uniform(40, 110) * S * k * 2
        col = (int(r.uniform(70, 95)), int(r.uniform(52, 66)), int(r.uniform(36, 44)))

        def twig(px, py):
            seg = [(px, py), (px + np.cos(a) * L, py + np.sin(a) * L)]
            d.line(seg, fill=col, width=max(2, int(S * k * 4)))
            dh.line(seg, fill=230, width=max(2, int(S * k * 4)))

        stamp_wrap(twig, N, x, y, L)
    rgb = np.asarray(big.resize((n, n), Image.LANCZOS)).astype(np.float64) / 255
    lit = np.asarray(hmap.resize((n, n), Image.LANCZOS)).astype(np.float64) / 255
    h = normalize(luminance_height(dirt, 1.4, 0.4) * 0.6 + blur_wrap(lit, 0.8) * 0.5)
    rgb *= 0.8 + 0.2 * blur_wrap(lit, 1.5)[..., None]  # под листьями — тень
    moss = np.clip((spectral(n, 3.0, 72, fmin=2) - 0.6) * 4, 0, 1)[..., None] * 0.35
    rgb = rgb * (1 - moss) + np.array([0.3, 0.36, 0.16]) * (0.8 + 0.4 * rgb.mean(-1, keepdims=True)) * moss
    return match_mean(rgb, [90, 74, 52]), h


LAYERS = ['grass', 'forest', 'sand', 'desert', 'rocky', 'cliff', 'snow', 'dry']


def build_terrain(size, tag):
    b = os.path.join(SRC, 'babylon')
    grass = match_mean(load_rgb(f'{b}/grass.png', size), [88, 118, 50])
    dirt = match_mean(load_rgb(f'{b}/dirt.jpg', size), [96, 80, 56])
    sand = match_mean(load_rgb(f'{b}/sand.jpg', size), [196, 168, 122])
    desert = match_mean(load_rgb(f'{b}/ground.jpg', size), [186, 154, 106])
    rocky = match_mean(load_rgb(f'{b}/rockyGround_basecolor.png', size), [142, 132, 118])
    forest, forest_h = forest_floor(dirt, size)
    cliff, cliff_h = cliff_rock(size)
    snow_c, snow_h = snow(size)
    dry = dry_grass(grass)
    data = {
        'grass': (grass, luminance_height(grass, 1.0, 0.5)),
        'forest': (forest, forest_h),
        'sand': (sand, luminance_height(sand, 1.6, 0.3)),
        'desert': (desert, luminance_height(desert, 1.2, 0.45)),
        'rocky': (rocky, luminance_height(rocky, 1.0, 0.5)),
        'cliff': (cliff, cliff_h),
        'snow': (snow_c, snow_h),
        'dry': (dry, luminance_height(dry, 1.0, 0.5)),
    }
    alb = np.concatenate([data[k][0] for k in LAYERS], 0)
    # высоты чуть сглажены: нормали считаются в шейдере по разности соседних текселей
    hgt = np.concatenate([blur_wrap(data[k][1], 0.5 * size / 1024) for k in LAYERS], 0)
    save(alb, os.path.join(OUT, 'terrain', f'albedo-{tag}.webp'), quality=80)
    save(hgt, os.path.join(OUT, 'terrain', f'height-{tag}.webp'), quality=74)
    means = {k: [round(float(v), 4) for v in data[k][0].reshape(-1, 3).mean(0)] for k in LAYERS}
    return {'size': size, 'means': means}


# ---------- Деревья ----------
def bleed(a, radius=6):
    """Цвет за краем альфы — как у соседних пикселей, чтобы мипмапы не давали тёмную кайму."""
    rgb = a[..., :3]
    mask = (a[..., 3:4] > 0.5).astype(np.float64)
    fill = blur_wrap(rgb * mask, radius) / np.maximum(blur_wrap(mask[..., 0], radius)[..., None], 1e-3)
    a[..., :3] = np.where(mask > 0, rgb, np.clip(fill, 0, 1))
    return a


def build_trees():
    e = os.path.join(SRC, 'eztree')
    for sp in ['oak', 'birch', 'pine']:
        save(load_rgb(f'{e}/bark/{sp}_color_1k.jpg', 512), os.path.join(OUT, 'trees', f'bark-{sp}.webp'), quality=82)
        save(load_rgb(f'{e}/bark/{sp}_normal_1k.jpg', 512), os.path.join(OUT, 'trees', f'bark-{sp}-n.webp'), quality=88)
    for lf in ['oak', 'aspen', 'pine']:
        im = Image.open(f'{e}/leaves/{lf}_color.png').convert('RGBA').resize((512, 512), Image.LANCZOS)
        save(bleed(np.asarray(im).astype(np.float64) / 255), os.path.join(OUT, 'trees', f'leaves-{lf}.webp'), quality=90)


def build_palm():
    """Вайя пальмы (лист-перо, черешок слева) и кольчатая кора ствола."""
    W, H, S = 512, 256, 4
    img = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = np.random.default_rng(81)
    cy = H * S * 0.5
    for i in range(46):
        t = 0.04 + 0.94 * i / 46
        x0 = t * W * S
        for side in (-1, 1):
            L = (0.42 * np.sin(np.pi * min(1, t * 1.1)) + 0.08) * H * S * r.uniform(0.85, 1.05)
            ex = x0 + L * 0.55 + r.normal(0, 3 * S)
            ey = cy + side * L
            w = (5.5 - 3 * t) * S
            base = np.array([62, 98, 40]) * r.uniform(0.85, 1.1)
            tipc = np.array([118, 150, 62]) * r.uniform(0.85, 1.1)
            steps = 10
            for s in range(steps):
                a0, a1 = s / steps, (s + 1) / steps
                px0, py0 = x0 + (ex - x0) * a0, cy + (ey - cy) * a0
                px1, py1 = x0 + (ex - x0) * a1, cy + (ey - cy) * a1
                w0, w1 = w * (1 - a0 * 0.8), w * (1 - a1 * 0.8)
                nx, ny = -(py1 - py0), px1 - px0
                ln = np.hypot(nx, ny) or 1
                nx, ny = nx / ln, ny / ln
                c = base * (1 - a0) + tipc * a0
                d.polygon([(px0 + nx * w0, py0 + ny * w0), (px1 + nx * w1, py1 + ny * w1), (px1 - nx * w1, py1 - ny * w1), (px0 - nx * w0, py0 - ny * w0)],
                          fill=(int(c[0]), int(c[1]), int(c[2]), 255))
    d.line([(0, cy), (W * S, cy)], fill=(120, 112, 60, 255), width=int(5 * S))
    frond = np.asarray(img.resize((W, H), Image.LANCZOS)).astype(np.float64) / 255
    save(bleed(frond, 4), os.path.join(OUT, 'trees', 'palm-frond.webp'), quality=90)

    n = 256
    noise = spectral(n * 2, 3, 82, fmin=2)[:, :n]
    y = np.arange(n * 2)[:, None] / (n * 2)
    rings = (np.sin(y * 2 * np.pi * 18 + noise * 2.5) * 0.5 + 0.5) ** 2.5
    fib = spectral(n * 2, 1.6, 83, fmin=10, aniso=0.15)[:, :n]
    col = np.array([0.42, 0.34, 0.25]) * (0.72 + 0.28 * fib[..., None]) * (1 - 0.35 * rings[..., None])
    col += np.array([0.12, 0.1, 0.06]) * (1 - rings[..., None])
    save(np.clip(col, 0, 1), os.path.join(OUT, 'trees', 'palm-bark.webp'), quality=84)


def build_cactus():
    """Кожица кактуса: полосы рёбер и ряды колючих ареол (u — по окружности, v — вдоль ствола)."""
    n = 256
    y, x = np.mgrid[0:n, 0:n].astype(np.float64)
    ribs = 0.5 + 0.5 * np.cos(x / n * 2 * np.pi * 8)
    streak = spectral(n, 2.0, 91, fmin=4, aniso=0.2)
    col = np.array([0.24, 0.38, 0.2]) * (0.75 + 0.35 * ribs[..., None]) * (0.85 + 0.3 * streak[..., None])
    img = Image.fromarray(to8(col), 'RGB')
    d = ImageDraw.Draw(img)
    for k in range(8):
        cx = k / 8 * n
        for j in range(14):
            cy = (j + 0.5 * (k % 2)) / 14 * n
            for ox in (0, n) if k == 0 else (0,):
                d.ellipse([cx + ox - 2.2, cy - 2.2, cx + ox + 2.2, cy + 2.2], fill=(214, 206, 170))
                for a in np.linspace(0, 2 * np.pi, 5, endpoint=False):
                    d.line([(cx + ox, cy), (cx + ox + np.cos(a) * 6, cy + np.sin(a) * 6)], fill=(226, 220, 190), width=1)
    save(np.asarray(img).astype(np.float64) / 255, os.path.join(OUT, 'trees', 'cactus.webp'), quality=86)


# ---------- Пучки травы: атлас 2×2 (трава, сухая трава, с белыми и жёлтыми цветами, с лиловыми) ----------
def grass_tile(seed, dry_share, flowers, W=512, H=512, S=4):
    img = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = np.random.default_rng(seed)
    for _ in range(300):
        x0 = r.uniform(0.05, 0.95) * W * S
        hgt = r.uniform(0.4, 0.97) * H * S
        lean = r.normal(0, 0.16) * W * S
        w0 = r.uniform(4.5, 10) * S
        dry = r.random() < dry_share
        base = np.array([46, 66, 26]) if not dry else np.array([104, 92, 50])
        tip = (np.array([124, 154, 62]) if not dry else np.array([196, 174, 108])) * r.uniform(0.85, 1.12)
        steps = 12
        pts_l, pts_r = [], []
        for s in range(steps + 1):
            t = s / steps
            x = x0 + lean * t * t
            yy = H * S - hgt * t
            w = w0 * (1 - t) ** 0.9 + 0.5 * S
            pts_l.append((x - w / 2, yy))
            pts_r.append((x + w / 2, yy))
        for s in range(steps):
            t = (s + 0.5) / steps
            c = base * (1 - t) + tip * t
            d.polygon([pts_l[s], pts_l[s + 1], pts_r[s + 1], pts_r[s]], fill=(int(c[0]), int(c[1]), int(c[2]), 255))
    for _ in range(26 if flowers else 0):
        col = np.array(flowers[r.integers(len(flowers))])
        x0 = r.uniform(0.1, 0.9) * W * S
        top = H * S * (1 - r.uniform(0.45, 0.85))
        lean = r.normal(0, 0.05) * W * S
        d.line([(x0, H * S), (x0 + lean, top)], fill=(70, 100, 40, 255), width=int(2.2 * S))
        R = r.uniform(7, 12) * S
        cx, cy = x0 + lean, top
        for a in np.linspace(0, 2 * np.pi, 6, endpoint=False) + r.uniform(0, 1):
            px, py = cx + np.cos(a) * R * 0.75, cy + np.sin(a) * R * 0.45
            c = col * r.uniform(0.85, 1.05)
            d.ellipse([px - R * 0.55, py - R * 0.4, px + R * 0.55, py + R * 0.4], fill=(int(c[0]), int(c[1]), int(c[2]), 255))
        d.ellipse([cx - R * 0.3, cy - R * 0.25, cx + R * 0.3, cy + R * 0.25], fill=(232, 196, 64, 255))
    return np.asarray(img.resize((W, H), Image.LANCZOS)).astype(np.float64) / 255


def build_grass():
    tiles = [
        grass_tile(7, 0.1, []),
        grass_tile(8, 0.75, []),
        grass_tile(9, 0.1, [(250, 250, 246), (246, 214, 60)]),
        grass_tile(10, 0.1, [(170, 110, 220), (120, 140, 240), (236, 120, 170)]),
    ]
    atlas = np.concatenate([np.concatenate(tiles[:2], 1), np.concatenate(tiles[2:], 1)], 0)
    save(bleed(atlas, 4), os.path.join(OUT, 'misc', 'grass.webp'), quality=86)


# ---------- Волны: спектр Филлипса (ветер вдоль x), бесшовная карта нормалей ----------
def build_water(n=512):
    r = np.random.default_rng(31)
    k1 = np.fft.fftfreq(n) * n
    kx, kz = np.meshgrid(k1, k1)
    k = np.sqrt(kx ** 2 + kz ** 2)
    k[0, 0] = 1
    L = 22.0  # пик спектра: волны примерно в 1/22 плитки
    wdir = np.array([0.92, 0.39])
    cosw = (kx * wdir[0] + kz * wdir[1]) / k
    P = np.exp(-1 / (k / L) ** 2) / k ** 4 * np.abs(cosw) ** 2.2 * np.exp(-(k / 140) ** 2)
    P[0, 0] = 0
    h = normalize(np.fft.ifft2(np.sqrt(P) * (r.normal(size=(n, n)) + 1j * r.normal(size=(n, n)))).real)
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * 30
    gz = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * 30
    ln = np.sqrt(gx * gx + 1 + gz * gz)
    save(np.stack([-gx / ln * 0.5 + 0.5, -gz / ln * 0.5 + 0.5, 1 / ln], -1), os.path.join(OUT, 'misc', 'water-normal.webp'), quality=90)


# ---------- Шум для облаков: R — крупное fbm, G — среднее, B — «клубы» (инвертированный Вороной) ----------
def build_noise(n=256):
    a = spectral(n, 2.4, 41, fmin=2)
    b = spectral(n, 1.8, 42, fmin=6)
    y, x = np.mgrid[0:n, 0:n].astype(np.float64)
    f1 = voronoi(n, 8, 8, 43, x, y)[0]
    c = 1 - np.clip(f1 / (n / 8 * 0.9), 0, 1)
    save(np.stack([a, b, c], -1), os.path.join(OUT, 'misc', 'noise.webp'), lossless=True)


if __name__ == '__main__':
    meta = {'layers': LAYERS, 'hi': build_terrain(1024, 'hi'), 'lo': build_terrain(512, 'lo')}
    with open(os.path.join(OUT, 'terrain', 'layers.json'), 'w') as f:
        json.dump(meta, f, indent=1)
    build_trees()
    build_palm()
    build_cactus()
    build_grass()
    build_water()
    build_noise()
    for root, _, files in os.walk(OUT):
        for fn in sorted(files):
            p = os.path.join(root, fn)
            print(f'{os.path.relpath(p, OUT):28s} {os.path.getsize(p) / 1024:8.1f} KB')
