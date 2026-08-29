const INDEX_KEY = 'voxel-vault:property-drafts:index';
const DRAFT_PREFIX = 'voxel-vault:property-draft:';
const MAX_DRAFTS = 24;

function clean(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function roundCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(7)) : null;
}

function geometryKind(building, twin) {
  if (twin?.structure?.buildingGeometry) return 'parcel-linked-building';
  if (building?.geometry) return 'source-backed-building';
  if (twin?.location?.parcelGeometry) return 'parcel-boundary';
  return 'location-reference';
}

function propertyLabel(building, twin, fallbackLabel = '') {
  const sourceAddress = [building?.tags?.houseNumber, building?.tags?.street].filter(Boolean).join(' ');
  return clean(
    fallbackLabel || building?.tags?.name || sourceAddress || twin?.identity?.address || twin?.identity?.parcelId,
    'Saved property draft',
  );
}

function stableId(building, twin) {
  const explicit = clean(building?.atlasId || twin?.identity?.parcelId || twin?.identity?.pin || twin?.identity?.sbl);
  if (explicit) return explicit.replace(/[^a-zA-Z0-9_.:-]+/g, '-').slice(0, 180);
  const lat = roundCoordinate(building?.latitude ?? twin?.location?.latitude);
  const lng = roundCoordinate(building?.longitude ?? twin?.location?.longitude);
  if (lat !== null && lng !== null) return `location:${lat},${lng}`;
  return '';
}

export function buildPropertyDraft({
  building = null,
  authoritativeEvidence = null,
  buffaloReference = null,
  openImagery = null,
  listing = null,
  focusAuthority = '',
  fallbackLabel = '',
} = {}) {
  const twin = authoritativeEvidence?.twin || null;
  const id = stableId(building, twin);
  if (!id) return null;

  const kind = geometryKind(building, twin);
  const exactFootprint = Boolean(twin?.structure?.buildingGeometry);
  const sourceFootprint = Boolean(building?.geometry);
  const parcelBoundary = Boolean(twin?.location?.parcelGeometry);
  const openPhotos = Array.isArray(openImagery?.photos) ? openImagery.photos.length : 0;
  const openReconstructionRefs = Array.isArray(openImagery?.meshyReferences) ? openImagery.meshyReferences.length : 0;
  const listingReconstructionRefs = Array.isArray(listing?.meshyReferences) ? listing.meshyReferences.length : 0;
  const derivativeReferenceCount = Math.max(openReconstructionRefs, listingReconstructionRefs);
  const latitude = roundCoordinate(building?.latitude ?? twin?.location?.latitude);
  const longitude = roundCoordinate(building?.longitude ?? twin?.location?.longitude);
  const geometry = twin?.structure?.buildingGeometry || building?.geometry || twin?.location?.parcelGeometry || null;

  const fidelity = exactFootprint
    ? derivativeReferenceCount >= 2 ? 'parcel-linked-ready-for-high-fidelity' : 'parcel-linked-3d-draft'
    : sourceFootprint
      ? derivativeReferenceCount >= 2 ? 'source-backed-ready-for-high-fidelity' : 'source-backed-3d-draft'
      : parcelBoundary ? 'parcel-3d-draft' : 'location-reference';

  return {
    schemaVersion: 1,
    type: 'voxel-vault-property-3d-draft',
    id,
    label: propertyLabel(building, twin, fallbackLabel),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    state: 'draft',
    fidelity,
    geometryKind: kind,
    coordinates: { latitude, longitude },
    geometry,
    propertyIdentity: {
      atlasId: clean(building?.atlasId) || null,
      parcelId: clean(twin?.identity?.parcelId) || null,
      pin: clean(authoritativeEvidence?.countyRecord?.pin || twin?.identity?.pin) || null,
      sbl: clean(authoritativeEvidence?.countyRecord?.sbl || twin?.identity?.sbl) || null,
    },
    evidence: {
      exactParcelLinkedBuilding: exactFootprint,
      sourceBackedBuilding: sourceFootprint,
      authoritativeParcelBoundary: parcelBoundary,
      calibratedStories: Number(buffaloReference?.stories) || null,
      calibratedVisualHeightMeters: Number(buffaloReference?.visualHeightReferenceMeters) || null,
      openStreetPhotoCount: openPhotos,
      reconstructionReferenceCount: derivativeReferenceCount,
      mapAuthority: clean(building?.source?.authority || focusAuthority) || null,
      mapLicense: clean(building?.source?.license) || null,
      mapSourceUrl: clean(building?.source?.sourceUrl) || null,
      listingProvider: clean(listing?.provider) || null,
    },
    blockchain: {
      minted: false,
      optional: true,
      tokenId: null,
      network: null,
    },
    world: {
      public: false,
      publishedAt: null,
      publicLabel: '3D Property',
    },
    legal: {
      titleVerified: false,
      ownershipRightsCreatedByDraft: false,
      ownershipRightsCreatedByMint: false,
      note: 'This saved 3D draft is a digital representation only. Saving or minting it does not transfer deed/title, investment rights, rent rights, or guarantee value.',
    },
  };
}

