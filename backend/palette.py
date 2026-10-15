"""Dominant colors for a thumbnail the browser cannot read itself."""

from __future__ import annotations

import io
from collections import Counter

from PIL import Image


def dominant_colors(raw: bytes, count: int = 5) -> list[dict]:
    image = Image.open(io.BytesIO(raw)).convert("RGB")
    image.thumbnail((48, 48))
    buckets: Counter[tuple[int, int, int]] = Counter()
    for red, green, blue in image.getdata():
        if red + green + blue < 24:
            continue
        key = (red // 24 * 24, green // 24 * 24, blue // 24 * 24)
        buckets[key] += 1
    colors = []
    for (red, green, blue), hits in buckets.most_common(count):
        colors.append({"r": red, "g": green, "b": blue, "weight": hits})
    return colors
