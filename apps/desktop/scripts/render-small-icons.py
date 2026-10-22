"""Write 32/64/128 (and extension) icons from the 120px full-body capture, transparent background."""

from __future__ import annotations

import io
import struct
import sys
from pathlib import Path

from PIL import Image

from icon_key import key_background

SIZES = (32, 64, 128)
MARGIN = 0.05


def write_ico(path: Path, layers: list[Image.Image]) -> None:
    """Write a multi-size ICO with one PNG-compressed entry per layer (Windows Vista+ format)."""
    blobs = []
    for im in sorted(layers, key=lambda layer: layer.width):
        buf = io.BytesIO()
        im.save(buf, "PNG")
        blobs.append((im.width, im.height, buf.getvalue()))
    offset = 6 + 16 * len(blobs)
    header = struct.pack("<HHH", 0, 1, len(blobs))
    entries = b""
    data = b""
    for w, h, png in blobs:
        entries += struct.pack(
            "<BBBBHHII", w % 256, h % 256, 0, 0, 1, 32, len(png), offset
        )
        offset += len(png)
        data += png
    path.write_bytes(header + entries + data)


def main() -> None:
    src = Image.open(Path(sys.argv[1]))
    figure = key_background(src, MARGIN)
    desktop = Path(__file__).resolve().parent.parent
    icons = desktop / "src-tauri" / "icons"
    ext = desktop.parent / "extension" / "icons"
    ext.mkdir(parents=True, exist_ok=True)

    def at(size: int) -> Image.Image:
        return figure.resize((size, size), Image.Resampling.LANCZOS)

    for s in SIZES:
        path = icons / f"{s}x{s}.png"
        at(s).save(path, "PNG", optimize=True)
        print(f"wrote {path} (from 120px)")

    at(32).save(ext / "32.png", "PNG", optimize=True)
    at(128).save(ext / "128.png", "PNG", optimize=True)
    print(f"wrote {ext / '32.png'} and {ext / '128.png'} (from 120px)")

    # Rebuild ICO so tray/installer use the 120px-derived small sizes.
    layers = [at(16), *(Image.open(icons / f"{s}x{s}.png").convert("RGBA") for s in SIZES)]
    big = icons / "icon.png"
    if big.exists():
        layers.append(Image.open(big).convert("RGBA").resize((256, 256), Image.Resampling.LANCZOS))
    write_ico(icons / "icon.ico", layers)
    print(f"rewrote {icons / 'icon.ico'} ({', '.join(str(im.width) for im in layers)}px)")


if __name__ == "__main__":
    main()