function safeParse(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function timestamp(value) {
  const parsed = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isPropertyDraftRecord(value) {
  return Boolean(value && typeof value === 'object' && value.id && value.type === 'voxel-vault-property-3d-draft');
}

export function mergePropertyDraftRecords(...groups) {
  const map = new Map();
  for (const group of groups) {
    for (const draft of Array.isArray(group) ? group : []) {
      if (!isPropertyDraftRecord(draft)) continue;
      const previous = map.get(draft.id);
      if (!previous || timestamp(draft.updatedAt) >= timestamp(previous.updatedAt)) {
        map.set(draft.id, {
          ...draft,
          createdAt: previous?.createdAt || draft.createdAt || new Date(0).toISOString(),
          blockchain: {
            ...(draft.blockchain || {}),
            minted: Boolean(previous?.blockchain?.minted || draft?.blockchain?.minted),
            optional: true,
          },
          world: {
            public: false,
            publishedAt: null,
            publicLabel: '3D Property',
            ...(previous?.world || {}),
            ...(draft?.world || {}),
          },
        });
      }
    }
  }
  return Array.from(map.values())
    .sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt))
    .slice(0, MAX_DRAFTS);
}

export function propertyDraftStorageKey(id) {
  return `${DRAFT_PREFIX}${encodeURIComponent(String(id || ''))}`;
}

export function readPropertyDraft(id) {
  if (typeof window === 'undefined' || !id) return null;
  return safeParse(window.localStorage.getItem(propertyDraftStorageKey(id)), null);
}

export function isPropertyDraftSaved(id) {
  return Boolean(readPropertyDraft(id));
}

export function readPropertyDrafts() {
  if (typeof window === 'undefined') return [];
  const ids = safeParse(window.localStorage.getItem(INDEX_KEY), []);
  if (!Array.isArray(ids)) return [];
  return ids.map((id) => readPropertyDraft(id)).filter(isPropertyDraftRecord).sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt));
}

export function replaceLocalPropertyDrafts(drafts) {
  if (typeof window === 'undefined') return [];
  const next = mergePropertyDraftRecords(drafts);
  const previousIds = safeParse(window.localStorage.getItem(INDEX_KEY), []);
  const nextIds = next.map((draft) => draft.id);
  for (const previousId of Array.isArray(previousIds) ? previousIds : []) {
    if (previousId && !nextIds.includes(previousId)) window.localStorage.removeItem(propertyDraftStorageKey(previousId));
  }
  for (const draft of next) window.localStorage.setItem(propertyDraftStorageKey(draft.id), JSON.stringify(draft));
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(nextIds));
  return next;
}

export function savePropertyDraft(draft) {
  if (typeof window === 'undefined') throw new Error('Property drafts can only be saved in the browser.');
  if (!draft?.id) throw new Error('This property does not have enough source identity to save yet.');

  const existing = readPropertyDraft(draft.id);
  const next = {
    ...draft,
    createdAt: existing?.createdAt || draft.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    blockchain: {
      ...(draft.blockchain || {}),
      minted: Boolean(existing?.blockchain?.minted || draft?.blockchain?.minted),
      optional: true,
    },
    world: {
      public: false,
      publishedAt: null,
      publicLabel: '3D Property',
      ...(existing?.world || {}),
      ...(draft?.world || {}),
    },
  };
  const merged = mergePropertyDraftRecords([next], readPropertyDrafts());
  replaceLocalPropertyDrafts(merged);
  window.dispatchEvent(new CustomEvent('voxel-vault:property-draft-saved', { detail: next }));
  return next;
}

export function setPropertyDraftWorldVisibility(id, visible) {
  if (typeof window === 'undefined' || !id) throw new Error('Open the saved property on this device first.');
  const existing = readPropertyDraft(id);
  if (!existing) throw new Error('Save this property to your Vault before sharing it on World.');
  const isPublic = visible === true;
  return savePropertyDraft({
    ...existing,
    world: {
      ...(existing.world || {}),
      public: isPublic,
      publishedAt: isPublic ? (existing.world?.publishedAt || new Date().toISOString()) : null,
      publicLabel: clean(existing.world?.publicLabel, '3D Property').slice(0, 60),
    },
  });
}

export function deletePropertyDraft(id) {
  if (typeof window === 'undefined' || !id) return;
  window.localStorage.removeItem(propertyDraftStorageKey(id));
  const ids = safeParse(window.localStorage.getItem(INDEX_KEY), []);
  const next = (Array.isArray(ids) ? ids : []).filter((item) => item !== id);
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(next));
}

export function exportPropertyDraft(draft) {
  if (typeof window === 'undefined' || !draft) return;
  const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = `voxel-vault-property-${String(draft.id || 'draft').replace(/[^a-zA-Z0-9_-]+/g, '-')}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}
