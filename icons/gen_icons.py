#!/usr/bin/env python3
"""Rasterize icon.svg's open-book glyph into the four PNG sizes the
manifest needs (16/32/48/128).

No SVG rasterizer (cairosvg/svglib) is available in this environment, so
this samples the exact same cubic-bezier path data as icons/icon.svg by
hand and draws it with Pillow -- supersampled at 8x and downsampled with
LANCZOS for clean anti-aliasing, rather than drawing directly at each tiny
target size. If icon.svg's paths ever change, update PAGE_LEFT/PAGE_RIGHT
here to match, or this script quietly drifts from the vector source.
"""
from PIL import Image, ImageDraw

BG = (45, 80, 68, 255)      # #2d5044, matches --accent (light mode)
PAPER = (246, 244, 239, 255)  # #f6f4ef, matches --paper (light mode)

SUPERSAMPLE = 8
BASE = 128  # matches icon.svg's viewBox

# Cubic bezier segments transcribed directly from icon.svg's two <path>s.
# Each path: M start -> C c1 c2 end -> L end2 -> C c1 c2 end3 -> Z
PAGE_LEFT = [
    ('M', (58, 30)),
    ('L', (24, 40)),
    ('L', (24, 88)),
    ('L', (58, 94)),
    ('Z',),
]
PAGE_RIGHT = [
    ('M', (70, 30)),
    ('L', (104, 40)),
    ('L', (104, 88)),
    ('L', (70, 94)),
    ('Z',),
]


def cubic_bezier_points(p0, p1, p2, p3, n=24):
    pts = []
    for i in range(1, n + 1):
        t = i / n
        mt = 1 - t
        x = (mt**3 * p0[0] + 3 * mt**2 * t * p1[0] + 3 * mt * t**2 * p2[0] + t**3 * p3[0])
        y = (mt**3 * p0[1] + 3 * mt**2 * t * p1[1] + 3 * mt * t**2 * p2[1] + t**3 * p3[1])
        pts.append((x, y))
    return pts


def path_to_polygon(segments, scale):
    poly = []
    cur = None
    start = None
    for seg in segments:
        kind = seg[0]
        if kind == 'M':
            cur = seg[1]
            start = cur
            poly.append(cur)
        elif kind == 'L':
            cur = seg[1]
            poly.append(cur)
        elif kind == 'C':
            p1, p2, p3 = seg[1], seg[2], seg[3]
            poly.extend(cubic_bezier_points(cur, p1, p2, p3))
            cur = p3
        elif kind == 'Z':
            poly.append(start)
    return [(x * scale, y * scale) for x, y in poly]


def render(size):
    hi = size * SUPERSAMPLE
    scale = hi / BASE
    img = Image.new('RGBA', (hi, hi), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    corner_r = 26 * scale
    inset = 4 * scale
    d.rounded_rectangle(
        [inset, inset, hi - inset, hi - inset], radius=corner_r, fill=BG,
    )

    d.polygon(path_to_polygon(PAGE_LEFT, scale), fill=PAPER)
    d.polygon(path_to_polygon(PAGE_RIGHT, scale), fill=PAPER)

    return img.resize((size, size), Image.LANCZOS)


if __name__ == '__main__':
    for size in (16, 32, 48, 128):
        render(size).save(f'icon{size}.png')
        print(f'icon{size}.png written')
