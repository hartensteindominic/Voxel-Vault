const KARTAVIEW_PHOTO_ENDPOINT = 'https://api.openstreetcam.org/2.0/photo/';
export const KARTAVIEW_TERMS_URL = 'https://kartaview.org/terms';
export const KARTAVIEW_LICENSE = 'CC BY-SA 4.0';

const clean = (value) => String(value ?? '').trim();
const finite = (value) => Number.isFinite(Number(value));

function clampCoordinate(value, min, max, label) {
  if (!finite(value)) throw new Error(`${label} is required.`);
  const number = Number(value);
  if (number < min || number > max) throw new Error(`${label} is outside its valid range.`);
  return number;
}

function clampRadius(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 120;
  return Math.max(30, Math.min(250, Math.round(number)));
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const values = [lat1, lon1, lat2, lon2].map(Number);
  if (!values.every(Number.isFinite)) return null;
  const toRad = (degrees) => degrees * Math.PI / 180;
  const dLat = toRad(values[2] - values[0]);
  const dLon = toRad(values[3] - values[1]);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(values[0])) * Math.cos(toRad(values[2])) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeImageUrl(value) {
  const raw = clean(value).replace('[[sizeprefix]]', 'wrapped_proc');
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return url.toString();
  } catch {
    return '';
  }
}

function angleDifference(a, b) {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 180;
  return Math.abs(((x - y + 540) % 360) - 180);
}

function normalizePhoto(item, latitude, longitude) {
  const imageUrl = normalizeImageUrl(item?.fileurlProc || item?.fileurl || item?.fileurlTh || item?.fileurlLTh);
  if (!imageUrl) return null;
  const lat = Number(item?.lat ?? item?.matchLat);
  const lng = Number(item?.lng ?? item?.matchLng);
  const id = clean(item?.id || item?.photoId);
  const sequenceId = clean(item?.sequenceId || item?.sequence?.id);
  const distanceMeters = Number.isFinite(lat) && Number.isFinite(lng) ? haversineMeters(latitude, longitude, lat, lng) : null;
  return {
    id: id || `${sequenceId || 'photo'}:${imageUrl.slice(-32)}`,
    sequenceId: sequenceId || null,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    distanceMeters: distanceMeters === null ? null : Number(distanceMeters.toFixed(1)),
    heading: finite(item?.heading) ? Number(item.heading) : null,
    fieldOfView: finite(item?.fieldOfView) ? Number(item.fieldOfView) : null,
    projection: clean(item?.projection) || null,
    shotDate: clean(item?.shotDate || item?.dateAdded) || null,
    imageUrl,
    thumbnailUrl: normalizeImageUrl(item?.fileurlTh || item?.fileurlLTh || item?.fileurlProc || item?.fileurl) || imageUrl,
    sourceUrl: 'https://kartaview.org/',
    provider: 'KartaView',
    attribution: 'KartaView contributors',
    license: KARTAVIEW_LICENSE,
    termsUrl: KARTAVIEW_TERMS_URL,
  };
}

function chooseDiverseViews(photos, maxViews = 4) {
  const sorted = [...photos].sort((a, b) => {
    const da = Number.isFinite(a.distanceMeters) ? a.distanceMeters : Number.MAX_SAFE_INTEGER;
    const db = Number.isFinite(b.distanceMeters) ? b.distanceMeters : Number.MAX_SAFE_INTEGER;
    return da - db;
  });
  const selected = [];
  for (const photo of sorted) {
    if (selected.length >= maxViews) break;
    const distinctHeading = selected.every((existing) => angleDifference(photo.heading, existing.heading) >= 28);
    const distinctSequence = !photo.sequenceId || selected.every((existing) => existing.sequenceId !== photo.sequenceId);
    if (!selected.length || distinctHeading || distinctSequence) selected.push(photo);
  }
  if (selected.length < Math.min(maxViews, sorted.length)) {
    for (const photo of sorted) {
      if (selected.length >= maxViews) break;
      if (!selected.some((item) => item.id === photo.id)) selected.push(photo);
    }
  }
  return selected;
}

export async function fetchOpenStreetImagery(input = {}, options = {}) {
  const latitude = clampCoordinate(input.latitude, -90, 90, 'Latitude');
  const longitude = clampCoordinate(input.longitude, -180, 180, 'Longitude');
  const radius = clampRadius(input.radiusMeters);
  const timeoutMs = Math.max(2000, Math.min(12000, Number(options.timeoutMs || 7000)));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL(KARTAVIEW_PHOTO_ENDPOINT);
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lng', String(longitude));
    url.searchParams.set('radius', String(radius));
    url.searchParams.set('zoomLevel', '18');
    url.searchParams.set('join', 'sequence');
    url.searchParams.set('orderBy', 'id');
    url.searchParams.set('orderDirection', 'desc');
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'VoxelVaultWorldAtlas/1.0' },
      next: { revalidate: 300 },
    });
    if (!response.ok) throw new Error(`KartaView returned HTTP ${response.status}.`);
    const payload = await response.json().catch(() => ({}));
    const raw = Array.isArray(payload?.result?.data) ? payload.result.data : [];
    const photos = chooseDiverseViews(raw.map((item) => normalizePhoto(item, latitude, longitude)).filter(Boolean), 4);
    return {
      ok: true,
      provider: 'KartaView',
      configured: true,
      requiresPaidKey: false,
      latitude,
      longitude,
      radiusMeters: radius,
      count: photos.length,
      photos,
      license: KARTAVIEW_LICENSE,
      attribution: 'KartaView contributors',
      termsUrl: KARTAVIEW_TERMS_URL,
      meshyReferences: photos.map((photo, index) => ({
        url: photo.imageUrl,
        rightsBasis: 'open-licensed',
        rightsReference: `KartaView ${KARTAVIEW_LICENSE}; photo ${photo.id}; ${KARTAVIEW_TERMS_URL}; derivative output must preserve applicable attribution/share-alike obligations.`,
        label: `KartaView open view ${index + 1}`,
        sourcePhotoId: photo.id,
        license: KARTAVIEW_LICENSE,
      })),
      note: photos.length
        ? 'Open street-level imagery found near this coordinate. Visual proximity does not prove that every frame depicts the selected parcel.'
        : 'No KartaView street imagery was returned near this coordinate. No replacement imagery was invented.',
    };
  } catch (error) {
    return {
      ok: false,
      provider: 'KartaView',
      configured: true,
      requiresPaidKey: false,
      latitude,
      longitude,
      radiusMeters: radius,
      count: 0,
      photos: [],
      meshyReferences: [],
      license: KARTAVIEW_LICENSE,
      attribution: 'KartaView contributors',
      termsUrl: KARTAVIEW_TERMS_URL,
      error: error?.name === 'AbortError' ? 'Open street imagery lookup timed out.' : clean(error?.message || error || 'Open street imagery lookup failed.'),
      note: 'Open imagery is optional; property identity and map geometry remain usable without it.',
    };
  } finally {
    clearTimeout(timer);
  }
}
