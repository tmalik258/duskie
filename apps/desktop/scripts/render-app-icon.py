"""Composite mascot-512.png into a 1024 circular app-icon.png."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
FIELD = (8, 8, 10, 255)


def on_field(src: Image.Image, out_size: int, face_frac: float = 0.86) -> Image.Image:
    src = src.convert("RGBA")
    canvas = Image.new("RGBA", (out_size, out_size), (0, 0, 0, 0))
    field = Image.new("RGBA", (out_size, out_size), (0, 0, 0, 0))
    ImageDraw.Draw(field).ellipse((1, 1, out_size - 2, out_size - 2), fill=FIELD)

    face_box = int(out_size * face_frac)
    ratio = src.width / max(src.height, 1)
    if ratio >= 1:
        nw, nh = face_box, max(1, int(face_box / ratio))
    else:
        nw, nh = max(1, int(face_box * ratio)), face_box
    face = src.resize((nw, nh), Image.Resampling.LANCZOS)
    ox = (out_size - nw) // 2
    oy = (out_size - nh) // 2 + int(out_size * 0.02)
    canvas.alpha_composite(field)
    canvas.alpha_composite(face, (ox, oy))

    mask = Image.new("L", (out_size, out_size), 0)
    ImageDraw.Draw(mask).ellipse((1, 1, out_size - 2, out_size - 2), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(0.5))
    out = Image.new("RGBA", (out_size, out_size), (0, 0, 0, 0))
    out.paste(canvas, (0, 0))
    out.putalpha(mask)

    flat = Image.new("RGBA", (out_size, out_size), FIELD)
    flat.alpha_composite(out)
    return flat.convert("RGB")


def main() -> None:
    master_path = Path(sys.argv[1])
    out_icon = Path(sys.argv[2])
    on_field(Image.open(master_path), SIZE).save(out_icon, "PNG", optimize=True)
    print(f"wrote {out_icon} ({SIZE}x{SIZE})")


if __name__ == "__main__":
    main()
