#!/usr/bin/env python3
import math
import os
import struct
import zlib

SIZE = 1024
OUT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "GalacticTrustBusiness",
    "Assets.xcassets",
    "AppIcon.appiconset",
    "AppIcon.png",
)


def clamp(value, low=0, high=255):
    return max(low, min(high, int(value)))


def mix(a, b, t):
    return tuple(clamp(a[i] * (1 - t) + b[i] * t) for i in range(3))


def ellipse_ring(x, y, cx, cy, rx, ry, angle, width):
    ca = math.cos(angle)
    sa = math.sin(angle)
    dx = x - cx
    dy = y - cy
    xr = dx * ca + dy * sa
    yr = -dx * sa + dy * ca
    outer = (xr / rx) ** 2 + (yr / ry) ** 2
    inner_rx = max(1, rx - width)
    inner_ry = max(1, ry - width * 0.42)
    inner = (xr / inner_rx) ** 2 + (yr / inner_ry) ** 2
    return outer <= 1.0 and inner >= 1.0


def star_strength(x, y, sx, sy, radius):
    dx = abs(x - sx)
    dy = abs(y - sy)
    if dx <= radius and dy <= radius:
        radial = math.sqrt(dx * dx + dy * dy)
        core = max(0.0, 1.0 - radial / max(1.0, radius))
        cross = max(0.0, 1.0 - min(dx, dy) / max(1.0, radius * 0.26))
        return max(core, cross * 0.55)
    return 0.0


def pixel(x, y):
    # Deep navy -> electric indigo background.
    t = (x + y) / (2 * (SIZE - 1))
    base = mix((5, 11, 55), (35, 12, 128), t)

    # Soft upper-left glow.
    glow_d = math.hypot(x - 205, y - 180)
    if glow_d < 430:
        glow = (1 - glow_d / 430) * 0.32
        base = mix(base, (25, 93, 255), glow)

    cx, cy = 520, 505
    px = x - cx
    py = y - cy
    r = math.hypot(px, py)

    # Saturn-style ring behind the planet.
    if ellipse_ring(x, y, cx, cy + 25, 365, 120, math.radians(-20), 34):
        ring_t = (x / SIZE) * 0.72 + 0.14
        ring_color = mix((44, 221, 255), (246, 68, 255), ring_t)
        base = mix(base, ring_color, 0.92)

    # Main planet with cyan-to-violet shading and highlight.
    if r <= 255:
        nx = px / 255
        ny = py / 255
        light = max(0.0, 1.0 - math.hypot(nx + 0.45, ny + 0.52))
        shade = min(1.0, max(0.0, (nx + ny + 1.5) / 3.0))
        planet = mix((47, 225, 255), (111, 43, 246), shade)
        planet = mix(planet, (255, 255, 255), light * 0.48)
        edge = min(1.0, max(0.0, (r - 218) / 37))
        planet = mix(planet, (31, 20, 130), edge * 0.52)
        base = planet

    # Ring highlight in front of lower portion of planet.
    if y > cy and ellipse_ring(x, y, cx, cy + 25, 365, 120, math.radians(-20), 24):
        base = mix(base, (239, 80, 255), 0.93)

    # Small moon.
    moon_d = math.hypot(x - 754, y - 326)
    if moon_d <= 55:
        mt = moon_d / 55
        base = mix((201, 246, 255), (105, 62, 245), mt)

    # Tiny stars.
    stars = [
        (150, 185, 10), (818, 158, 8), (836, 768, 9), (188, 786, 7),
        (720, 208, 5), (288, 282, 5), (330, 768, 5), (868, 454, 6),
        (126, 530, 5), (660, 830, 6),
    ]
    strength = 0.0
    for sx, sy, sr in stars:
        strength = max(strength, star_strength(x, y, sx, sy, sr))
    if strength > 0:
        base = mix(base, (255, 255, 255), min(1.0, strength))

    return base


def write_png(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    raw = bytearray()
    for y in range(SIZE):
        raw.append(0)  # PNG filter: None
        for x in range(SIZE):
            raw.extend(pixel(x, y))

    def chunk(kind, data):
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    png = bytearray(b"\x89PNG\r\n\x1a\n")
    png.extend(chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 2, 0, 0, 0)))
    png.extend(chunk(b"IDAT", zlib.compress(bytes(raw), 9)))
    png.extend(chunk(b"IEND", b""))
    with open(path, "wb") as handle:
        handle.write(png)
    print(f"Generated {path}")


if __name__ == "__main__":
    write_png(OUT)
