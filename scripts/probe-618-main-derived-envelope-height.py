#!/usr/bin/env python3
"""Probe a parcel-clipped physical envelope and LiDAR height candidate for 618 Main.

The envelope is DERIVED, not a source-native building footprint: it is the geometric intersection
of the exact Erie County parcel with the County-published connected BuildingFootprints polygon.
The resulting LiDAR height is therefore a diagnostic candidate only. Nothing produced here may
upgrade physical verification, ownership, title, investment rights, or blockchain rights.
"""

from __future__ import annotations

import hashlib
import json
import math
import tempfile
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import laspy
import numpy as np
from pyproj import CRS, Transformer
from shapely import contains_xy
from shapely.geometry import Polygon, shape
from shapely.ops import transform as transform_geometry

ERIE_PARCEL_LAYER = "https://gis.erie.gov/server/rest/services/OGIS/Parcels/MapServer/0"
ERIE_CONNECTED_BUILDING_LAYER = "https://gis.erie.gov/server/rest/services/CPS/ErieCountyBase/MapServer/9"
NYS_LIDAR_SERVICE = "https://elevation.its.ny.gov/arcgis/rest/services/LAS_Indexes/FeatureServer"
NYS_LIDAR_COLLECTION = "NYS - Erie, Genesee, Livingston 2019"
PROPERTY_SBL = "111.38-3-8"
PROPERTY_PIN = "1402001113800003008000"
LOCAL_METRIC_CRS = "EPSG:32617"
GROUND_CLASS = 2
ROOF_CLASS = 1
GROUND_OUTER_BUFFER_METERS = 20.0
GROUND_INNER_BUFFER_METERS = 1.0
ROOF_INSET_METERS = 0.75
ROOF_MODE_BIN_METERS = 0.5
ROOF_CLUSTER_HALF_WIDTH_METERS = 1.25


