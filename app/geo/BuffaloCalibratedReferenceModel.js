'use client';

import { useMemo } from 'react';
import GeoReferenceModel from './GeoReferenceModel';

function clean(value) {
  return String(value ?? '').trim();
}

function buildVisualReference(reference, authoritativeTwin, buffaloReference, addressLabel) {
  const footprint = authoritativeTwin?.structure?.buildingGeometry || null;
  const visualHeightMeters = Number(buffaloReference?.visualHeightReferenceMeters);
  if (!footprint || !buffaloReference?.found || !(visualHeightMeters > 0)) return reference;

  const source = authoritativeTwin?.structure?.source || authoritativeTwin?.location?.source || {};
  const levels = Number(buffaloReference?.stories);
  const material = clean(buffaloReference?.exteriorWallDescription);
  const style = clean(buffaloReference?.buildingStyleDescription);

  return {
    ...(reference || {}),
    found: true,
    latitude: authoritativeTwin?.location?.latitude ?? reference?.latitude,
    longitude: authoritativeTwin?.location?.longitude ?? reference?.longitude,
    geometry: footprint,
    matchStrategy: 'exact_source_address_match',
    tags: {
      ...(reference?.tags || {}),
      name: clean(addressLabel) || clean(buffaloReference?.address) || clean(reference?.tags?.name),
      building: clean(buffaloReference?.landUse) || clean(reference?.tags?.building),
      levels: Number.isFinite(levels) && levels > 0 ? String(levels) : clean(reference?.tags?.levels),
      'building:material': material || clean(reference?.tags?.['building:material']),
      'building:style': style,
    },
    height: {
      ...(reference?.height || {}),
      referenceHeightMeters: visualHeightMeters,
      heightStatus: 'derived_from_levels',
      heightSource: 'City of Buffalo assessment story count used only for rendering calibration',
    },
    source: {
      authority: source?.authority || 'Erie County Office of GIS — BUILDING layer',
      recordId: source?.recordId || buffaloReference?.source?.recordId || '',
      observedAt: source?.observedAt || buffaloReference?.source?.observedAt || '',
      sourceUrl: source?.sourceUrl || buffaloReference?.source?.sourceUrl || '',
    },
  };
}

function buildParcelOnlyTwin(authoritativeTwin) {
  if (!authoritativeTwin?.structure?.buildingGeometry) return authoritativeTwin;
  return {
    ...authoritativeTwin,
    structure: {
      ...authoritativeTwin.structure,
      buildingGeometry: null,
    },
  };
}

export default function BuffaloCalibratedReferenceModel({
  reference,
  authoritativeTwin,
  buffaloReference = null,
  addressLabel = '',
  viewMode = 'orbit',
  resetKey = 0,
}) {
  const calibratedReference = useMemo(
    () => buildVisualReference(reference, authoritativeTwin, buffaloReference, addressLabel),
    [reference, authoritativeTwin, buffaloReference, addressLabel],
  );
  const parcelTwin = useMemo(
    () => (buffaloReference?.found ? buildParcelOnlyTwin(authoritativeTwin) : authoritativeTwin),
    [authoritativeTwin, buffaloReference?.found],
  );

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <GeoReferenceModel
        reference={calibratedReference}
        authoritativeTwin={parcelTwin}
        viewMode={viewMode}
        resetKey={resetKey}
      />
      {buffaloReference?.found ? (
        <div
          style={{
            position: 'absolute',
            right: 12,
            bottom: 76,
            zIndex: 6,
            maxWidth: 230,
            padding: '8px 10px',
            borderRadius: 14,
            border: '1px solid rgba(183,240,213,0.18)',
            background: 'rgba(12,18,17,0.8)',
            color: '#f6efe1',
            boxShadow: '0 12px 30px rgba(0,0,0,0.22)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            pointerEvents: 'none',
          }}
          aria-label="Buffalo assessment rendering calibration"
        >
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b7f0d5' }}>
            Buffalo calibration
          </div>
          <div style={{ marginTop: 3, fontSize: 10, lineHeight: 1.35 }}>
            {[buffaloReference.stories ? `${buffaloReference.stories} stories` : '', buffaloReference.exteriorWallDescription, buffaloReference.buildingStyleDescription]
              .filter(Boolean)
              .join(' · ') || 'Current assessment characteristics loaded'}
          </div>
          <div style={{ marginTop: 3, fontSize: 9, lineHeight: 1.3, color: 'rgba(246,239,225,0.58)' }}>
            Story count/material class calibrate the render only. Exact windows, doors, porch and roof form still require licensed/open visual evidence.
          </div>
        </div>
      ) : null}
    </div>
  );
}
