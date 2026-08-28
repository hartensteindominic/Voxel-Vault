#!/usr/bin/env python3
"""Inspect official Erie BUILDING candidates for the first real parcel.

Diagnostic only. It never changes the property twin. The purpose is to determine whether an
exact source-backed address candidate exists and whether each official footprint has meaningful
positive-area overlap with the already-resolved official parcel polygon.
"""

from __future__ import annotations

import argparse
import json
import urllib.parse
import urllib.request
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform as transform_geometry

BUILDING_LAYER = "https://gis.erie.gov/server/rest/services/DSM/DSM_Basemap_2025/MapServer/120"
LOCAL_METRIC_CRS = "EPSG:32617"
FIELDS = "OBJECTID_12,OBJECTID,GlobalID,PIN,SBL,ADDNAME,ADDRESS,YEARBLT,SFLA,DATE_,EDITEDDATE,erie_DWQMADMIN_Building_AREA"


def fetch_geojson(params: dict) -> dict:
    query = urllib.parse.urlencode(params)
    request = urllib.request.Request(
        f"{BUILDING_LAYER}/query?{query}",
        headers={"Accept": "application/geo+json, application/json", "User-Agent": "VoxelVault-Spatial-Diagnostic/1.0"},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        data = json.load(response)
    if not isinstance(data, dict) or data.get("error"):
        raise RuntimeError(f"Erie BUILDING query failed: {data.get('error') if isinstance(data, dict) else 'invalid response'}")
    return data


def metric(geometry, transformer):
    return transform_geometry(transformer.transform, shape(geometry))


def summarize(label: str, data: dict, parcel_m, transformer) -> dict:
    results = []
    for feature in data.get("features") or []:
        geometry = feature.get("geometry")
        if not geometry:
            continue
        candidate = metric(geometry, transformer)
        intersection = candidate.intersection(parcel_m)
        area = float(candidate.area)
        intersection_area = float(intersection.area)
        overlap = intersection_area / area if area else 0.0
        parcel_coverage = intersection_area / float(parcel_m.area) if parcel_m.area else 0.0
        centroid_distance = float(candidate.centroid.distance(parcel_m.centroid))
        props = feature.get("properties") or {}
        results.append({
            "query": label,
            "objectId": props.get("OBJECTID") or props.get("OBJECTID_12"),
            "pin": str(props.get("PIN") or "").strip(),
            "sbl": str(props.get("SBL") or "").strip(),
            "address": str(props.get("ADDRESS") or "").strip(),
            "addname": str(props.get("ADDNAME") or "").strip(),
            "yearBuilt": props.get("YEARBLT"),
            "sfla": props.get("SFLA"),
            "declaredBuildingArea": props.get("erie_DWQMADMIN_Building_AREA"),
            "geometryType": geometry.get("type"),
            "partCount": len(geometry.get("coordinates") or []) if geometry.get("type") == "MultiPolygon" else 1,
            "areaSqMeters": round(area, 3),
            "intersectionAreaSqMeters": round(intersection_area, 3),
            "buildingOverlapRatio": round(overlap, 5),
            "parcelCoverageRatio": round(parcel_coverage, 5),
            "centroidDistanceMeters": round(centroid_distance, 3),
            "containsParcelCentroid": bool(candidate.covers(parcel_m.centroid)),
        })
    return {"query": label, "featureCount": len(data.get("features") or []), "candidates": results}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    args = parser.parse_args()
    evidence = json.loads(args.input.read_text(encoding="utf-8"))
    parcel_geo = (evidence.get("parcel") or {}).get("geometryWgs84")
    address = str((evidence.get("property") or {}).get("address") or "").strip().upper()
    if not parcel_geo or not address:
        raise RuntimeError("Source-backed parcel geometry and address are required.")

    transformer = Transformer.from_crs("EPSG:4326", LOCAL_METRIC_CRS, always_xy=True)
    parcel_m = metric(parcel_geo, transformer)
    parcel_arcgis = {
        "rings": [ring for polygon in (
            parcel_geo.get("coordinates") if parcel_geo.get("type") == "MultiPolygon" else [parcel_geo.get("coordinates")]
        ) for ring in (polygon or [])],
        "spatialReference": {"wkid": 4326},
    }

    common = {
        "f": "geojson",
        "outFields": FIELDS,
        "returnGeometry": "true",
        "outSR": "4326",
        "resultRecordCount": "100",
    }
    queries = [
        ("exact-address", {**common, "where": f"ADDRESS='{address.replace(chr(39), chr(39) * 2)}'"}),
        ("exact-addname", {**common, "where": f"ADDNAME='{address.replace(chr(39), chr(39) * 2)}'"}),
        ("spatial-intersects", {
            **common,
            "where": "1=1",
            "geometry": json.dumps(parcel_arcgis, separators=(",", ":")),
            "geometryType": "esriGeometryPolygon",
            "inSR": "4326",
            "spatialRel": "esriSpatialRelIntersects",
        }),
    ]

    report = {
        "property": evidence.get("property"),
        "parcelAreaSqMeters": round(float(parcel_m.area), 3),
        "queries": [],
    }
    for label, params in queries:
        report["queries"].append(summarize(label, fetch_geojson(params), parcel_m, transformer))

    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
