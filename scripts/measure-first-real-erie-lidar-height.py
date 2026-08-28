#!/usr/bin/env python3
"""Measure a reproducible LiDAR roof-above-ground proxy for the first real Erie parcel.

This script is intentionally an ingestion/verification tool, not an on-request web path. It
requires the source-backed Voxel Vault evidence export, downloads the exact authoritative LAS
tile, hashes it, and derives a robust roof-minus-ground measurement against the official
building footprint. It fails closed when point density, CRS, classification, or uncertainty is
not good enough.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import tempfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import laspy
import numpy as np
from pyproj import CRS, Transformer
from shapely import contains_xy
from shapely.geometry import shape
from shapely.ops import transform as transform_geometry

ALGORITHM_VERSION = "nys-las-roof-p95-minus-ground-median-v1"
GROUND_CLASS = 2
BUILDING_CLASS = 6
EXCLUDED_CLASSES = {2, 7, 18}
GROUND_OUTER_BUFFER_METERS = 20.0
GROUND_INNER_BUFFER_METERS = 1.0
MIN_GROUND_POINTS = 50
MIN_ROOF_POINTS = 100
MIN_HEIGHT_METERS = 2.0
MAX_HEIGHT_METERS = 120.0
MAX_UNCERTAINTY_METERS = 3.0


def fail(message: str) -> None:
    raise RuntimeError(message)


def read_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        fail("Evidence input must be a JSON object.")
    return payload


def download_and_hash(url: str, destination: Path) -> tuple[str, int]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "VoxelVault-Spatial-Evidence/1.0",
            "Accept": "application/octet-stream,*/*;q=0.8",
        },
    )
    digest = hashlib.sha256()
    byte_count = 0
    with urllib.request.urlopen(request, timeout=90) as response, destination.open("wb") as output:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            output.write(chunk)
            digest.update(chunk)
            byte_count += len(chunk)
    if byte_count < 1024:
        fail(f"Downloaded LAS file is implausibly small ({byte_count} bytes).")
    return digest.hexdigest(), byte_count


def unit_factor_to_meters(crs: CRS) -> tuple[float, float, str, str]:
    axes = list(crs.axis_info or [])
    if not axes:
        fail("LAS CRS exposes no axis units; measurement cannot be normalized to meters.")

    horizontal = next((axis for axis in axes if axis.direction.lower() in {"east", "west"}), axes[0])
    horizontal_factor = float(horizontal.unit_conversion_factor or 0)
    if not math.isfinite(horizontal_factor) or horizontal_factor <= 0:
        fail("LAS horizontal CRS unit has no valid conversion to meters.")

    vertical = next((axis for axis in axes if axis.direction.lower() in {"up", "down"}), None)
    # Many LAS files carry only a horizontal projected CRS even though Z uses the same native
    # linear unit. When no explicit vertical axis exists, use the projected horizontal unit but
    # record that fallback explicitly in the evidence artifact.
    vertical_factor = float(vertical.unit_conversion_factor) if vertical and vertical.unit_conversion_factor else horizontal_factor
    if not math.isfinite(vertical_factor) or vertical_factor <= 0:
        fail("LAS vertical unit has no valid conversion to meters.")

    return (
        horizontal_factor,
        vertical_factor,
        str(horizontal.unit_name or "unknown"),
        str(vertical.unit_name if vertical else horizontal.unit_name or "unknown"),
    )


def concatenate(parts: list[np.ndarray]) -> np.ndarray:
    if not parts:
        return np.empty(0, dtype=np.float64)
    return np.concatenate(parts).astype(np.float64, copy=False)


def percentile(values: np.ndarray, q: float) -> float:
    return float(np.percentile(values, q))


def robust_mad(values: np.ndarray, center: float) -> float:
    return float(np.median(np.abs(values - center)) * 1.4826)


def measure(evidence: dict, las_path: Path, las_sha256: str, las_bytes: int) -> dict:
    lidar = evidence.get("lidar") or {}
    tile = lidar.get("tile") or {}
    building = evidence.get("building") or {}
    geometry_wgs84 = building.get("geometryWgs84")
    if not geometry_wgs84:
        fail("Evidence input has no official building footprint geometry.")

    footprint_wgs84 = shape(geometry_wgs84)
    if footprint_wgs84.is_empty or not footprint_wgs84.is_valid:
        fail("Official building footprint is empty or invalid.")
    if footprint_wgs84.geom_type not in {"Polygon", "MultiPolygon"}:
        fail(f"Unsupported building geometry type: {footprint_wgs84.geom_type}.")

    with laspy.open(las_path) as reader:
        las_crs = reader.header.parse_crs()
        if las_crs is None:
            fail("LAS header has no parseable CRS; height measurement is blocked.")
        las_crs = CRS.from_user_input(las_crs)
        horizontal_to_meters, vertical_to_meters, horizontal_unit, vertical_unit = unit_factor_to_meters(las_crs)
        meters_to_horizontal = 1.0 / horizontal_to_meters

        transformer = Transformer.from_crs("EPSG:4326", las_crs, always_xy=True)
        footprint = transform_geometry(transformer.transform, footprint_wgs84)
        if footprint.is_empty or not footprint.is_valid:
            fail("Building footprint could not be transformed into the LAS CRS.")

        ground_zone = footprint.buffer(GROUND_OUTER_BUFFER_METERS * meters_to_horizontal).difference(
            footprint.buffer(GROUND_INNER_BUFFER_METERS * meters_to_horizontal)
        )
        minx, miny, maxx, maxy = ground_zone.bounds

        ground_parts: list[np.ndarray] = []
        class6_roof_parts: list[np.ndarray] = []
        fallback_roof_parts: list[np.ndarray] = []
        scanned_points = 0
        nearby_points = 0
        inside_points = 0

        for points in reader.chunk_iterator(1_000_000):
            scanned_points += len(points)
            x_all = np.asarray(points.x, dtype=np.float64)
            y_all = np.asarray(points.y, dtype=np.float64)
            bbox_mask = (x_all >= minx) & (x_all <= maxx) & (y_all >= miny) & (y_all <= maxy)
            if not np.any(bbox_mask):
                continue

            x = x_all[bbox_mask]
            y = y_all[bbox_mask]
            z = np.asarray(points.z, dtype=np.float64)[bbox_mask]
            classification = np.asarray(points.classification, dtype=np.uint8)[bbox_mask]
            nearby_points += len(x)

            inside = np.asarray(contains_xy(footprint, x, y), dtype=bool)
            in_ground_zone = np.asarray(contains_xy(ground_zone, x, y), dtype=bool)
            inside_points += int(np.count_nonzero(inside))

            ground_mask = in_ground_zone & (classification == GROUND_CLASS)
            if np.any(ground_mask):
                ground_parts.append(z[ground_mask])

            building_mask = inside & (classification == BUILDING_CLASS)
            if np.any(building_mask):
                class6_roof_parts.append(z[building_mask])

            try:
                return_number = np.asarray(points.return_number, dtype=np.uint8)[bbox_mask]
                first_return = return_number == 1
            except Exception:
                first_return = np.ones(len(x), dtype=bool)

            excluded = np.isin(classification, list(EXCLUDED_CLASSES))
            fallback_mask = inside & first_return & ~excluded
            if np.any(fallback_mask):
                fallback_roof_parts.append(z[fallback_mask])

    ground_native = concatenate(ground_parts)
    class6_native = concatenate(class6_roof_parts)
    fallback_native = concatenate(fallback_roof_parts)

    if len(ground_native) < MIN_GROUND_POINTS:
        fail(f"Insufficient class-2 ground returns around footprint: {len(ground_native)} < {MIN_GROUND_POINTS}.")

    ground_median_native = percentile(ground_native, 50)
    ground_p05_native = percentile(ground_native, 5)
    ground_p95_native = percentile(ground_native, 95)

    roof_method = "classification_6_building"
    roof_native = class6_native
    if len(roof_native) < MIN_ROOF_POINTS:
        roof_method = "first_return_non_ground_fallback"
        roof_native = fallback_native

    # Remove returns that are effectively at ground level and physically implausible outliers.
    min_roof_native = ground_median_native + MIN_HEIGHT_METERS / vertical_to_meters
    max_roof_native = ground_median_native + MAX_HEIGHT_METERS / vertical_to_meters
    roof_native = roof_native[(roof_native >= min_roof_native) & (roof_native <= max_roof_native)]
    if len(roof_native) < MIN_ROOF_POINTS:
        fail(f"Insufficient usable roof returns after filtering: {len(roof_native)} < {MIN_ROOF_POINTS}.")

    roof_p50_native = percentile(roof_native, 50)
    roof_p90_native = percentile(roof_native, 90)
    roof_p925_native = percentile(roof_native, 92.5)
    roof_p95_native = percentile(roof_native, 95)
    roof_p975_native = percentile(roof_native, 97.5)
    roof_p99_native = percentile(roof_native, 99)

    height_meters = (roof_p95_native - ground_median_native) * vertical_to_meters
    ground_mad_meters = robust_mad(ground_native, ground_median_native) * vertical_to_meters
    roof_top_band_meters = (roof_p975_native - roof_p925_native) * vertical_to_meters
    uncertainty_meters = max(0.15, ground_mad_meters, roof_top_band_meters / 2.0)

    quality_checks = {
        "groundPointCount": len(ground_native) >= MIN_GROUND_POINTS,
        "roofPointCount": len(roof_native) >= MIN_ROOF_POINTS,
        "heightRange": MIN_HEIGHT_METERS <= height_meters <= MAX_HEIGHT_METERS,
        "uncertainty": uncertainty_meters <= MAX_UNCERTAINTY_METERS,
        "authoritativeFootprint": bool(building.get("source", {}).get("sourceUrl")),
        "authoritativeLasTile": bool(tile.get("directDownloadUrl") and tile.get("filename")),
    }
    quality_gate_passed = all(quality_checks.values())

    result = {
        "schemaVersion": 1,
        "algorithm": {
            "id": ALGORITHM_VERSION,
            "definition": "95th percentile of usable roof returns inside the official footprint minus median class-2 ground returns in a 1-20 meter exterior annulus",
            "roofCandidateMethod": roof_method,
            "groundClass": GROUND_CLASS,
            "buildingClassPreferred": BUILDING_CLASS,
            "groundOuterBufferMeters": GROUND_OUTER_BUFFER_METERS,
            "groundInnerBufferMeters": GROUND_INNER_BUFFER_METERS,
        },
        "property": evidence.get("property"),
        "measurement": {
            "status": "measured" if quality_gate_passed else "rejected",
            "heightMeters": round(height_meters, 3) if quality_gate_passed else None,
            "heightDefinition": "LiDAR-derived roof-above-ground proxy; not a legal survey or certified structural height",
            "uncertaintyMeters": round(uncertainty_meters, 3),
            "qualityGatePassed": quality_gate_passed,
            "qualityChecks": quality_checks,
            "measuredAt": datetime.now(timezone.utc).isoformat(),
        },
        "statistics": {
            "scannedLasPoints": scanned_points,
            "nearbyPoints": nearby_points,
            "insideFootprintPoints": inside_points,
            "groundPointCount": int(len(ground_native)),
            "preferredBuildingClassPointCount": int(len(class6_native)),
            "fallbackRoofPointCount": int(len(fallback_native)),
            "usableRoofPointCount": int(len(roof_native)),
            "groundElevationMedianNative": ground_median_native,
            "groundElevationP05Native": ground_p05_native,
            "groundElevationP95Native": ground_p95_native,
            "roofElevationP50Native": roof_p50_native,
            "roofElevationP90Native": roof_p90_native,
            "roofElevationP95Native": roof_p95_native,
            "roofElevationP99Native": roof_p99_native,
            "groundMadMeters": round(ground_mad_meters, 4),
            "roofTopBandMeters": round(roof_top_band_meters, 4),
        },
        "crs": {
            "lasCrs": las_crs.to_string(),
            "lasCrsWkt": las_crs.to_wkt(),
            "horizontalUnit": horizontal_unit,
            "verticalUnit": vertical_unit,
            "horizontalUnitToMeters": horizontal_to_meters,
            "verticalUnitToMeters": vertical_to_meters,
        },
        "sources": {
            "buildingFootprint": building.get("source"),
            "parcel": (evidence.get("parcel") or {}).get("source"),
            "lidarIndex": lidar.get("source"),
            "lidarQueryUrl": lidar.get("queryUrl"),
            "lasTile": {
                "objectId": tile.get("objectId"),
                "filename": tile.get("filename"),
                "directDownloadUrl": tile.get("directDownloadUrl"),
                "declaredSizeGb": tile.get("sizeGb"),
                "downloadedBytes": las_bytes,
                "sha256": las_sha256,
            },
        },
        "legalEffects": {
            "isLegalSurvey": False,
            "establishesDeedOwnership": False,
            "establishesTitle": False,
            "createsInvestmentRights": False,
            "createsBlockchainRights": False,
        },
    }

    if not quality_gate_passed:
        fail(f"LiDAR measurement failed quality gate: {json.dumps(quality_checks, sort_keys=True)}")
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path, help="JSON evidence exported by export-first-real-erie-lidar-evidence.mjs")
    parser.add_argument("--output", required=True, type=Path, help="Path for the derived measurement JSON")
    parser.add_argument("--las", type=Path, help="Optional already-downloaded LAS file for reproducibility tests")
    args = parser.parse_args()

    evidence = read_json(args.input)
    tile = (evidence.get("lidar") or {}).get("tile") or {}
    url = str(tile.get("directDownloadUrl") or "").strip()
    if not url.lower().startswith("https://gisdata.ny.gov/"):
        fail("LAS download must use the authoritative https://gisdata.ny.gov/ source.")

    if args.las:
        las_path = args.las
        digest = hashlib.sha256(las_path.read_bytes()).hexdigest()
        byte_count = las_path.stat().st_size
        result = measure(evidence, las_path, digest, byte_count)
    else:
        with tempfile.TemporaryDirectory(prefix="voxel-vault-lidar-") as temp_dir:
            las_path = Path(temp_dir) / str(tile.get("filename") or "source.las")
            digest, byte_count = download_and_hash(url, las_path)
            result = measure(evidence, las_path, digest, byte_count)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
