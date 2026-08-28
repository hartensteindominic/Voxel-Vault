const clean = (value) => String(value ?? '').trim();
const finite = (value) => value !== null && value !== undefined && clean(value) !== '' && Number.isFinite(Number(value));

function hasUsableGeometry(geometry) {
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) return false;
  const polygonRing = geometry.type === 'Polygon' ? geometry.coordinates?.[0] : geometry.coordinates?.[0]?.[0];
  return Array.isArray(polygonRing) && polygonRing.length >= 4;
}

export function evaluateMeasuredBuildingHeight(input = {}) {
  const acceptedBuildingGeometry = input.acceptedBuildingGeometry || null;
  const lidarCoverage = input.lidarCoverage || null;
  const measurement = input.measurement || null;
  const hasAcceptedFootprint = hasUsableGeometry(acceptedBuildingGeometry);
  const hasLidarCoverage = lidarCoverage?.coverageStatus === 'covered' && Array.isArray(lidarCoverage?.tiles) && lidarCoverage.tiles.length > 0;

  if (!hasAcceptedFootprint) {
    return {
      status: 'blocked_missing_building_geometry',
      verifiedMeasuredHeight: false,
      heightMeters: null,
      hasLidarCoverage,
      note: 'A parcel-specific accepted building footprint is required before LiDAR roof/ground samples can be assigned to this building. Coverage alone is not a height measurement.',
    };
  }

  if (!hasLidarCoverage) {
    return {
      status: 'blocked_missing_lidar_coverage',
      verifiedMeasuredHeight: false,
      heightMeters: null,
      hasLidarCoverage: false,
      note: 'No approved LiDAR coverage is attached to this building footprint yet.',
    };
  }

  if (!measurement) {
    return {
      status: 'lidar_coverage_ready_for_measurement',
      verifiedMeasuredHeight: false,
      heightMeters: null,
      hasLidarCoverage: true,
      note: 'Authoritative LiDAR coverage and an accepted footprint are present, but roof/ground point-cloud samples have not been processed yet.',
    };
  }

  const roofElevationMeters = finite(measurement.roofElevationMeters) ? Number(measurement.roofElevationMeters) : null;
  const groundElevationMeters = finite(measurement.groundElevationMeters) ? Number(measurement.groundElevationMeters) : null;
  const uncertaintyMeters = finite(measurement.uncertaintyMeters) ? Number(measurement.uncertaintyMeters) : null;
  const roofSampleCount = Number(measurement.roofSampleCount || 0);
  const groundSampleCount = Number(measurement.groundSampleCount || 0);
  const sourceAuthority = clean(measurement.sourceAuthority);
  const method = clean(measurement.method);
  const footprintRecordId = clean(measurement.footprintRecordId);
  const sourceRecordId = clean(measurement.sourceRecordId);
  const observedAt = clean(measurement.observedAt);
  const trustedSource = measurement.trustedSource === true;
  const footprintMatchVerified = measurement.footprintMatchVerified === true;
  const groundMethodValidated = measurement.groundMethodValidated === true;

  const blockers = [
    roofElevationMeters === null ? 'roof elevation is missing' : '',
    groundElevationMeters === null ? 'ground elevation is missing' : '',
    roofSampleCount < 3 ? 'at least 3 roof samples are required' : '',
    groundSampleCount < 3 ? 'at least 3 ground samples are required' : '',
    uncertaintyMeters === null || uncertaintyMeters < 0 || uncertaintyMeters > 2 ? 'measurement uncertainty must be documented and <= 2 m' : '',
    !sourceAuthority ? 'source authority is required' : '',
    !method ? 'measurement method is required' : '',
    !footprintRecordId ? 'accepted footprint record id is required' : '',
    !sourceRecordId ? 'LiDAR/source record id is required' : '',
    !observedAt ? 'measurement observation timestamp is required' : '',
    !trustedSource ? 'measurement must arrive through a trusted source path' : '',
    !footprintMatchVerified ? 'building footprint match must be independently verified' : '',
    !groundMethodValidated ? 'ground-reference method must be independently validated' : '',
  ].filter(Boolean);

  const rawHeight = roofElevationMeters !== null && groundElevationMeters !== null ? roofElevationMeters - groundElevationMeters : null;
  if (rawHeight !== null && (rawHeight <= 0 || rawHeight > 500)) blockers.push('roof-minus-ground height is outside a defensible building range');

  if (blockers.length) {
    return {
      status: 'measurement_rejected',
      verifiedMeasuredHeight: false,
      heightMeters: null,
      hasLidarCoverage: true,
      blockers,
      note: 'The supplied LiDAR measurement did not satisfy GEO measured-height evidence requirements and cannot self-verify.',
    };
  }

  return {
    status: 'verified_measured_height',
    verifiedMeasuredHeight: true,
    heightMeters: Number(rawHeight.toFixed(3)),
    roofElevationMeters: Number(roofElevationMeters.toFixed(3)),
    groundElevationMeters: Number(groundElevationMeters.toFixed(3)),
    uncertaintyMeters: Number(uncertaintyMeters.toFixed(3)),
    roofSampleCount,
    groundSampleCount,
    method,
    sourceAuthority,
    sourceRecordId,
    footprintRecordId,
    observedAt,
    trustedSource,
    footprintMatchVerified,
    groundMethodValidated,
    note: 'Measured height is accepted only as a physical building measurement. It does not establish parcel ownership, title, market value, or investment rights.',
    legalEffects: {
      establishesDeedOwnership: false,
      establishesInvestmentRights: false,
      guaranteesValue: false,
    },
  };
}
