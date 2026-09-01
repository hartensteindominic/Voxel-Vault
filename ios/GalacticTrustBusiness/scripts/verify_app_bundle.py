#!/usr/bin/env python3
"""Fail a build before upload when required iOS bundle resources are missing."""

from __future__ import annotations

import argparse
import plistlib
import struct
from pathlib import Path


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
REQUIRED_APP_STORE_ICON_SIZES = {(120, 120), (152, 152)}


def png_dimensions(path: Path) -> tuple[int, int] | None:
    with path.open("rb") as handle:
        header = handle.read(24)
    if len(header) < 24 or header[:8] != PNG_SIGNATURE or header[12:16] != b"IHDR":
        return None
    return struct.unpack(">II", header[16:24])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("app_path", type=Path)
    parser.add_argument(
        "--require-device-icons",
        action="store_true",
        help="Require the 120x120 iPhone and 152x152 iPad icon PNGs used by App Store validation.",
    )
    args = parser.parse_args()

    app_path = args.app_path.resolve()
    if not app_path.is_dir():
        raise SystemExit(f"App bundle does not exist: {app_path}")

    info_path = app_path / "Info.plist"
    if not info_path.is_file():
        raise SystemExit(f"App bundle is missing Info.plist: {info_path}")

    with info_path.open("rb") as handle:
        info = plistlib.load(handle)

    icon_name = info.get("CFBundleIconName")
    if icon_name != "AppIcon":
        raise SystemExit(
            f"CFBundleIconName must be 'AppIcon' in the built bundle; got {icon_name!r}"
        )

    assets_path = app_path / "Assets.car"
    if not assets_path.is_file() or assets_path.stat().st_size == 0:
        raise SystemExit(
            "Built bundle is missing Assets.car. The asset catalog is not in the target's Resources phase."
        )

    privacy_path = app_path / "PrivacyInfo.xcprivacy"
    if not privacy_path.is_file() or privacy_path.stat().st_size == 0:
        raise SystemExit(
            "Built bundle is missing PrivacyInfo.xcprivacy. The privacy manifest is not in the target's Resources phase."
        )

    icon_sizes: dict[tuple[int, int], list[str]] = {}
    for png_path in sorted(app_path.glob("*.png")):
        dimensions = png_dimensions(png_path)
        if dimensions is not None:
            icon_sizes.setdefault(dimensions, []).append(png_path.name)

    if args.require_device_icons:
        missing = REQUIRED_APP_STORE_ICON_SIZES.difference(icon_sizes)
        if missing:
            available = ", ".join(
                f"{width}x{height}" for width, height in sorted(icon_sizes)
            ) or "none"
            required = ", ".join(
                f"{width}x{height}" for width, height in sorted(missing)
            )
            raise SystemExit(
                f"Built bundle is missing required App Store icon size(s): {required}. "
                f"Bundle PNG sizes: {available}"
            )

    print(f"Verified app bundle: {app_path}")
    print("CFBundleIconName: AppIcon")
    print(f"Asset catalog: {assets_path.name} ({assets_path.stat().st_size} bytes)")
    print(f"Privacy manifest: {privacy_path.name}")
    if icon_sizes:
        for dimensions, names in sorted(icon_sizes.items()):
            print(f"PNG {dimensions[0]}x{dimensions[1]}: {', '.join(names)}")


if __name__ == "__main__":
    main()
