#!/usr/bin/env python3
"""Generate branded icon assets from a single definition.

The design intentionally matches the provided Umami reference: a bold U with
wavy cutouts and a soft gray backdrop. All sizes are derived from the requested
canvas size so the proportions stay consistent across platforms.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Iterable, Tuple

from PIL import Image, ImageChops, ImageDraw

Color = Tuple[int, int, int, int]

# Core palette tuned to the provided reference image.
PRIMARY: Color = (58, 84, 96, 255)
BACKGROUND: Color = (236, 238, 239, 255)


def build_logo(
    size: int,
    *,
    primary: Color = PRIMARY,
    background: Color = BACKGROUND,
    include_background: bool = True,
) -> Image.Image:
    """Create the U mark with wave cutouts."""

    canvas_color = background if include_background else (0, 0, 0, 0)
    image = Image.new("RGBA", (size, size), canvas_color)

    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)

    center_x = size / 2
    top = int(size * 0.15)
    bar_bottom = int(size * 0.62)
    bar_width = int(size * 0.195)
    gap = int(size * 0.22)
    padding = int(size * 0.088)
    radius = int(size * 0.186)

    # Make sure the bottom arc fits inside the canvas.
    arc_bottom = bar_bottom + 2 * radius
    if arc_bottom > size:
        overflow = arc_bottom - size
        radius = max(radius - math.ceil(overflow / 2), padding + 4)
        arc_bottom = bar_bottom + 2 * radius

    left_x1 = int(center_x - gap / 2 - bar_width)
    left_x2 = int(center_x - gap / 2)
    right_x1 = int(center_x + gap / 2)
    right_x2 = int(center_x + gap / 2 + bar_width)

    # Outer U shape (two pillars + rounded base).
    draw.rectangle([left_x1, top, left_x2, bar_bottom], fill=255)
    draw.rectangle([right_x1, top, right_x2, bar_bottom], fill=255)
    draw.pieslice([left_x1, bar_bottom, right_x2, arc_bottom], 180, 360, fill=255)

    # Inner cutout to define stroke weight.
    inner = Image.new("L", (size, size), 0)
    inner_draw = ImageDraw.Draw(inner)
    inner_left_x1 = left_x1 + padding
    inner_left_x2 = left_x2 - padding
    inner_right_x1 = right_x1 + padding
    inner_right_x2 = right_x2 - padding
    inner_top = top + padding
    inner_bar_bottom = bar_bottom + padding
    inner_radius = max(radius - padding, 8)
    inner_arc_bottom = inner_bar_bottom + 2 * inner_radius

    inner_draw.rectangle([inner_left_x1, inner_top, inner_left_x2, inner_bar_bottom], fill=255)
    inner_draw.rectangle([inner_right_x1, inner_top, inner_right_x2, inner_bar_bottom], fill=255)
    inner_draw.pieslice(
        [inner_left_x1, inner_bar_bottom, inner_right_x2, inner_arc_bottom], 180, 360, fill=255
    )

    mask = ImageChops.subtract(mask, inner)

    # Wavy cutouts that mirror the reference lines.
    wave_mask = Image.new("L", (size, size), 0)
    wave_draw = ImageDraw.Draw(wave_mask)
    start_x = left_x1 + padding * 0.65
    end_x = right_x2 - padding * 0.35
    base_y = bar_bottom + radius * 0.28
    rise = size * 0.14
    amplitudes: Iterable[float] = (
        size * 0.020,
        size * 0.024,
        size * 0.028,
        size * 0.032,
    )
    stroke_width = max(int(size * 0.028), 6)

    for idx, amplitude in enumerate(amplitudes):
        points = []
        for step in range(18):
            t = step / 17
            x = start_x + (end_x - start_x) * t
            y = base_y + idx * (padding * 0.22) + amplitude * math.sin(
                2 * math.pi * (t + idx * 0.06)
            )
            y -= t * rise
            points.append((x, y))
        wave_draw.line(points, fill=255, width=stroke_width, joint="curve")

    wave_mask = ImageChops.multiply(wave_mask, mask)
    mask = ImageChops.subtract(mask, wave_mask)

    image.paste(primary, mask=mask)
    return image


def solid_background(size: int, color: Color = BACKGROUND) -> Image.Image:
    """Helper for adaptive icon background assets."""
    return Image.new("RGBA", (size, size), color)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    images_dir = root / "assets" / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    outputs = {
        "icon.png": build_logo(1024),
        "splash-icon.png": build_logo(1024),
        "favicon.png": build_logo(48),
        "android-icon-foreground.png": build_logo(512, include_background=False),
        "android-icon-monochrome.png": build_logo(432, include_background=False, primary=(0, 0, 0, 255)),
        "android-icon-background.png": solid_background(512),
    }

    for name, image in outputs.items():
        destination = images_dir / name
        image.save(destination)
        print(f"wrote {destination} ({image.size[0]}x{image.size[1]})")


if __name__ == "__main__":
    main()
