"""Regenerate the desktop + Android-notification icon set from static/*.png.

    python scripts/gen-icons.py

Outputs (all committed, so builds never need Python/PIL):
  electron/icons/icon.ico, icon.png       app / taskbar / window icon
  electron/icons/tray-<n>.png             white silhouette + black outline
  electron/icons/trayTemplate(@2x).png    macOS template (black silhouette)

Why hand-built sizes: downscaling the 1024px tile straight to 16-32px leaves a
tiny bubble floating in a big empty tile. Small sizes get a larger bubble (and
the ICO carries a real frame per size) so nothing is scaled by the OS.
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter, ImageDraw

RS = getattr(Image, "Resampling", Image).LANCZOS
ROOT = Path(__file__).resolve().parent.parent
FG = Image.open(ROOT / "static/favicon_foreground.png").convert("RGBA")
FG = FG.crop(FG.getchannel("A").getbbox())  # tight bubble silhouette, 1024x798
BASE = Image.open(ROOT / "static/favicon.png").convert("RGBA")
TILE = (173, 190, 239, 255)
SS = 1024  # supersample canvas edge


def tile_icon(n: int, bubble_frac: float) -> Image.Image:
    """Rounded periwinkle tile with the white bubble at bubble_frac of width."""
    tile = Image.new("RGBA", (SS, SS), (0, 0, 0, 0))
    mask = Image.new("L", (SS, SS), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, SS - 1, SS - 1), 170, fill=255)
    tile.paste(Image.new("RGBA", (SS, SS), TILE), (0, 0), mask)
    bw = round(SS * bubble_frac)
    bh = round(bw * FG.height / FG.width)
    bub = FG.resize((bw, bh), RS)
    # Optical centering: the tail hangs bottom-right, so nudge the body up-left.
    tile.alpha_composite(bub, ((SS - bw) // 2, (SS - bh) // 2))
    return tile.resize((n, n), RS)


def app_icon(n: int) -> Image.Image:
    if n >= 128:
        return BASE.resize((n, n), RS)
    frac = 0.86 if n <= 32 else 0.78 if n <= 48 else 0.72
    return tile_icon(n, frac)


def silhouette(n: int, outline_px: float, colour, outline_colour) -> Image.Image:
    """Bubble filling an n x n canvas, with an outline drawn inside the canvas."""
    k = 16  # supersample factor
    big = n * k
    pad = round(outline_px * k)
    inner = big - 2 * pad
    bh = round(inner * FG.height / FG.width)
    bub = FG.resize((inner, bh), RS)
    alpha = Image.new("L", (big, big), 0)
    alpha.paste(bub.getchannel("A"), (pad, (big - bh) // 2))
    grown = alpha.filter(ImageFilter.MaxFilter(2 * pad + 1)) if pad else alpha
    out = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    if outline_colour:
        out.paste(Image.new("RGBA", (big, big), outline_colour), (0, 0), grown)
    out.paste(Image.new("RGBA", (big, big), colour), (0, 0), alpha)
    return out.resize((n, n), RS)


def write_ico(path: Path, frames) -> None:
    """Pillow's ICO writer re-derives every size from the biggest frame, which
    throws away the hand-tuned small ones, so write the container ourselves:
    BMP/DIB entries below 256px (max compatibility), PNG at 256."""
    import io, struct
    blobs = []
    for im in frames:
        n = im.width
        if n >= 256:
            b = io.BytesIO()
            im.save(b, "PNG")
            blobs.append(b.getvalue())
            continue
        px = im.convert("RGBA")
        # DIB rows are bottom-up BGRA; height field counts XOR + AND masks.
        xor = b"".join(
            b"".join(bytes((bl, g, r, a)) for r, g, bl, a in
                     (px.getpixel((x, y)) for x in range(n)))
            for y in range(n - 1, -1, -1))
        and_row = ((n + 31) // 32) * 4
        hdr = struct.pack("<IiiHHIIiiII", 40, n, n * 2, 1, 32, 0, len(xor), 0, 0, 0, 0)
        blobs.append(hdr + xor + bytes(and_row * n))
    out = struct.pack("<HHH", 0, 1, len(frames))
    off = 6 + 16 * len(frames)
    for im, blob in zip(frames, blobs):
        n = im.width
        out += struct.pack("<BBBBHHII", n % 256, n % 256, 0, 0, 1, 32, len(blob), off)
        off += len(blob)
    path.write_bytes(out + b"".join(blobs))


def main():
    icons = ROOT / "electron/icons"
    sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256]
    frames = [app_icon(n) for n in sizes]
    write_ico(icons / "icon.ico", frames)
    app_icon(512).save(icons / "icon.png")
    for n in (16, 24, 32, 48, 64):
        silhouette(n, max(1, n / 16), (255, 255, 255, 255), (0, 0, 0, 255)).save(icons / f"tray-{n}.png")
    silhouette(16, 0, (0, 0, 0, 255), None).save(icons / "trayTemplate.png")
    silhouette(32, 0, (0, 0, 0, 255), None).save(icons / "trayTemplate@2x.png")


main()
