import {
  fetchFirstRealErieParcel,
} from '../lib/real-estate/erie-county-evidence.js';
import {
  fetchNysErieLidarCoverage,
} from '../lib/real-estate/nys-lidar-evidence.js';

const property = await fetchFirstRealErieParcel();
const twin = property?.twin;
if (!twin?.structure?.buildingGeometry) {
  throw new Error('First real Erie parcel has no source-backed building footprint.');
}

const lidar = await fetchNysErieLidarCoverage({
  latitude: twin.location.latitude,
  longitude: twin.location.longitude,
});

if (lidar.coverageStatus !== 'covered' || lidar.tiles.length !== 1) {
  throw new Error(`Expected exactly one authoritative LAS tile for 618 Main; got ${lidar.tiles.length}.`);
}

const tile = lidar.tiles[0];
if (!tile.directDownloadUrl || !tile.filename) {
  throw new Error('Authoritative LAS tile must include filename and direct download URL.');
}

const payload = {
  schemaVersion: 1,
  property: {
    propertyId: twin.propertyId,
    label: twin.label,
    countySbl: property.countyRecord?.sbl,
    pin: property.countyRecord?.pin,
    address: property.countyRecord?.parcelAddress,
    municipality: property.countyRecord?.municipality,
  },
  referencePointWgs84: {
    latitude: twin.location.latitude,
    longitude: twin.location.longitude,
  },
  building: {
    geometryWgs84: twin.structure.buildingGeometry,
    source: twin.structure.source,
  },
  parcel: {
    geometryWgs84: twin.location.parcelGeometry,
    source: twin.location.source,
  },
  lidar: {
    collection: lidar.collection,
    resolvedLayer: lidar.resolvedLayer,
    tile: {
      objectId: tile.objectId,
      filename: tile.filename,
      sizeGb: tile.sizeGb,
      directDownloadUrl: tile.directDownloadUrl,
      ftpPath: tile.ftpPath,
    },
    source: lidar.source,
    queryUrl: lidar.provenance?.queryUrl,
  },
  truthBeforeMeasurement: {
    geography: twin.verification.geography,
    physical: twin.verification.physical,
    heightStatus: twin.verification.heightStatus,
    verifiedSpatialTwin: twin.verification.verifiedSpatialTwin,
    verifiedOwnership: twin.verification.verifiedOwnership,
  },
};

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
