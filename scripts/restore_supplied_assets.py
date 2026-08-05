from __future__ import annotations

import base64
import io
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets-source"
ASSETS = ROOT / "assets"


def read_base64(primary: str, pattern: str) -> bytes:
    primary_path = SOURCE / primary
    if primary_path.exists():
        encoded = primary_path.read_text(encoding="utf-8")
    else:
        parts = sorted(SOURCE.glob(pattern))
        if not parts:
            raise FileNotFoundError(f"Aucune source trouvée pour {primary} / {pattern}")
        encoded = "".join(part.read_text(encoding="utf-8") for part in parts)

    encoded = "".join(encoded.split())
    data = base64.b64decode(encoded, validate=True)
    if len(data) < 4096:
        raise ValueError(f"Image encodée trop petite : {primary}")
    return data


def open_image(data: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(data))
    image.load()
    return image.convert("RGB")


def save_icon(source: Image.Image) -> None:
    icon = ImageOps.fit(source, (1024, 1024), method=Image.Resampling.LANCZOS)
    icon = ImageEnhance.Sharpness(icon).enhance(1.05)
    icon.save(ASSETS / "icon-only.jpg", quality=94, optimize=True, progressive=True)


def save_splashes(source: Image.Image) -> None:
    # Version verticale exacte utilisée par l'écran de lancement du jeu.
    vertical = ImageOps.fit(source, (1080, 1920), method=Image.Resampling.LANCZOS)
    vertical.save(ASSETS / "splash-web.jpg", quality=94, optimize=True, progressive=True)

    # Source carrée exigée par @capacitor/assets pour le splash Android natif.
    background = ImageOps.fit(source, (2732, 2732), method=Image.Resampling.LANCZOS)
    background = background.filter(ImageFilter.GaussianBlur(42))
    background = ImageEnhance.Brightness(background).enhance(0.62)

    foreground = ImageOps.contain(source, (1537, 2732), method=Image.Resampling.LANCZOS)
    x = (2732 - foreground.width) // 2
    y = (2732 - foreground.height) // 2
    background.paste(foreground, (x, y))
    background.save(ASSETS / "splash.jpg", quality=93, optimize=True, progressive=True)


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)

    icon_data = read_base64("icon.b64", "icon-*.b64")
    splash_data = read_base64("splash.b64", "splash-*.b64")

    save_icon(open_image(icon_data))
    save_splashes(open_image(splash_data))

    print("Vraie icône et vrai splash TikoWikoBakery restaurés.")


if __name__ == "__main__":
    main()
