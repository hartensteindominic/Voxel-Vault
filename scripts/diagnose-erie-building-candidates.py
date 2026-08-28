#!/usr/bin/env python3
"""Inspect official Erie building-footprint candidates for the first real parcel.

Diagnostic only. It never changes the property twin. It compares the current 2025 DSM BUILDING
layer with Erie County's separate CPS/ErieCountyBase BuildingFootprints layer before any LiDAR
height is trusted.
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

DSM_BUILDING_LAYER = "https://gis.erie.gov/server/rest/services/DSM/DSM_Basemap_2025/MapServer/120"
CPS_BUILDING_LAYER = "https://gis.erie.gov/server/rest/services/CPS/ErieCountyBase/MapServer/9"
LOCAL_METRIC_CRS = "EPSG:32617"
DSM_FIELDS = "OBJECTID_12,OBJECTID,GlobalID,PIN,SBL,ADDNAME,ADDRESS,YEARBLT,SFLA,DATE_,EDITEDDATE,erie_DWQMADMIN_Building_AREA"


def fetch_geojson(layer: str, params: dict) -> dict:
    query = urllib.parse.urlencode(params)
    request = urllib.request.Request(
        f"{layer}/query?{query}",
        headers={"Accept": "application/geo+json, application/json", "User-Agent": "VoxelVault-Spatial-Diagnostic/1.0"},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        data = json.load(response)
    if not isinstance(data, dict) or data.get("error"):
        raise RuntimeError(f"Erie footprint query failed for {layer}: {data.get('error') if isinstance(data, dict) else 'invalid response'}")
    return data


def metric(geometry, transformer):
    return transform_geometry(transformer.transform, shape(geometry))


def summarize(source: str, label: str, data: dict, parcel_m, transformer) -> dict:
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
        props = feature.get("properties") or {}
        results.append({
            "source": source,
            "query": label,
            "objectId": props.get("OBJECTID") or props.get("OBJECTID_12") or props.get("FID"),
            "pin": str(props.get("PIN") or "").strip(),
            "sbl": str(props.get("SBL") or "").strip(),
            "address": str(props.get("ADDRESS") or props.get("Address") or "").strip(),
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
            "areaToParcelRatio": round(area / float(parcel_m.area), 5) if parcel_m.area else None,
            "centroidDistanceMeters": round(float(candidate.centroid.distance(parcel_m.centroid)), 3),
            "containsParcelCentroid": bool(candidate.covers(parcel_m.centroid)),
            "properties": props,
        })
    return {"source": source, "query": label, "featureCount": len(data.get("features") or []), "candidates": results}


def spatial_params(parcel_arcgis: dict, out_fields: str) -> dict:
    return {
        "f": "geojson",
        "where": "1=1",
        "geometry": json.dumps(parcel_arcgis, separators=(",", ":")),
        "geometryType": "esriGeometryPolygon",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": out_fields,
        "returnGeometry": "true",
        "outSR": "4326",
        "resultRecordCount": "100",
    }


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

    dsm_common = {
        "f": "geojson",
        "outFields": DSM_FIELDS,
        "returnGeometry": "true",
        "outSR": "4326",
        "resultRecordCount": "100",
    }
    escaped_address = address.replace("'", "''")
    report = {
        "property": evidence.get("property"),
        "parcelAreaSqMeters": round(float(parcel_m.area), 3),
        "queries": [
            summarize("DSM_BUILDING_2025", "exact-address", fetch_geojson(DSM_BUILDING_LAYER, {**dsm_common, "where": f"ADDRESS='{escaped_address}'"}), parcel_m, transformer),
            summarize("DSM_BUILDING_2025", "exact-addname", fetch_geojson(DSM_BUILDING_LAYER, {**dsm_common, "where": f"ADDNAME='{escaped_address}'"}), parcel_m, transformer),
            summarize("DSM_BUILDING_2025", "spatial-intersects", fetch_geojson(DSM_BUILDING_LAYER, spatial_params(parcel_arcgis, DSM_FIELDS)), parcel_m, transformer),
            summarize("CPS_BUILDING_FOOTPRINTS", "spatial-intersects", fetch_geojson(CPS_BUILDING_LAYER, spatial_params(parcel_arcgis, "*")), parcel_m, transformer),
        ],
    }
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
