from __future__ import annotations

import base64
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets-source"
ASSETS = ROOT / "assets"


def decode_parts(pattern: str, output: Path) -> None:
    parts = sorted(SOURCE.glob(pattern))
    if not parts:
        raise FileNotFoundError(f"Aucune partie trouvée pour {pattern}")
    encoded = "".join(part.read_text(encoding="utf-8").strip() for part in parts)
    output.write_bytes(base64.b64decode(encoded, validate=True))


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    icon_path = ASSETS / "icon-only.jpg"
    splash_web_path = ASSETS / "splash-web.jpg"

    decode_parts("final-icon-*.b64", icon_path)
    decode_parts("final-splash-*.b64", splash_web_path)

    with Image.open(icon_path) as icon:
        icon.verify()

    with Image.open(splash_web_path) as source:
        source = source.convert("RGB")
        background = ImageOps.fit(source, (2732, 2732), method=Image.Resampling.LANCZOS)
        background = background.filter(ImageFilter.GaussianBlur(52))
        background = ImageEnhance.Brightness(background).enhance(0.66)
        foreground = ImageOps.contain(source, (1537, 2732), method=Image.Resampling.LANCZOS)
        x = (2732 - foreground.width) // 2
        y = (2732 - foreground.height) // 2
        background.paste(foreground, (x, y))
        background.save(ASSETS / "splash.jpg", quality=94, optimize=True, progressive=True)

    print("Nouvelle icône et nouveau splash TikoWikoBakery préparés.")


if __name__ == "__main__":
    main()
