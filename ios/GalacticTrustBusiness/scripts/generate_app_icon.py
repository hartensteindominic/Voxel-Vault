#!/usr/bin/env python3
import math
import os
import struct
import zlib

MASTER_SIZE = 1024
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "GalacticTrustBusiness", "Assets.xcassets", "AppIcon.appiconset")

ICONS = {
    "AppIcon-20@1x-ipad.png": 20,
    "AppIcon-20@2x.png": 40,
    "AppIcon-20@3x.png": 60,
    "AppIcon-20@2x-ipad.png": 40,
    "AppIcon-29@1x-ipad.png": 29,
    "AppIcon-29@2x.png": 58,
    "AppIcon-29@3x.png": 87,
    "AppIcon-29@2x-ipad.png": 58,
    "AppIcon-40@1x-ipad.png": 40,
    "AppIcon-40@2x.png": 80,
    "AppIcon-40@3x.png": 120,
    "AppIcon-40@2x-ipad.png": 80,
    "AppIcon-60@2x.png": 120,
    "AppIcon-60@3x.png": 180,
    "AppIcon-76@1x.png": 76,
    "AppIcon-76@2x.png": 152,
    "AppIcon-83.5@2x.png": 167,
    "AppIcon-1024.png": 1024,
}


def clamp(value, low=0, high=255):
    return max(low, min(high, int(value)))


def mix(a, b, t):
    return tuple(clamp(a[i] * (1 - t) + b[i] * t) for i in range(3))


def ellipse_ring(x, y, cx, cy, rx, ry, angle, width):
    ca, sa = math.cos(angle), math.sin(angle)
    dx, dy = x - cx, y - cy
    xr, yr = dx * ca + dy * sa, -dx * sa + dy * ca
    outer = (xr / rx) ** 2 + (yr / ry) ** 2
    inner_rx, inner_ry = max(1, rx - width), max(1, ry - width * 0.42)
    inner = (xr / inner_rx) ** 2 + (yr / inner_ry) ** 2
    return outer <= 1.0 and inner >= 1.0


def star_strength(x, y, sx, sy, radius):
    dx, dy = abs(x - sx), abs(y - sy)
    if dx <= radius and dy <= radius:
        radial = math.sqrt(dx * dx + dy * dy)
        core = max(0.0, 1.0 - radial / max(1.0, radius))
        cross = max(0.0, 1.0 - min(dx, dy) / max(1.0, radius * 0.26))
        return max(core, cross * 0.55)
    return 0.0


def master_pixel(x, y):
    size = MASTER_SIZE
    t = (x + y) / (2 * (size - 1))
    base = mix((5, 11, 55), (35, 12, 128), t)
    glow_d = math.hypot(x - 205, y - 180)
    if glow_d < 430:
        base = mix(base, (25, 93, 255), (1 - glow_d / 430) * 0.32)
    cx, cy = 520, 505
    px, py = x - cx, y - cy
    r = math.hypot(px, py)
    if ellipse_ring(x, y, cx, cy + 25, 365, 120, math.radians(-20), 34):
        base = mix(base, mix((44, 221, 255), (246, 68, 255), (x / size) * 0.72 + 0.14), 0.92)
    if r <= 255:
        nx, ny = px / 255, py / 255
        light = max(0.0, 1.0 - math.hypot(nx + 0.45, ny + 0.52))
        shade = min(1.0, max(0.0, (nx + ny + 1.5) / 3.0))
        planet = mix((47, 225, 255), (111, 43, 246), shade)
        planet = mix(planet, (255, 255, 255), light * 0.48)
        planet = mix(planet, (31, 20, 130), min(1.0, max(0.0, (r - 218) / 37)) * 0.52)
        base = planet
    if y > cy and ellipse_ring(x, y, cx, cy + 25, 365, 120, math.radians(-20), 24):
        base = mix(base, (239, 80, 255), 0.93)
    moon_d = math.hypot(x - 754, y - 326)
    if moon_d <= 55:
        base = mix((201, 246, 255), (105, 62, 245), moon_d / 55)
    stars = [(150,185,10),(818,158,8),(836,768,9),(188,786,7),(720,208,5),(288,282,5),(330,768,5),(868,454,6),(126,530,5),(660,830,6)]
    strength = max(star_strength(x, y, sx, sy, sr) for sx, sy, sr in stars)
    if strength > 0:
        base = mix(base, (255, 255, 255), min(1.0, strength))
    return base


def write_png(path, size):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        my = min(MASTER_SIZE - 1, int((y + 0.5) * MASTER_SIZE / size))
        for x in range(size):
            mx = min(MASTER_SIZE - 1, int((x + 0.5) * MASTER_SIZE / size))
            raw.extend(master_pixel(mx, my))
    def chunk(kind, data):
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)
    png = bytearray(b"\x89PNG\r\n\x1a\n")
    png.extend(chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)))
    png.extend(chunk(b"IDAT", zlib.compress(bytes(raw), 9)))
    png.extend(chunk(b"IEND", b""))
    with open(path, "wb") as handle:
        handle.write(png)


if __name__ == "__main__":
    for filename, size in ICONS.items():
        write_png(os.path.join(OUT_DIR, filename), size)
        print(f"Generated {filename} ({size}x{size})")