def fetch_json_url(url: str, params: dict[str, Any]) -> dict[str, Any]:
    query = urllib.parse.urlencode(params)
    request = urllib.request.Request(
        f"{url}?{query}",
        headers={"Accept": "application/json", "User-Agent": "VoxelVault-Derived-Envelope-Probe/1.0"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.load(response)
    if not isinstance(payload, dict):
        raise RuntimeError(f"Unreadable JSON response from {url}")
    if payload.get("error"):
        raise RuntimeError(f"ArcGIS request failed for {url}: {payload['error']}")
    return payload


def query_json(layer: str, params: dict[str, Any]) -> dict[str, Any]:
    return fetch_json_url(f"{layer}/query", params)


def canonical_sha256(value: Any) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def arcgis_polygon(geometry: dict[str, Any]) -> dict[str, Any]:
    if geometry.get("type") == "Polygon":
        rings = geometry.get("coordinates") or []
    elif geometry.get("type") == "MultiPolygon":
        rings = [ring for polygon in geometry.get("coordinates") or [] for ring in polygon]
    else:
        raise RuntimeError(f"Unsupported geometry type {geometry.get('type')}")
    return {"rings": rings, "spatialReference": {"wkid": 4326}}


def finite(value: Any) -> float | None:
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def percentile(values: np.ndarray, q: float) -> float:
    return float(np.percentile(values, q))


def mad(values: np.ndarray, center: float) -> float:
    return float(np.median(np.abs(values - center)) * 1.4826)


def unit_factors(crs: CRS) -> tuple[float, float, str, str]:
    axes = list(crs.axis_info or [])
    if not axes:
        raise RuntimeError("LAS CRS has no unit metadata")
    horizontal = next((axis for axis in axes if axis.direction.lower() in {"east", "west"}), axes[0])
    vertical = next((axis for axis in axes if axis.direction.lower() in {"up", "down"}), None)
    h_factor = float(horizontal.unit_conversion_factor or 0)
    v_factor = float(vertical.unit_conversion_factor) if vertical and vertical.unit_conversion_factor else h_factor
    if not math.isfinite(h_factor) or h_factor <= 0 or not math.isfinite(v_factor) or v_factor <= 0:
        raise RuntimeError("LAS CRS units cannot be converted to meters")
    return h_factor, v_factor, str(horizontal.unit_name or "unknown"), str(vertical.unit_name if vertical else horizontal.unit_name or "unknown")


def download(url: str, path: Path) -> tuple[str, int]:
    if not url.lower().startswith("https://gisdata.ny.gov/"):
        raise RuntimeError("LAS download is not on the official gisdata.ny.gov HTTPS host")
    request = urllib.request.Request(url, headers={"User-Agent": "VoxelVault-Derived-Envelope-Probe/1.0"})
    digest = hashlib.sha256()
    size = 0
    with urllib.request.urlopen(request, timeout=120) as response, path.open("wb") as output:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            output.write(chunk)
            digest.update(chunk)
            size += len(chunk)
    if size < 100_000_000:
        raise RuntimeError(f"LAS download is implausibly small: {size} bytes")
    return digest.hexdigest(), size


def load_sources() -> dict[str, Any]:
    parcel_payload = query_json(
        ERIE_PARCEL_LAYER,
        {
            "f": "geojson",
            "where": f"SBL='{PROPERTY_SBL}'",
            "outFields": "OBJECTID,PIN,SBL,ADDRESS,CITYTOWN,LOCALZIP,YEARBLT,SFLA,CLASS,PROP_TYPE,PROP_DESC",
            "returnGeometry": "true",
            "outSR": "4326",
            "resultRecordCount": "5",
        },
    )
    parcels = parcel_payload.get("features") or []
    if len(parcels) != 1:
        raise RuntimeError(f"Expected one official parcel; got {len(parcels)}")
    parcel_feature = parcels[0]
    parcel_props = parcel_feature.get("properties") or {}
    if str(parcel_props.get("PIN") or "").strip() != PROPERTY_PIN or str(parcel_props.get("SBL") or "").strip() != PROPERTY_SBL:
        raise RuntimeError("Official parcel identity drifted from reviewed 618 Main identifiers")
    parcel_geometry = parcel_feature.get("geometry")
    if not parcel_geometry:
        raise RuntimeError("Official parcel geometry is missing")
    parcel_shape = shape(parcel_geometry)

    connected_payload = query_json(
        ERIE_CONNECTED_BUILDING_LAYER,
        {
            "f": "geojson",
            "where": "1=1",
            "geometry": json.dumps(arcgis_polygon(parcel_geometry), separators=(",", ":")),
            "geometryType": "esriGeometryPolygon",
            "inSR": "4326",
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "*",
            "returnGeometry": "true",
            "outSR": "4326",
            "resultRecordCount": "25",
        },
    )
    connected_features = connected_payload.get("features") or []
    if len(connected_features) != 1:
        raise RuntimeError(f"Expected exactly one County-published connected footprint candidate; got {len(connected_features)}")
    connected_feature = connected_features[0]
    connected_geometry = connected_feature.get("geometry")
    if not connected_geometry:
        raise RuntimeError("County connected footprint candidate has no geometry")
    connected_shape = shape(connected_geometry)

    envelope = parcel_shape.intersection(connected_shape)
    if envelope.is_empty or not envelope.is_valid:
        raise RuntimeError("Parcel-clipped derived envelope is empty or invalid")

    metric_transformer = Transformer.from_crs("EPSG:4326", LOCAL_METRIC_CRS, always_xy=True)
    parcel_metric = transform_geometry(metric_transformer.transform, parcel_shape)
    connected_metric = transform_geometry(metric_transformer.transform, connected_shape)
    envelope_metric = transform_geometry(metric_transformer.transform, envelope)
    parcel_area = float(parcel_metric.area)
    connected_area = float(connected_metric.area)
    envelope_area = float(envelope_metric.area)
    if connected_area <= parcel_area * 2.5:
        raise RuntimeError("Connected footprint is no longer broad enough to require the reviewed parcel-clip derivation")
    if envelope_area / parcel_area < 0.25:
        raise RuntimeError("Derived envelope covers too little of the official parcel to continue the physical probe")

    reference = envelope.representative_point()
    service = fetch_json_url(NYS_LIDAR_SERVICE, {"f": "json"})
    layer_matches = [layer for layer in service.get("layers") or [] if str(layer.get("name") or "").strip() == NYS_LIDAR_COLLECTION]
    if len(layer_matches) != 1:
        raise RuntimeError(f"Expected one NYS LiDAR collection named {NYS_LIDAR_COLLECTION}; got {len(layer_matches)}")
    lidar_layer_id = int(layer_matches[0]["id"])
    lidar_layer = f"{NYS_LIDAR_SERVICE}/{lidar_layer_id}"
    tile_payload = query_json(
        lidar_layer,
        {
            "f": "json",
            "where": "1=1",
            "geometry": f"{reference.x},{reference.y}",
            "geometryType": "esriGeometryPoint",
            "inSR": "4326",
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "OBJECTID,FILENAME,SIZE_GB,COLLECTION,DIRECT_DL,FTP_PATH",
            "returnGeometry": "false",
            "resultRecordCount": "10",
        },
    )
    tile_features = tile_payload.get("features") or []
    if len(tile_features) != 1:
        raise RuntimeError(f"Expected one NYS LAS tile at the derived envelope; got {len(tile_features)}")
    tile = tile_features[0].get("attributes") or {}
    direct_url = str(tile.get("DIRECT_DL") or "").strip()
    filename = str(tile.get("FILENAME") or "").strip()
    if not direct_url or not filename:
        raise RuntimeError("NYS LAS tile lacks filename or direct download URL")

    return {
        "parcel": parcel_feature,
        "parcelShape": parcel_shape,
        "connected": connected_feature,
        "connectedShape": connected_shape,
        "envelope": envelope,
        "metrics": {
            "parcelAreaSqMeters": parcel_area,
            "connectedAreaSqMeters": connected_area,
            "envelopeAreaSqMeters": envelope_area,
            "envelopeParcelCoverageRatio": envelope_area / parcel_area,
            "envelopeConnectedCoverageRatio": envelope_area / connected_area,
        },
        "reference": reference,
        "lidarLayer": lidar_layer,
        "tile": tile,
        "tileFilename": filename,
        "tileUrl": direct_url,
    }


def measure_lidar(sources: dict[str, Any], las_path: Path, las_sha: str, las_size: int) -> dict[str, Any]:
    envelope_wgs84 = sources["envelope"]
    with laspy.open(las_path) as reader:
        las_crs_raw = reader.header.parse_crs()
        if las_crs_raw is None:
            raise RuntimeError("LAS has no parseable CRS")
        las_crs = CRS.from_user_input(las_crs_raw)
        h_to_m, v_to_m, h_unit, v_unit = unit_factors(las_crs)
        wgs_to_las = Transformer.from_crs("EPSG:4326", las_crs, always_xy=True)
        envelope = transform_geometry(wgs_to_las.transform, envelope_wgs84)
        meters_to_horizontal = 1.0 / h_to_m
        inset = envelope.buffer(-ROOF_INSET_METERS * meters_to_horizontal)
        roof_zone = inset if not inset.is_empty and inset.area >= envelope.area * 0.4 else envelope
        ground_zone = envelope.buffer(GROUND_OUTER_BUFFER_METERS * meters_to_horizontal).difference(
            envelope.buffer(GROUND_INNER_BUFFER_METERS * meters_to_horizontal)
        )
        minx, miny, maxx, maxy = ground_zone.bounds

        ground_parts: list[np.ndarray] = []
        roof_parts: list[np.ndarray] = []
        scanned = 0
        nearby = 0
        inside_roof_zone = 0

        for points in reader.chunk_iterator(1_000_000):
            scanned += len(points)
            x_all = np.asarray(points.x, dtype=np.float64)
            y_all = np.asarray(points.y, dtype=np.float64)
            bbox = (x_all >= minx) & (x_all <= maxx) & (y_all >= miny) & (y_all <= maxy)
            if not np.any(bbox):
                continue
            x = x_all[bbox]
            y = y_all[bbox]
            z = np.asarray(points.z, dtype=np.float64)[bbox]
            classification = np.asarray(points.classification, dtype=np.uint8)[bbox]
            nearby += len(x)

            ground_mask = np.asarray(contains_xy(ground_zone, x, y), dtype=bool) & (classification == GROUND_CLASS)
            if np.any(ground_mask):
                ground_parts.append(z[ground_mask])

            roof_inside = np.asarray(contains_xy(roof_zone, x, y), dtype=bool)
            inside_roof_zone += int(np.count_nonzero(roof_inside))
            try:
                first_return = np.asarray(points.return_number, dtype=np.uint8)[bbox] == 1
            except Exception:
                first_return = np.ones(len(x), dtype=bool)
            roof_mask = roof_inside & (classification == ROOF_CLASS) & first_return
            if np.any(roof_mask):
                roof_parts.append(z[roof_mask])

    ground = np.concatenate(ground_parts) if ground_parts else np.empty(0, dtype=np.float64)
    roof = np.concatenate(roof_parts) if roof_parts else np.empty(0, dtype=np.float64)
    if len(ground) < 50:
        raise RuntimeError(f"Insufficient class-2 ground points: {len(ground)}")
    if len(roof) < 100:
        raise RuntimeError(f"Insufficient class-1 first-return roof candidates: {len(roof)}")

    ground_median = percentile(ground, 50)
    min_roof = ground_median + 2.0 / v_to_m
    max_roof = ground_median + 80.0 / v_to_m
    roof = roof[(roof >= min_roof) & (roof <= max_roof)]
    if len(roof) < 100:
        raise RuntimeError(f"Insufficient roof candidates after elevation filtering: {len(roof)}")

    bin_width_native = ROOF_MODE_BIN_METERS / v_to_m
    low = math.floor(float(np.min(roof)) / bin_width_native) * bin_width_native
    high = math.ceil(float(np.max(roof)) / bin_width_native) * bin_width_native
    bins = np.arange(low, high + bin_width_native * 1.01, bin_width_native)
    histogram, edges = np.histogram(roof, bins=bins)
    mode_index = int(np.argmax(histogram))
    mode_center = (edges[mode_index] + edges[mode_index + 1]) / 2.0
    half_width_native = ROOF_CLUSTER_HALF_WIDTH_METERS / v_to_m
    cluster = roof[(roof >= mode_center - half_width_native) & (roof <= mode_center + half_width_native)]
    if len(cluster) < 50:
        raise RuntimeError(f"Dominant roof cluster is too small: {len(cluster)}")

    roof_median = percentile(cluster, 50)
    candidate_height_m = (roof_median - ground_median) * v_to_m
    ground_mad_m = mad(ground, ground_median) * v_to_m
    roof_mad_m = mad(cluster, roof_median) * v_to_m
    uncertainty_m = max(0.25, ground_mad_m, roof_mad_m)
    cluster_fraction = len(cluster) / len(roof)

    parcel_props = sources["parcel"].get("properties") or {}
    sfla = finite(parcel_props.get("SFLA"))
    envelope_sqft = sources["metrics"]["envelopeAreaSqMeters"] * 10.7639104167
    implied_floor_equivalents = sfla / envelope_sqft if sfla and envelope_sqft > 0 else None
    height_per_floor_m = candidate_height_m / implied_floor_equivalents if implied_floor_equivalents and implied_floor_equivalents > 0 else None

    checks = {
        "groundPointCount": len(ground) >= 50,
        "roofCandidateCount": len(roof) >= 100,
        "roofClusterCount": len(cluster) >= 50,
        "roofClusterFraction": cluster_fraction >= 0.20,
        "candidateHeightRange": 2.0 <= candidate_height_m <= 80.0,
        "candidateUncertainty": uncertainty_m <= 2.5,
        "parcelClipCoverage": sources["metrics"]["envelopeParcelCoverageRatio"] >= 0.25,
        "connectedSourceIsBroad": sources["metrics"]["connectedAreaSqMeters"] > sources["metrics"]["parcelAreaSqMeters"] * 2.5,
        "floorAreaConsistency": True if implied_floor_equivalents is None else 1.0 <= implied_floor_equivalents <= 20.0,
        "heightPerFloorConsistency": True if height_per_floor_m is None else 2.4 <= height_per_floor_m <= 6.5,
    }
    quality_pass = all(checks.values())

    connected_props = sources["connected"].get("properties") or {}
    return {
        "schemaVersion": 1,
        "forcingFunction": "618-main-derived-envelope-height",
        "property": {
            "sbl": parcel_props.get("SBL"),
            "pin": parcel_props.get("PIN"),
            "address": parcel_props.get("ADDRESS"),
            "municipality": parcel_props.get("CITYTOWN"),
            "yearBuiltReference": parcel_props.get("YEARBLT"),
            "floorAreaSqFtReference": sfla,
        },
        "derivedEnvelope": {
            "status": "DERIVED_CANDIDATE_ONLY",
            "method": "exact-erie-parcel-intersection-with-county-published-connected-footprint-v1",
            "geometryWgs84": sources["envelope"].__geo_interface__,
            "geometrySha256": canonical_sha256(sources["envelope"].__geo_interface__),
            "parcelAreaSqMeters": round(sources["metrics"]["parcelAreaSqMeters"], 3),
            "connectedFootprintAreaSqMeters": round(sources["metrics"]["connectedAreaSqMeters"], 3),
            "envelopeAreaSqMeters": round(sources["metrics"]["envelopeAreaSqMeters"], 3),
            "parcelCoverageRatio": round(sources["metrics"]["envelopeParcelCoverageRatio"], 5),
            "connectedFootprintCoverageRatio": round(sources["metrics"]["envelopeConnectedCoverageRatio"], 5),
            "envelopeAreaSqFt": round(envelope_sqft, 1),
            "impliedFloorEquivalentsFromCountySFLA": round(implied_floor_equivalents, 3) if implied_floor_equivalents else None,
        },
        "measurement": {
            "status": "DERIVED_CANDIDATE_QUALITY_PASS" if quality_pass else "DERIVED_CANDIDATE_REJECTED",
            "candidateHeightMeters": round(candidate_height_m, 3),
            "candidateUncertaintyMeters": round(uncertainty_m, 3),
            "heightPerImpliedFloorMeters": round(height_per_floor_m, 3) if height_per_floor_m else None,
            "qualityGatePassed": quality_pass,
            "qualityChecks": checks,
            "measuredAt": datetime.now(timezone.utc).isoformat(),
            "definition": "Dominant 0.5 m-binned class-1 first-return roof elevation cluster inside an inset derived envelope minus median class-2 local ground; diagnostic only",
        },
        "statistics": {
            "scannedLasPoints": scanned,
            "nearbyLasPoints": nearby,
            "pointsInsideRoofZone": inside_roof_zone,
            "groundPointCount": int(len(ground)),
            "roofCandidateCount": int(len(roof)),
            "roofClusterCount": int(len(cluster)),
            "roofClusterFraction": round(cluster_fraction, 5),
            "groundElevationMedianNative": ground_median,
            "roofClusterMedianNative": roof_median,
            "groundMadMeters": round(ground_mad_m, 4),
            "roofClusterMadMeters": round(roof_mad_m, 4),
        },
        "sources": {
            "officialParcel": {
                "authority": "Erie County Office of GIS / Real Property Tax Services",
                "url": ERIE_PARCEL_LAYER,
                "geometrySha256": canonical_sha256(sources["parcel"]["geometry"]),
            },
            "connectedFootprint": {
                "authority": "Erie County Office of GIS — CPS BuildingFootprints publication",
                "url": ERIE_CONNECTED_BUILDING_LAYER,
                "recordId": connected_props.get("OBJECTID") or connected_props.get("FID"),
                "addressRange": connected_props.get("AddressRange"),
                "street": connected_props.get("Most_common_Street"),
                "underlyingSource": connected_props.get("Source"),
                "sourceDate": connected_props.get("SourceDate"),
                "geometrySha256": canonical_sha256(sources["connected"]["geometry"]),
            },
            "lidar": {
                "authority": "New York State ITS Geospatial Services",
                "collection": NYS_LIDAR_COLLECTION,
                "layerUrl": sources["lidarLayer"],
                "filename": sources["tileFilename"],
                "downloadUrl": sources["tileUrl"],
                "downloadedBytes": las_size,
                "sha256": las_sha,
                "crs": las_crs.to_string(),
                "horizontalUnit": h_unit,
                "verticalUnit": v_unit,
            },
        },
        "verificationEffect": {
            "geography": "none",
            "physical": "none",
            "verifiedSpatialTwin": False,
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
    }


def main() -> None:
    sources = load_sources()
    with tempfile.TemporaryDirectory(prefix="voxel-vault-derived-envelope-") as temp_dir:
        las_path = Path(temp_dir) / sources["tileFilename"]
        las_sha, las_size = download(sources["tileUrl"], las_path)
        result = measure_lidar(sources, las_path, las_sha, las_size)
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
