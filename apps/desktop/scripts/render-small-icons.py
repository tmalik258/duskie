"""Write 32/64/128 (and extension) icons from the 120px full-body capture."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

FIELD = (8, 8, 10, 255)
SIZES = (32, 64, 128)


def on_field(src: Image.Image, out_size: int, face_frac: float = 0.9) -> Image.Image:
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
    oy = (out_size - nh) // 2
    canvas.alpha_composite(field)
    canvas.alpha_composite(face, (ox, oy))

    mask = Image.new("L", (out_size, out_size), 0)
    ImageDraw.Draw(mask).ellipse((1, 1, out_size - 2, out_size - 2), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(0.4))
    out = Image.new("RGBA", (out_size, out_size), (0, 0, 0, 0))
    out.paste(canvas, (0, 0))
    out.putalpha(mask)

    flat = Image.new("RGBA", (out_size, out_size), FIELD)
    flat.alpha_composite(out)
    return flat.convert("RGB")


def main() -> None:
    src = Image.open(Path(sys.argv[1]))
    desktop = Path(__file__).resolve().parent.parent
    icons = desktop / "src-tauri" / "icons"
    ext = desktop.parent / "extension" / "icons"
    ext.mkdir(parents=True, exist_ok=True)

    for s in SIZES:
        path = icons / f"{s}x{s}.png"
        on_field(src, s).save(path, "PNG", optimize=True)
        print(f"wrote {path} (from 120px)")

    on_field(src, 32).save(ext / "32.png", "PNG", optimize=True)
    on_field(src, 128).save(ext / "128.png", "PNG", optimize=True)
    print(f"wrote {ext / '32.png'} and {ext / '128.png'} (from 120px)")

    # Rebuild ICO so tray/installer use the 120px-derived small sizes.
    layers = [Image.open(icons / f"{s}x{s}.png").convert("RGBA") for s in SIZES]
    big = icons / "icon.png"
    if big.exists():
        layers.append(Image.open(big).convert("RGBA").resize((256, 256), Image.Resampling.LANCZOS))
    layers[0].save(
        icons / "icon.ico",
        format="ICO",
        sizes=[(im.width, im.height) for im in layers],
        append_images=layers[1:],
    )
    print(f"rewrote {icons / 'icon.ico'}")


if __name__ == "__main__":
    main()
