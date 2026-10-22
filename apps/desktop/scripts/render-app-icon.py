"""Turn the mascot-512 capture into a 1024 transparent app-icon.png (no background field)."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

from icon_key import key_background

SIZE = 1024
MARGIN = 0.07


def transparent_icon(src: Image.Image, out_size: int) -> Image.Image:
    figure = key_background(src, MARGIN)
    return figure.resize((out_size, out_size), Image.Resampling.LANCZOS)


def main() -> None:
    master_path = Path(sys.argv[1])
    out_icon = Path(sys.argv[2])
    transparent_icon(Image.open(master_path), SIZE).save(out_icon, "PNG", optimize=True)
    print(f"wrote {out_icon} ({SIZE}x{SIZE})")


if __name__ == "__main__":
    main()
