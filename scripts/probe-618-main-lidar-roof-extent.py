#!/usr/bin/env python3
"""Derive a 2019 LiDAR roof-extent observation inside the exact 618 Main parcel.

This is deliberately NOT a cadastral building footprint and NOT a current-condition guarantee.
It uses the official Erie parcel only as a clip boundary, then asks the authoritative 2019 NYS
LiDAR itself where a coherent elevated roof surface was observed. The output can corroborate a
physical model, but it has no ownership/title/investment effect and does not auto-verify a twin.
"""

from __future__ import annotations

import hashlib
import json
import math
import tempfile
import urllib.parse
import urllib.request
from collections import deque
from pathlib import Path
from typing import Any

import laspy
import numpy as np
from pyproj import CRS, Transformer
from shapely import contains_xy
from shapely.geometry import box, shape
from shapely.ops import transform as transform_geometry, unary_union

ERIE_PARCEL_LAYER = "https://gis.erie.gov/server/rest/services/OGIS/Parcels/MapServer/0"
NYS_LIDAR_SERVICE = "https://elevation.its.ny.gov/arcgis/rest/services/LAS_Indexes/FeatureServer"
NYS_LIDAR_COLLECTION = "NYS - Erie, Genesee, Livingston 2019"
PROPERTY_SBL = "111.38-3-8"
PROPERTY_PIN = "1402001113800003008000"
GROUND_CLASS = 2
ROOF_CLASS = 1
GROUND_OUTER_BUFFER_METERS = 20.0
GROUND_INNER_BUFFER_METERS = 1.0
GRID_METERS = 0.75
MIN_POINTS_PER_ROOF_CELL = 2
ROOF_MODE_BIN_METERS = 0.5
ROOF_CLUSTER_HALF_WIDTH_METERS = 1.25


