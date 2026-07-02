#!/usr/bin/env python3
"""
Generate the full favicon set for Crypto Portfolio Tracker.

Renders one master design at every needed size using Pillow (no system
libcairo needed), and writes a matching hand-authored SVG so modern browsers
get a razor-sharp vector icon. The design mirrors the in-app brand:

  * "Trading terminal" palette - deep charcoal-blue background (#0b1120 ->
    #1e293b), the same colors used for `theme-color` and the dark theme.
  * Emerald signature line (#34d399 = --primary/--positive) drawn as an
    ascending area chart with an up-arrow - a literal nod to the live P&L
    `PortfolioLineChart` the dashboard shows.

Output (into public/):
  favicon.svg            vector icon (modern browsers / retina)
  favicon.ico            multi-resolution 16/32/48 (legacy / tabs / bookmarks)
  apple-touch-icon.png   180x180 (iOS home screen / Safari pinned)
  icon-192.png           192x192 (Android / PWA manifest)
  icon-512.png           512x512 (PWA manifest / splash)

Re-run any time the brand changes: `python scripts/generate-icons.py`.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

# ----------------------------------------------------------------------------
# Brand palette (hex). Mirrors src/styles.css dark theme + theme-color.
# ----------------------------------------------------------------------------
BG_TOP = (11, 17, 32, 255)            # #0b1120  - page background / theme-color
BG_BOTTOM = (30, 41, 59, 255)         # #1e293b  - card / surface
GRID = (148, 163, 184, 26)            # slate-400 @ ~10% - faint terminal grid
EMERALD = (52, 211, 153, 255)         # #34d399  --primary / --positive
EMERALD_SOFT = (52, 211, 153, 58)     # area fill under the line (~23%)
EMERALD_BRIGHT = (110, 231, 183, 255)  # #6ee7b7 - arrow accent

# Control points of the trend line, in normalized [0,1] canvas coords.
# Read left->right, bottom->top with a realistic mid dip (like a real P&L curve).
CURVE = [
    (0.135, 0.805),
    (0.330, 0.660),
    (0.520, 0.735),  # small pullback
    (0.700, 0.470),
    (0.815, 0.300),  # arrow tip
]
LINE_BASELINE_Y = 0.895  # where the area fill closes at the bottom


# ----------------------------------------------------------------------------
# Catmull-Rom spline so the polyline renders as a smooth curve.
# ----------------------------------------------------------------------------
def catmull_rom(points, samples=48):
    pts = [points[0]] + points + [points[-1]]
    out = []
    for i in range(len(pts) - 3):
        p0, p1, p2, p3 = pts[i], pts[i + 1], pts[i + 2], pts[i + 3]
        for s in range(samples):
            t = s / samples
            t2 = t * t
            t3 = t2 * t
            x = 0.5 * (
                (2 * p1[0])
                + (-p0[0] + p2[0]) * t
                + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
                + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
            )
            y = 0.5 * (
                (2 * p1[1])
                + (-p0[1] + p2[1]) * t
                + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
                + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
            )
            out.append((x, y))
    out.append(points[-1])
    return out


def _scale(points, size):
    return [(round(x * size), round(y * size)) for (x, y) in points]


# ----------------------------------------------------------------------------
# Render the icon at `size` x `size` pixels.
# ----------------------------------------------------------------------------
def render(size):
    # Anti-alias small icons by supersampling at 4x then downscaling.
    ss = 4
    S = size * ss
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 1) Squircle / rounded-square app-icon background with vertical gradient.
    grad = Image.new("RGBA", (S, S), 0)
    gd = ImageDraw.Draw(grad)
    for y in range(S):
        t = y / (S - 1)
        r = round(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t)
        g = round(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t)
        b = round(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t)
        gd.line([(0, y), (S - 1, y)], fill=(r, g, b, 255))

    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, S - 1, S - 1], radius=int(S * 0.225), fill=255
    )
    img.paste(grad, (0, 0), mask)

    # 2) Faint horizontal grid - "trading terminal" texture.
    for frac in (0.30, 0.50, 0.70):
        gy = int(S * frac)
        d.line([(S * 0.10, gy), (S * 0.90, gy)], fill=GRID, width=max(1, S // 256))

    # 3) Emerald ascending area chart.
    line = catmull_rom(CURVE, samples=64)
    area = line + [(CURVE[-1][0], LINE_BASELINE_Y), (CURVE[0][0], LINE_BASELINE_Y)]
    d.polygon(_scale(area, S), fill=EMERALD_SOFT)

    line_w = max(2, int(S * 0.058))
    d.line(_scale(line, S), fill=EMERALD, width=line_w, joint="curve")

    # 4) Up-arrow at the tip of the line, oriented along its travel direction.
    tip = CURVE[-1]
    prev = CURVE[-2]
    ang = math.atan2(tip[1] - prev[1], tip[0] - prev[0])
    ah = S * 0.135
    px, py = tip[0] * S, tip[1] * S
    bx = (tip[0] - math.cos(ang) * 0.045) * S
    by = (tip[1] - math.sin(ang) * 0.045) * S
    nx, ny = -math.sin(ang), math.cos(ang)
    a = ah / 2
    p_left = (bx + nx * a, by + ny * a)
    p_right = (bx - nx * a, by - ny * a)
    p_tip = (px + math.cos(ang) * ah, py + math.sin(ang) * ah)
    d.polygon(
        [(round(p_left[0]), round(p_left[1])),
         (round(p_right[0]), round(p_right[1])),
         (round(p_tip[0]), round(p_tip[1]))],
        fill=EMERALD_BRIGHT,
    )

    if ss != 1:
        img = img.resize((size, size), Image.LANCZOS)
    return img


# Hand-authored vector icon - same geometry as render(), razor-sharp on retina.
SVG_TEMPLATE = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Crypto Portfolio Tracker">
  <title>Crypto Portfolio Tracker</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b1120"/>
      <stop offset="1" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#34d399" stop-opacity="0.38"/>
      <stop offset="1" stop-color="#34d399" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="round"><rect width="512" height="512" rx="115" ry="115"/></clipPath>
  </defs>
  <g clip-path="url(#round)">
    <rect width="512" height="512" fill="url(#bg)"/>
    <g stroke="#94a3b8" stroke-opacity="0.10" stroke-width="2">
      <line x1="51" y1="154" x2="461" y2="154"/>
      <line x1="51" y1="256" x2="461" y2="256"/>
      <line x1="51" y1="358" x2="461" y2="358"/>
    </g>
    <path d="M69 458 L69 412 C86 400, 136 344, 169 338 C202 332, 235 392, 266 376 C298 360, 333 278, 358 241 C383 204, 408 168, 418 154 L418 458 Z" fill="url(#area)"/>
    <path d="M69 412 C86 400, 136 344, 169 338 C202 332, 235 392, 266 376 C298 360, 333 278, 358 241 C383 204, 408 168, 418 154"
          fill="none" stroke="#34d399" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M418 154 L433 193 L377 153 Z" fill="#6ee7b7"/>
  </g>
</svg>
"""


def main():
    out = Path(__file__).resolve().parent.parent / "public"
    out.mkdir(exist_ok=True)

    # Vector icon (modern browsers).
    (out / "favicon.svg").write_text(SVG_TEMPLATE.strip() + "\n", encoding="utf-8")

    # Multi-resolution ICO (legacy tabs / bookmarks / Windows).
    ico_images = [render(s) for s in (48, 32, 16)]
    ico_images[0].save(
        out / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=ico_images[1:],
    )

    # Apple touch icon + PWA icons.
    render(180).save(out / "apple-touch-icon.png", format="PNG")
    render(192).save(out / "icon-192.png", format="PNG")
    render(512).save(out / "icon-512.png", format="PNG")

    for name in ("favicon.svg", "favicon.ico", "apple-touch-icon.png", "icon-192.png", "icon-512.png"):
        print(f"  wrote {out / name} ({(out / name).stat().st_size} bytes)")


if __name__ == "__main__":
    main()
