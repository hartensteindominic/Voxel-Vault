#!/usr/bin/env python3
"""Check that the County BUILDING polygon is physically plausible for the 618 Main parcel.

This is an evidence diagnostic, not a legal survey. It deliberately checks overlap/scale before
any LiDAR height can be trusted, because an ArcGIS `intersects` fallback can return a footprint
that merely touches a parcel in a dense downtown block.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform as transform_geometry

LOCAL_METRIC_CRS = "EPSG:32617"  # WGS84 / UTM zone 17N; suitable for Buffalo scale diagnostics.


def load(path: Path) -> dict:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise RuntimeError("Evidence input must be an object.")
    return payload


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    args = parser.parse_args()

    evidence = load(args.input)
    building_geo = (evidence.get("building") or {}).get("geometryWgs84")
    parcel_geo = (evidence.get("parcel") or {}).get("geometryWgs84")
    if not building_geo or not parcel_geo:
        raise RuntimeError("Parcel and building geometry are required.")

    building = shape(building_geo)
    parcel = shape(parcel_geo)
    transformer = Transformer.from_crs("EPSG:4326", LOCAL_METRIC_CRS, always_xy=True)
    building_m = transform_geometry(transformer.transform, building)
    parcel_m = transform_geometry(transformer.transform, parcel)

    intersection = building_m.intersection(parcel_m)
    building_area = float(building_m.area)
    parcel_area = float(parcel_m.area)
    intersection_area = float(intersection.area)
    building_overlap = intersection_area / building_area if building_area else 0.0
    parcel_coverage = intersection_area / parcel_area if parcel_area else 0.0

    result = {
        "property": evidence.get("property"),
        "metricCrs": LOCAL_METRIC_CRS,
        "buildingAreaSqMeters": round(building_area, 3),
        "parcelAreaSqMeters": round(parcel_area, 3),
        "intersectionAreaSqMeters": round(intersection_area, 3),
        "buildingAreaToParcelAreaRatio": round(building_area / parcel_area, 4) if parcel_area else None,
        "buildingOverlapRatio": round(building_overlap, 4),
        "parcelCoverageRatio": round(parcel_coverage, 4),
        "buildingBoundsMeters": [round(v, 3) for v in building_m.bounds],
        "parcelBoundsMeters": [round(v, 3) for v in parcel_m.bounds],
        "buildingCentroidMeters": [round(building_m.centroid.x, 3), round(building_m.centroid.y, 3)],
        "parcelCentroidMeters": [round(parcel_m.centroid.x, 3), round(parcel_m.centroid.y, 3)],
        "source": (evidence.get("building") or {}).get("source"),
        "note": "GIS overlap diagnostic only; not a survey or title determination.",
    }
    print(json.dumps(result, indent=2, sort_keys=True))

    # Do not accept a footprint that only brushes the parcel boundary. These thresholds are
    # intentionally permissive enough for small GIS offsets but strict enough to catch a
    # neighboring or district-scale polygon before it contaminates LiDAR height measurement.
    if intersection_area <= 0:
        raise RuntimeError("Building footprint has zero positive-area overlap with the parcel.")
    if parcel_coverage < 0.25:
        raise RuntimeError(f"Building footprint covers only {parcel_coverage:.1%} of parcel area; spatial match is too weak.")
    if building_overlap < 0.25:
        raise RuntimeError(f"Only {building_overlap:.1%} of the building footprint lies in the parcel; spatial match is too weak.")
    if building_area > parcel_area * 2.5:
        raise RuntimeError(f"Building footprint is {building_area / parcel_area:.2f}x parcel area; spatial match is implausibly broad.")


if __name__ == "__main__":
    main()
