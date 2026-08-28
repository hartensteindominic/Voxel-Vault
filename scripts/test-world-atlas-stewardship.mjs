import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  WORLD_STEWARDSHIP_POLICY,
  quoteWorldStewardship,
  worldStewardshipRegionId,
} from '../lib/world-stewardship.js';

const atlas = fs.readFileSync(new URL('../lib/world-atlas.js', import.meta.url), 'utf8');
const inspectRoute = fs.readFileSync(new URL('../app/api/world-atlas/inspect/route.ts', import.meta.url), 'utf8');
const quoteRoute = fs.readFileSync(new URL('../app/api/world-atlas/stewardship/quote/route.ts', import.meta.url), 'utf8');
const meshRoute = fs.readFileSync(new URL('../app/api/world-atlas/mesh/route.ts', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../app/vault/earth/page.js', import.meta.url), 'utf8');
const globe = fs.readFileSync(new URL('../app/vault/earth/GlobalEarthGlobe.js', import.meta.url), 'utf8');

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

assert.match(atlas, /WORLD_ATLAS_DATA_RELEASE = '2026-07-22\.0'/, 'world atlas should pin the reviewed Overture release');
assert.match(atlas, /progressive-region-streaming/, 'world atlas must stream regions rather than download the planet into the browser');
assert.match(atlas, /does not download the whole planet into the browser/i);
assert.match(atlas, /targetPolycount:\s*30_000/, 'Meshy hero policy should use the balanced 30k target');
assert.match(atlas, /textureResolution:\s*'2k'/, 'Meshy hero policy should use a mobile-conscious 2k texture target');
assert.match(atlas, /automaticGeneration:\s*false/, 'world browsing must not automatically spend Meshy credits');
assert.match(atlas, /geocodeGeoAddress/, 'text address searches must be able to enter the world atlas without a listing provider');
assert.match(atlas, /createsExclusiveMapDataOwnership:\s*false/, 'displaying world data must not create source-data monopoly rights');

assert.match(inspectRoute, /inspectWorldAtlas/, 'world atlas must have a real inspection API');
assert.match(quoteRoute, /quoteWorldStewardship/, 'stewardship quote must be server-derived');

assert.match(meshRoute, /requireVoxelVaultAdmin/, 'paid Meshy world generation must be owner/admin controlled');
assert.match(meshRoute, /MESHY_API_KEY/, 'Meshy key must stay server-side');
assert.match(meshRoute, /WORLD_ATLAS_MESH_POLICY\.targetPolycount/, 'Meshy route must use the reviewed target policy');
assert.match(meshRoute, /minLicensedReferenceImages/, 'Meshy must require multiple rights-cleared references');
assert.match(meshRoute, /google\.com|zillow\.com|redfin\.com|apartments\.com/, 'common proprietary imagery hosts must be blocked from the Meshy derivative route');
assert.match(meshRoute, /persistModelBinary/, 'completed Meshy GLBs should be cached into Voxel Vault storage');

assert.match(page, /WORLD BUILDING ATLAS/, 'Earth UI must expose the map-building atlas separately from listings');
assert.match(page, /ANTI-MONOPOLY STEWARDSHIP/, 'Earth UI must explain anti-concentration economics');
assert.match(page, /not a government tax/i, 'platform stewardship fee must not masquerade as a government tax');
assert.match(page, /linear, not exponential/i, 'the UI must explain the requested linear schedule');
assert.match(page, /WHO OWNS THE WORLD MAP\?/, 'Earth UI must answer map ownership clearly');
assert.match(page, /Voxel Vault can own the atlas product—not the Earth/, 'platform moat must not be described as owning the physical world');
assert.match(page, /MESHY · THE PERFECT AMOUNT/, 'Earth UI should expose the selective Meshy strategy');
assert.match(page, /atlasBuildings=\{atlasBuildings\}/, 'atlas buildings must actually be passed into the globe');
assert.match(page, /onAtlasSelect=\{setSelectedAtlasId\}/, 'globe atlas markers must be selectable');
assert.match(page, /GeoReferenceModel/, 'selected world buildings should use the real GEO voxel renderer');

assert.match(globe, /atlasId/, 'globe must render source-backed atlas building markers');
assert.match(globe, /onAtlasSelectRef/, 'atlas marker taps must be handled separately from listing markers');
assert.match(globe, /1\.25/, 'world globe should retain a mobile-conscious pixel-ratio cap');
assert.match(globe, /time - lastRender < 33/, 'compact world globe should cap dense rendering near 30fps');

console.log('World atlas stewardship checks passed: progressive real-map coverage, selective cached Meshy hero generation, linear anti-concentration pricing, hard regional caps, no owner exemption, and no false physical/map ownership claims.');