def request_json(url: str, params: dict[str, Any]) -> dict[str, Any]:
    query = urllib.parse.urlencode(params)
    request = urllib.request.Request(
        f"{url}?{query}",
        headers={"Accept": "application/json", "User-Agent": "VoxelVault-LiDAR-Roof-Extent/1.0"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.load(response)
    if not isinstance(payload, dict) or payload.get("error"):
        raise RuntimeError(f"Source query failed for {url}: {payload.get('error') if isinstance(payload, dict) else 'invalid JSON'}")
    return payload


def query_layer(layer: str, params: dict[str, Any]) -> dict[str, Any]:
    return request_json(f"{layer}/query", params)


def unit_factors(crs: CRS) -> tuple[float, float]:
    axes = list(crs.axis_info or [])
    if not axes:
        raise RuntimeError("LAS CRS has no axis units")
    horizontal = next((axis for axis in axes if axis.direction.lower() in {"east", "west"}), axes[0])
    vertical = next((axis for axis in axes if axis.direction.lower() in {"up", "down"}), None)
    horizontal_to_m = float(horizontal.unit_conversion_factor or 0)
    vertical_to_m = float(vertical.unit_conversion_factor) if vertical and vertical.unit_conversion_factor else horizontal_to_m
    if horizontal_to_m <= 0 or vertical_to_m <= 0:
        raise RuntimeError("LAS units cannot be converted to meters")
    return horizontal_to_m, vertical_to_m


def download(url: str, destination: Path) -> tuple[str, int]:
    if not url.lower().startswith("https://gisdata.ny.gov/"):
        raise RuntimeError("LAS must come from the official gisdata.ny.gov HTTPS host")
    request = urllib.request.Request(url, headers={"User-Agent": "VoxelVault-LiDAR-Roof-Extent/1.0"})
    digest = hashlib.sha256()
    size = 0
    with urllib.request.urlopen(request, timeout=120) as response, destination.open("wb") as output:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            output.write(chunk)
            digest.update(chunk)
            size += len(chunk)
    if size < 100_000_000:
        raise RuntimeError(f"LAS payload is implausibly small: {size} bytes")
    return digest.hexdigest(), size


def load_official_sources() -> tuple[dict[str, Any], str, str, str]:
    parcel_payload = query_layer(
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
    parcels = parcel_payload.get("features") or []
    if len(parcels) != 1:
        raise RuntimeError(f"Expected one official Erie parcel; got {len(parcels)}")
    parcel = parcels[0]
    props = parcel.get("properties") or {}
    if str(props.get("PIN") or "").strip() != PROPERTY_PIN or str(props.get("SBL") or "").strip() != PROPERTY_SBL:
        raise RuntimeError("618 Main official parcel identifiers drifted")
    if not parcel.get("geometry"):
        raise RuntimeError("Official Erie parcel has no geometry")

    parcel_shape = shape(parcel["geometry"])
    reference = parcel_shape.representative_point()
    service = request_json(NYS_LIDAR_SERVICE, {"f": "json"})
    matches = [layer for layer in service.get("layers") or [] if str(layer.get("name") or "").strip() == NYS_LIDAR_COLLECTION]
    if len(matches) != 1:
        raise RuntimeError(f"Expected exactly one NYS layer named {NYS_LIDAR_COLLECTION}; got {len(matches)}")
    layer_url = f"{NYS_LIDAR_SERVICE}/{int(matches[0]['id'])}"
    tiles = query_layer(
        layer_url,
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
    ).get("features") or []
    if len(tiles) != 1:
        raise RuntimeError(f"Expected one authoritative LAS tile for 618 Main; got {len(tiles)}")
    tile = tiles[0].get("attributes") or {}
    filename = str(tile.get("FILENAME") or "").strip()
    url = str(tile.get("DIRECT_DL") or "").strip()
    if not filename or not url:
        raise RuntimeError("NYS LAS tile is missing filename or direct URL")
    return parcel, layer_url, filename, url


def connected_components(cells: set[tuple[int, int]]) -> list[set[tuple[int, int]]]:
    remaining = set(cells)
    components: list[set[tuple[int, int]]] = []
    neighbors = [
        (-1, -1), (-1, 0), (-1, 1),
        (0, -1),           (0, 1),
        (1, -1),  (1, 0), (1, 1),
    ]
    while remaining:
        seed = remaining.pop()
        component = {seed}
        queue = deque([seed])
        while queue:
            x, y = queue.popleft()
            for dx, dy in neighbors:
                candidate = (x + dx, y + dy)
                if candidate in remaining:
                    remaining.remove(candidate)
                    component.add(candidate)
                    queue.append(candidate)
        components.append(component)
    components.sort(key=len, reverse=True)
    return components


def main() -> None:
    parcel_feature, lidar_layer, filename, lidar_url = load_official_sources()
    parcel_wgs84 = shape(parcel_feature["geometry"])
    parcel_props = parcel_feature.get("properties") or {}

    with tempfile.TemporaryDirectory(prefix="voxel-vault-roof-extent-") as temp_dir:
        las_path = Path(temp_dir) / filename
        las_sha, las_size = download(lidar_url, las_path)

        with laspy.open(las_path) as reader:
            raw_crs = reader.header.parse_crs()
            if raw_crs is None:
                raise RuntimeError("LAS has no parseable CRS")
            las_crs = CRS.from_user_input(raw_crs)
            horizontal_to_m, vertical_to_m = unit_factors(las_crs)
            wgs_to_las = Transformer.from_crs("EPSG:4326", las_crs, always_xy=True)
            las_to_wgs = Transformer.from_crs(las_crs, "EPSG:4326", always_xy=True)
            parcel = transform_geometry(wgs_to_las.transform, parcel_wgs84)
            meters_to_horizontal = 1.0 / horizontal_to_m
            grid_native = GRID_METERS * meters_to_horizontal
            ground_zone = parcel.buffer(GROUND_OUTER_BUFFER_METERS * meters_to_horizontal).difference(
                parcel.buffer(GROUND_INNER_BUFFER_METERS * meters_to_horizontal)
            )
            minx, miny, maxx, maxy = ground_zone.bounds

            ground_parts: list[np.ndarray] = []
            roof_x_parts: list[np.ndarray] = []
            roof_y_parts: list[np.ndarray] = []
            roof_z_parts: list[np.ndarray] = []
            scanned = 0

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
                inside_parcel = np.asarray(contains_xy(parcel, x, y), dtype=bool)
                inside_ground = np.asarray(contains_xy(ground_zone, x, y), dtype=bool)
                ground_mask = inside_ground & (classification == GROUND_CLASS)
                if np.any(ground_mask):
                    ground_parts.append(z[ground_mask])
                try:
                    first_return = np.asarray(points.return_number, dtype=np.uint8)[bbox] == 1
                except Exception:
                    first_return = np.ones(len(x), dtype=bool)
                roof_mask = inside_parcel & (classification == ROOF_CLASS) & first_return
                if np.any(roof_mask):
                    roof_x_parts.append(x[roof_mask])
                    roof_y_parts.append(y[roof_mask])
                    roof_z_parts.append(z[roof_mask])

        ground = np.concatenate(ground_parts) if ground_parts else np.empty(0)
        roof_x = np.concatenate(roof_x_parts) if roof_x_parts else np.empty(0)
        roof_y = np.concatenate(roof_y_parts) if roof_y_parts else np.empty(0)
        roof_z = np.concatenate(roof_z_parts) if roof_z_parts else np.empty(0)
        if len(ground) < 50 or len(roof_z) < 100:
            raise RuntimeError(f"Insufficient LiDAR samples: ground={len(ground)} roof={len(roof_z)}")

        ground_median = float(np.median(ground))
        plausible = (roof_z >= ground_median + 2.0 / vertical_to_m) & (roof_z <= ground_median + 80.0 / vertical_to_m)
        roof_x, roof_y, roof_z = roof_x[plausible], roof_y[plausible], roof_z[plausible]
        if len(roof_z) < 100:
            raise RuntimeError("Too few elevated first-return candidates remain")

        bin_native = ROOF_MODE_BIN_METERS / vertical_to_m
        low = math.floor(float(np.min(roof_z)) / bin_native) * bin_native
        high = math.ceil(float(np.max(roof_z)) / bin_native) * bin_native
        histogram, edges = np.histogram(roof_z, bins=np.arange(low, high + bin_native * 1.01, bin_native))
        mode_index = int(np.argmax(histogram))
        mode_center = (edges[mode_index] + edges[mode_index + 1]) / 2.0
        half_native = ROOF_CLUSTER_HALF_WIDTH_METERS / vertical_to_m
        cluster_mask = (roof_z >= mode_center - half_native) & (roof_z <= mode_center + half_native)
        cluster_x, cluster_y, cluster_z = roof_x[cluster_mask], roof_y[cluster_mask], roof_z[cluster_mask]
        if len(cluster_z) < 100:
            raise RuntimeError("Dominant roof cluster is too small")

        origin_x, origin_y = parcel.bounds[0], parcel.bounds[1]
        cell_counts: dict[tuple[int, int], int] = {}
        for x, y in zip(cluster_x, cluster_y, strict=True):
            cell = (int(math.floor((x - origin_x) / grid_native)), int(math.floor((y - origin_y) / grid_native)))
            cell_counts[cell] = cell_counts.get(cell, 0) + 1
        occupied = {cell for cell, count in cell_counts.items() if count >= MIN_POINTS_PER_ROOF_CELL}
        if not occupied:
            raise RuntimeError("No roof cells passed point-density threshold")
        components = connected_components(occupied)
        largest = components[0]

        def cell_shape(cell: tuple[int, int]):
            ix, iy = cell
            x0 = origin_x + ix * grid_native
            y0 = origin_y + iy * grid_native
            return box(x0, y0, x0 + grid_native, y0 + grid_native)

        all_roof = unary_union([cell_shape(cell) for cell in occupied]).intersection(parcel)
        largest_roof = unary_union([cell_shape(cell) for cell in largest]).intersection(parcel)
        if all_roof.is_empty or largest_roof.is_empty:
            raise RuntimeError("LiDAR roof-grid geometry collapsed after parcel clipping")

        parcel_area_m2 = float(parcel.area) * horizontal_to_m * horizontal_to_m
        roof_area_m2 = float(all_roof.area) * horizontal_to_m * horizontal_to_m
        largest_area_m2 = float(largest_roof.area) * horizontal_to_m * horizontal_to_m
        parcel_coverage = roof_area_m2 / parcel_area_m2 if parcel_area_m2 else 0.0
        largest_coverage = largest_area_m2 / parcel_area_m2 if parcel_area_m2 else 0.0
        component_fraction = len(largest) / len(occupied)
        candidate_height_m = (float(np.median(cluster_z)) - ground_median) * vertical_to_m

        largest_wgs84 = transform_geometry(las_to_wgs.transform, largest_roof)
        simplified = largest_wgs84.simplify(0.000002, preserve_topology=True)
        result = {
            "forcingFunction": "618-main-2019-lidar-roof-extent",
            "property": {
                "sbl": parcel_props.get("SBL"),
                "pin": parcel_props.get("PIN"),
                "address": parcel_props.get("ADDRESS"),
                "municipality": parcel_props.get("CITYTOWN"),
            },
            "observation": {
                "status": "LIDAR_OBSERVED_2019_CANDIDATE_ONLY",
                "candidateHeightMeters": round(candidate_height_m, 3),
                "gridMeters": GRID_METERS,
                "minPointsPerRoofCell": MIN_POINTS_PER_ROOF_CELL,
                "parcelAreaSqMeters": round(parcel_area_m2, 3),
                "observedRoofAreaSqMeters": round(roof_area_m2, 3),
                "largestConnectedRoofAreaSqMeters": round(largest_area_m2, 3),
                "observedRoofParcelCoverageRatio": round(parcel_coverage, 5),
                "largestRoofParcelCoverageRatio": round(largest_coverage, 5),
                "largestComponentCellFraction": round(component_fraction, 5),
                "roofClusterPointFraction": round(len(cluster_z) / len(roof_z), 5),
                "dominantRoofPointCount": int(len(cluster_z)),
                "candidateGeometryWgs84": simplified.__geo_interface__,
                "candidateGeometryRole": "2019 airborne-LiDAR observed elevated-surface extent; not cadastral footprint",
            },
            "qualityChecks": {
                "denseRoofSamples": len(cluster_z) >= 500,
                "dominantRoofCluster": len(cluster_z) / len(roof_z) >= 0.5,
                "singleCoherentComponent": component_fraction >= 0.7,
                "substantialParcelRoofCoverage": largest_coverage >= 0.5,
                "plausibleCommercialHeight": 6.0 <= candidate_height_m <= 30.0,
            },
            "sources": {
                "officialParcel": ERIE_PARCEL_LAYER,
                "lidarCollection": NYS_LIDAR_COLLECTION,
                "lidarLayer": lidar_layer,
                "lidarFilename": filename,
                "lidarDownloadUrl": lidar_url,
                "lidarDownloadedBytes": las_size,
                "lidarSha256": las_sha,
                "lidarCrs": las_crs.to_string(),
                "scannedLasPoints": scanned,
            },
            "verificationEffect": {
                "geography": "none",
                "physical": "corroboration_only",
                "verifiedSpatialTwin": False,
                "ownership": "none",
                "title": "none",
                "investmentRights": "none",
            },
            "limitations": [
                "The roof extent is algorithmically derived from a 2019 airborne LiDAR observation and is not a survey or cadastral building footprint.",
                "The observation does not prove the building is unchanged in 2026.",
                "The exact Erie parcel is used only as a clip boundary and identity anchor; parcel ownership is not inferred.",
            ],
        }
        print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
