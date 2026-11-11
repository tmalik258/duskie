"""Cut the near-black capture field out of the mascot so app icons get a transparent background.

The mascot captures are flat RGB with a #08080A field. Pixels connected to the image border
within FLOOD_TOL of that field are removed. Edge pixels just outside the tolerance get a soft
alpha, and their field color is subtracted so they don't carry a dark halo.
"""

from __future__ import annotations

from collections import deque

from PIL import Image, ImageFilter

FIELD = (8, 8, 10)
FLOOD_TOL = 14
SOFT_HI = 40


def _dist(p: tuple[int, int, int]) -> int:
    return max(abs(p[0] - FIELD[0]), abs(p[1] - FIELD[1]), abs(p[2] - FIELD[2]))


def _flood_background(px, w: int, h: int) -> bytearray:
    bg = bytearray(w * h)
    queue: deque[tuple[int, int]] = deque()

    def seed(x: int, y: int) -> None:
        i = y * w + x
        if not bg[i] and _dist(px[x, y]) <= FLOOD_TOL:
            bg[i] = 1
            queue.append((x, y))

    for x in range(w):
        seed(x, 0)
        seed(x, h - 1)
    for y in range(h):
        seed(0, y)
        seed(w - 1, y)

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h:
                i = ny * w + nx
                if not bg[i] and _dist(px[nx, ny]) <= FLOOD_TOL:
                    bg[i] = 1
                    queue.append((nx, ny))
    return bg


def key_background(src: Image.Image, margin: float) -> Image.Image:
    """Return the mascot as a transparent RGBA square, cropped to the figure with a margin."""
    rgb = src.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    bg = _flood_background(px, w, h)

    bg_img = Image.new("L", (w, h), 0)
    bg_img.putdata([255 if v else 0 for v in bg])
    band = bg_img.filter(ImageFilter.MaxFilter(7)).load()

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    op = out.load()
    for y in range(h):
        for x in range(w):
            if bg[y * w + x]:
                continue
            c = px[x, y]
            d = _dist(c)
            if band[x, y] and d > FLOOD_TOL:
                a = min(1.0, (d - FLOOD_TOL) / (SOFT_HI - FLOOD_TOL))
                rgb_px = tuple(
                    max(0, min(255, round((c[k] - (1 - a) * FIELD[k]) / a))) for k in range(3)
                )
                op[x, y] = (*rgb_px, round(a * 255))
            else:
                op[x, y] = (*c, 255)

    bbox = out.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("no figure found: every pixel matched the capture field")
    crop = out.crop(bbox)
    side = int(max(crop.size) * (1 + 2 * margin))
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.alpha_composite(crop, ((side - crop.width) // 2, (side - crop.height) // 2))
    return square
