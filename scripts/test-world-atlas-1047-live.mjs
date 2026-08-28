import assert from 'node:assert/strict';
import { resolveBuffaloAtlasAnchor } from '../lib/real-estate/buffalo-atlas-anchor.js';

const result = await resolveBuffaloAtlasAnchor({
  sbl: '90.32-8-4',
  pin: '1402000903200008004000',
  address: '1047 Kensington Ave, Buffalo, NY 14215',
  radiusMeters: 180,
});

assert.equal(result?.ok, true, '1047 authoritative property anchor must resolve.');
assert.equal(result?.cityReference?.found, true, 'Live City of Buffalo layer must resolve 1047.');
assert.equal(result?.cityReference?.printKey, '90.32-8-4', '1047 must remain bound to exact City print key 90.32-8-4.');
assert.equal(result?.cityReference?.address, '1047 KENSINGTON', 'City source must identify 1047 KENSINGTON.');
assert.ok(result?.authoritativeEvidence?.twin, 'Live Erie County parcel evidence must be attached.');
assert.equal(result?.authoritativeEvidence?.countyRecord?.sbl, '90.32-8-4', 'County evidence must remain bound to exact SBL.');
assert.ok(result?.authoritativeEvidence?.twin?.location?.parcelGeometry, '1047 must have a jurisdiction parcel geometry even if a building layer is missing.');
assert.ok(Number.isFinite(Number(result?.anchor?.latitude)), 'Authoritative anchor must return latitude.');
assert.ok(Number.isFinite(Number(result?.anchor?.longitude)), 'Authoritative anchor must return longitude.');
assert.ok(Array.isArray(result?.atlas?.buildings), 'Atlas must always expose a bounded building array.');
assert.ok(result.atlas.buildings.length <= 36, '1047 region must preserve the iPhone building cap.');
assert.equal(result?.atlas?.rights?.digitalStewardshipOnly ?? true, true, 'Mapping 1047 must never create physical property rights.');
assert.equal(result?.legalEffects?.createsOwnership, false, 'Property anchor must not create ownership.');
assert.equal(result?.legalEffects?.createsTitle, false, 'Property anchor must not create title.');

const countyBuilding = result?.authoritativeEvidence?.twin?.structure?.buildingGeometry || null;
if (countyBuilding) {
  assert.equal(result.localBuildingStatus, 'parcel_linked_building', 'Exact county BUILDING geometry must be promoted as the selected local reference.');
  assert.ok(result.atlas.buildings.length > 0, 'A parcel-linked county building must appear in the atlas result.');
  assert.match(String(result.atlas.selectedBuilding?.source?.authority || ''), /Erie County/i, 'Selected exact local building must retain Erie County authority.');
  assert.equal(result.atlas.sourceStatus?.authoritativeLocal, true, 'Atlas must disclose that local jurisdiction geometry outranked global context.');
} else {
  assert.equal(result.localBuildingStatus, 'parcel_only', 'Without an exact county BUILDING join, 1047 must stay parcel-only rather than invent architecture.');
  assert.equal(result.atlas.sourceStatus?.authoritativeLocal === true, false, 'Parcel-only mode must not claim authoritative building geometry.');
}

console.log(JSON.stringify({
  check: 'live-1047-kensington-authoritative-atlas',
  parcel: result.cityReference.printKey,
  countySbl: result.authoritativeEvidence.countyRecord.sbl,
  address: result.cityReference.address,
  latitude: result.anchor.latitude,
  longitude: result.anchor.longitude,
  localBuildingStatus: result.localBuildingStatus,
  countyBuildingMatchStrategy: result.authoritativeEvidence.countyRecord.buildingMatchStrategy,
  atlasBuildingCount: result.atlas.buildings.length,
  globalContextError: result.atlasError || null,
}, null, 2));
console.log('Live 1047 Kensington authoritative property hierarchy passed.');
