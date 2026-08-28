import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  WORLD_STEWARDSHIP_POLICY,
  quoteWorldStewardship,
  worldStewardshipRegionId,
} from '../lib/world-stewardship.js';

const atlas = fs.readFileSync(new URL('../lib/world-atlas.js', import.meta.url), 'utf8');
const overture = fs.readFileSync(new URL('../lib/overture-building-tiles.js', import.meta.url), 'utf8');
const inspectRoute = fs.readFileSync(new URL('../app/api/world-atlas/inspect/route.ts', import.meta.url), 'utf8');
const quoteRoute = fs.readFileSync(new URL('../app/api/world-atlas/stewardship/quote/route.ts', import.meta.url), 'utf8');
const meshRoute = fs.readFileSync(new URL('../app/api/world-atlas/mesh/route.ts', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../app/vault/earth/page.js', import.meta.url), 'utf8');
const anchor = fs.readFileSync(new URL('../lib/real-estate/buffalo-atlas-anchor.js', import.meta.url), 'utf8');
const globeController = fs.readFileSync(new URL('../app/vault/earth/GlobalEarthGlobe.js', import.meta.url), 'utf8');
const planetGlobe = fs.readFileSync(new URL('../app/vault/earth/PlanetStreamGlobe.js', import.meta.url), 'utf8');

assert.equal(WORLD_STEWARDSHIP_POLICY.ownerOrAdminExemption, false, 'owner/admin accounts must not bypass anti-concentration policy');
assert.equal(WORLD_STEWARDSHIP_POLICY.billingEnabled, false, 'stewardship billing must remain disabled until an authoritative claim ledger exists');
assert.equal(WORLD_STEWARDSHIP_POLICY.regionalClaimCapPerAccount, 20, 'local concentration must have a hard cap');

const q0 = quoteWorldStewardship({ existingGlobalClaims: 0, existingRegionalClaims: 0 });
const q1 = quoteWorldStewardship({ existingGlobalClaims: 1, existingRegionalClaims: 0 });
const q2 = quoteWorldStewardship({ existingGlobalClaims: 2, existingRegionalClaims: 0 });
assert.equal(q0.nextClaimAnnualCents, 100, 'first stewardship quote should start at $1/year');
assert.equal(q1.nextClaimAnnualCents - q0.nextClaimAnnualCents, 25, 'global marginal increase must be linear');
assert.equal(q2.nextClaimAnnualCents - q1.nextClaimAnnualCents, 25, 'global marginal increase must stay linear, not exponential');

const r0 = quoteWorldStewardship({ existingGlobalClaims: 0, existingRegionalClaims: 0 });
const r1 = quoteWorldStewardship({ existingGlobalClaims: 0, existingRegionalClaims: 1 });
const r2 = quoteWorldStewardship({ existingGlobalClaims: 0, existingRegionalClaims: 2 });
assert.equal(r1.nextClaimAnnualCents - r0.nextClaimAnnualCents, 75, 'regional marginal increase must be linear');
assert.equal(r2.nextClaimAnnualCents - r1.nextClaimAnnualCents, 75, 'regional marginal increase must remain constant');
assert.equal(quoteWorldStewardship({ existingGlobalClaims: 10, existingRegionalClaims: 3 }).nextClaimAnnualCents, 575);

const blocked = quoteWorldStewardship({ existingGlobalClaims: 25, existingRegionalClaims: 20 });
assert.equal(blocked.allowed, false, 'regional cap must actually block another digital stewardship claim');
assert.match(blocked.blockers.join(' '), /Local concentration cap/i);
assert.equal(blocked.rightsEffect.createsPhysicalPropertyOwnership, false);
assert.equal(blocked.rightsEffect.createsGovernmentTaxObligation, false);
assert.equal(blocked.rightsEffect.grantsExclusiveMapDataOwnership, false);

const regionA = worldStewardshipRegionId(42.912, -78.812);
const regionB = worldStewardshipRegionId(42.913, -78.813);
assert.ok(regionA.startsWith('atlas:0.05:'), 'regional anti-concentration grid must be deterministic and explicit');
assert.equal(regionA, regionB, 'nearby points clearly inside the same grid cell should share the same concentration region');

assert.match(overture, /DEFAULT_RELEASE = '2026-07-22\.0'/, 'world atlas should pin reviewed Overture release');
assert.match(atlas, /progressive-region-streaming/, 'world atlas must stream regions rather than download the planet');
assert.match(atlas, /does not download the whole planet into the browser/i);
assert.match(atlas, /provider:\s*'Meshy 7'/, 'hero generation provider should be explicit');
assert.match(atlas, /aiModel:\s*'meshy-7'/, 'hero generation should pin Meshy 7');
assert.match(atlas, /targetPolycount:\s*30_000/, 'Meshy hero policy should use balanced 30k target');
assert.match(atlas, /textureResolution:\s*'2k'/, 'Meshy hero policy should use mobile-conscious 2k textures');
assert.match(atlas, /automaticGeneration:\s*false/, 'world browsing must not automatically spend Meshy credits');
assert.match(atlas, /createsExclusiveMapDataOwnership:\s*false/, 'displaying world data must not create source-data monopoly rights');
assert.match(atlas, /fetchOvertureBuildingNeighborhood/, 'Overture building tiles must remain global path');
assert.match(atlas, /openstreetmap-overpass/, 'Overpass must remain explicit fallback');
assert.match(atlas, /No replacement building was invented/, 'global-source failure must fail honest');

assert.match(inspectRoute, /inspectWorldAtlas/, 'world atlas must have real inspection API');
assert.match(inspectRoute, /maxDuration = 30/, 'global tile lookup must have bounded server runtime');
assert.match(quoteRoute, /quoteWorldStewardship/, 'stewardship quote must remain server-derived');

assert.match(meshRoute, /requireVoxelVaultAdmin/, 'paid Meshy world generation must be owner/admin controlled');
assert.match(meshRoute, /MESHY_API_KEY/, 'Meshy key must stay server-side');
assert.match(meshRoute, /WORLD_ATLAS_MESH_POLICY\.targetPolycount/, 'Meshy route must use reviewed target policy');
assert.match(meshRoute, /WORLD_ATLAS_MESH_POLICY\.aiModel/, 'Meshy route must use pinned model policy');
assert.match(meshRoute, /minLicensedReferenceImages/, 'Meshy must require multiple rights-cleared references');
for (const blockedHostToken of ['google\\.com', 'zillow\\.com', 'redfin\\.com', 'apartments\\.com']) {
  assert.ok(meshRoute.includes(blockedHostToken), `Meshy derivative route must block ${blockedHostToken.replace('\\.', '.')}`);
}
assert.match(meshRoute, /BLOCKED_REFERENCE_HOSTS\.test\(host\)/, 'Meshy route must enforce blocked hosts');
assert.match(meshRoute, /persistModelBinary/, 'completed Meshy GLBs should be cached into Voxel Vault storage');
assert.match(meshRoute, /createModelSignedUrl/, 'cached private Meshy GLBs must use expiring signed URLs');

assert.match(page, /WORLD BUILDING ATLAS/, 'Earth UI must expose map-building atlas separately from listings');
assert.match(page, /ANTI-MONOPOLY STEWARDSHIP/, 'Earth UI must explain anti-concentration economics');
assert.match(page, /linear, not exponential/i, 'UI must explain requested linear schedule');
assert.match(page, /WHO OWNS THE WORLD MAP\?/, 'Earth UI must answer map ownership clearly');
assert.match(page, /Voxel Vault can own the atlas product—not the Earth/, 'platform moat must not be described as owning physical world');
assert.match(page, /MESHY · THE PERFECT AMOUNT/, 'Earth UI should expose selective Meshy strategy');
assert.match(page, /atlasBuildings=\{atlasBuildings\}/, 'atlas buildings must actually be passed into globe');
assert.match(page, /onAtlasSelect=\{chooseAtlas\}/, 'globe atlas markers must remain selectable');
assert.match(page, /GeoReferenceModel/, 'selected world buildings should use GEO renderer');
assert.match(page, /MeshyHeroPanel/, 'selected buildings must expose controlled Meshy workflow');
assert.match(anchor, /createsGovernmentTax:\s*false/, 'jurisdiction map anchoring must never create a government tax');
assert.match(anchor, /createsExclusiveMapDataOwnership:\s*false/, 'local anchoring must not create exclusive source-map ownership');

assert.match(globeController, /atlasId/, 'globe controller must retain source-backed atlas building identities');
assert.match(globeController, /const local = atlasBuildings\.find/, 'local detailed atlas markers must be selected through the detailed atlas callback');
assert.match(globeController, /onAtlasSelect\?\.\(atlasId\)/, 'local atlas selection must remain distinct from listing selection');
assert.match(globeController, /const streamed = streamedRef\.current\.find/, 'streamed atlas markers must be handled separately from local detailed atlas markers');
assert.match(globeController, /onLocation\?\.\(\{ latitude:/, 'streamed marker selection must deepen through the normal geographic evidence lookup');
assert.match(planetGlobe, /listingHit[\s\S]*listingId/, 'listing markers must retain a separate selection path');
assert.match(planetGlobe, /atlasHit[\s\S]*atlasId/, 'atlas markers must retain a separate selection path');
assert.match(planetGlobe, /compact \? 1\.15 : 1\.35/, 'world globe should retain strict compact pixel-ratio cap');
assert.match(planetGlobe, /time - lastRender < 33/, 'compact world globe should cap dense rendering near 30fps');
assert.match(planetGlobe, /prefers-reduced-motion/, 'world globe must respect reduced motion');

console.log('World atlas stewardship checks passed: global streaming + local authority, separate listing/atlas marker selection, fail-closed sources, selective Meshy 7, linear anti-concentration pricing, hard regional caps, no owner exemption, and no false physical/map ownership claims.');
