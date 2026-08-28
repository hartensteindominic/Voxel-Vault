#!/usr/bin/env python3
"""Compare 618 Main's official Erie parcel with a non-authoritative footprint source.

This is a geometry diagnostic only. The official Erie parcel remains the identity anchor. The
Microsoft-derived Buffalo footprint layer may help identify a plausible physical outline, but it
must never upgrade Voxel Vault's geographic, physical, ownership, title, or investment truth on
its own.
"""

from __future__ import annotations

import json
import math
import urllib.parse
import urllib.request
from typing import Any

from pyproj import Transformer
from shapely.geometry import Point, Polygon, shape
from shapely.ops import transform as transform_geometry, unary_union

ERIE_PARCEL_LAYER = "https://gis.erie.gov/server/rest/services/OGIS/Parcels/MapServer/0"
MICROSOFT_BUFFALO_FOOTPRINT_LAYER = "https://services8.arcgis.com/cbDaIA5xFnHBUlC1/arcgis/rest/services/Erie_County_Building_Footprints/FeatureServer/0"
PROPERTY_SBL = "111.38-3-8"
PROPERTY_PIN = "1402001113800003008000"
LOCAL_METRIC_CRS = "EPSG:32617"


def fetch_json(url: str, params: dict[str, Any]) -> dict[str, Any]:
    query = urllib.parse.urlencode(params)
    request = urllib.request.Request(
        f"{url}/query?{query}",
        headers={
            "Accept": "application/json",
            "User-Agent": "VoxelVault-Spatial-Corroboration/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.load(response)
    if not isinstance(payload, dict):
        raise RuntimeError(f"Unreadable JSON response from {url}")
    if payload.get("error"):
        raise RuntimeError(f"ArcGIS query failed for {url}: {payload['error']}")
    return payload


def geojson_parcel() -> tuple[dict[str, Any], dict[str, Any]]:
    payload = fetch_json(
        ERIE_PARCEL_LAYER,
        {
            "f": "geojson",
            "where": f"SBL='{PROPERTY_SBL}'",
            "outFields": "OBJECTID,PIN,SBL,ADDRESS,CITYTOWN,LOCALZIP",
            "returnGeometry": "true",
            "outSR": "4326",
            "resultRecordCount": "5",
        },
    )
    features = payload.get("features") or []
    if len(features) != 1:
        raise RuntimeError(f"Expected exactly one official Erie parcel for {PROPERTY_SBL}; got {len(features)}")
    feature = features[0]
    properties = feature.get("properties") or {}
    if str(properties.get("PIN") or "").strip() != PROPERTY_PIN:
        raise RuntimeError("Official Erie parcel PIN no longer matches the reviewed 618 Main parcel")
    if str(properties.get("SBL") or "").strip() != PROPERTY_SBL:
        raise RuntimeError("Official Erie parcel SBL no longer matches 618 Main")
    geometry = feature.get("geometry")
    if not geometry:
        raise RuntimeError("Official Erie parcel has no geometry")
    return geometry, properties


def arcgis_polygon_to_shape(geometry: dict[str, Any]):
    rings = geometry.get("rings") or []
    polygons = []
    for ring in rings:
        if not isinstance(ring, list) or len(ring) < 4:
            continue
        polygon = Polygon(ring)
        if polygon.is_empty:
            continue
        if not polygon.is_valid:
            polygon = polygon.buffer(0)
        if not polygon.is_empty:
            polygons.append(polygon)
    if not polygons:
        return None
    return unary_union(polygons)


def arcgis_polygon_from_geojson(geometry: dict[str, Any]) -> dict[str, Any]:
    if geometry.get("type") == "Polygon":
        rings = geometry.get("coordinates") or []
    elif geometry.get("type") == "MultiPolygon":
        rings = [ring for polygon in geometry.get("coordinates") or [] for ring in polygon]
    else:
        raise RuntimeError(f"Unsupported official parcel geometry type: {geometry.get('type')}")
    return {
        "rings": rings,
        "spatialReference": {"wkid": 4326},
    }


def finite_or_none(value: Any):
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def main() -> None:
    parcel_geojson, parcel_properties = geojson_parcel()
    parcel_wgs84 = shape(parcel_geojson)
    if parcel_wgs84.is_empty or not parcel_wgs84.is_valid:
        raise RuntimeError("Official Erie parcel geometry is empty or invalid")

    transformer = Transformer.from_crs("EPSG:4326", LOCAL_METRIC_CRS, always_xy=True)
    parcel_metric = transform_geometry(transformer.transform, parcel_wgs84)
    reference_wgs84 = parcel_wgs84.representative_point()
    reference_metric = transform_geometry(transformer.transform, reference_wgs84)

    query_geometry = arcgis_polygon_from_geojson(parcel_geojson)
    corroboration_payload = fetch_json(
        MICROSOFT_BUFFALO_FOOTPRINT_LAYER,
        {
            "f": "json",
            "where": "1=1",
            "geometry": json.dumps(query_geometry, separators=(",", ":")),
            "geometryType": "esriGeometryPolygon",
            "inSR": "4326",
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "*",
            "returnGeometry": "true",
            "outSR": "4326",
            "resultRecordCount": "100",
        },
    )

    candidates = []
    for feature in corroboration_payload.get("features") or []:
        candidate_wgs84 = arcgis_polygon_to_shape(feature.get("geometry") or {})
        if candidate_wgs84 is None or candidate_wgs84.is_empty:
            continue
        candidate_metric = transform_geometry(transformer.transform, candidate_wgs84)
        intersection = candidate_metric.intersection(parcel_metric)
        candidate_area = float(candidate_metric.area)
        parcel_area = float(parcel_metric.area)
        intersection_area = float(intersection.area)
        properties = feature.get("attributes") or {}
        candidates.append({
            "objectId": properties.get("OBJECTID") or properties.get("FID") or properties.get("ObjectID"),
            "sourceProperties": properties,
            "areaSqMeters": round(candidate_area, 3),
            "intersectionAreaSqMeters": round(intersection_area, 3),
            "candidateOverlapRatio": round(intersection_area / candidate_area, 5) if candidate_area else 0,
            "parcelCoverageRatio": round(intersection_area / parcel_area, 5) if parcel_area else 0,
            "areaToParcelRatio": round(candidate_area / parcel_area, 5) if parcel_area else None,
            "centroidDistanceToParcelMeters": round(float(candidate_metric.centroid.distance(parcel_metric.centroid)), 3),
            "containsParcelRepresentativePoint": bool(candidate_wgs84.covers(reference_wgs84)),
            "geometryWgs84": candidate_wgs84.__geo_interface__,
        })

    candidates.sort(
        key=lambda item: (
            item["containsParcelRepresentativePoint"],
            item["intersectionAreaSqMeters"],
            item["candidateOverlapRatio"],
            -item["centroidDistanceToParcelMeters"],
        ),
        reverse=True,
    )

    plausible = [
        item for item in candidates
        if item["candidateOverlapRatio"] >= 0.5
        and item["parcelCoverageRatio"] >= 0.25
        and item["areaToParcelRatio"] is not None
        and item["areaToParcelRatio"] <= 2.5
    ]

    result = {
        "forcingFunction": "618-main-footprint-corroboration",
        "property": {
            "sbl": parcel_properties.get("SBL"),
            "pin": parcel_properties.get("PIN"),
            "address": parcel_properties.get("ADDRESS"),
            "municipality": parcel_properties.get("CITYTOWN"),
        },
        "officialParcel": {
            "source": ERIE_PARCEL_LAYER,
            "areaSqMeters": round(float(parcel_metric.area), 3),
            "representativePointWgs84": {
                "longitude": round(float(reference_wgs84.x), 7),
                "latitude": round(float(reference_wgs84.y), 7),
            },
        },
        "corroborationSource": {
            "url": MICROSOFT_BUFFALO_FOOTPRINT_LAYER,
            "description": "Public ArcGIS service described as 'For Buffalo From Microsoft Building Footprints dataset'",
            "authority": "NON_AUTHORITATIVE_CORROBORATION_ONLY",
        },
        "candidateCount": len(candidates),
        "plausibleCandidateCount": len(plausible),
        "candidates": candidates,
        "plausibleCandidates": plausible,
        "verificationEffect": {
            "geography": "none",
            "physical": "none",
            "height": "none",
            "ownership": "none",
            "title": "none",
            "investmentRights": "none",
        },
        "legalEffects": {
            "isLegalSurvey": False,
            "establishesParcelBoundary": False,
            "establishesBuildingIdentity": False,
            "establishesDeedOwnership": False,
            "establishesTitle": False,
            "createsInvestmentRights": False,
            "createsBlockchainRights": False,
        },
        "nextRule": "A plausible non-authoritative footprint may guide investigation, but Voxel Vault must not promote it into the verified property twin without an authoritative or independently defensible parcel-specific evidence chain.",
    }

    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
