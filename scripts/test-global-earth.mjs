import assert from 'node:assert/strict';
import fs from 'node:fs';

const provider = fs.readFileSync(new URL('../lib/earth-properties.ts', import.meta.url), 'utf8');
const route = fs.readFileSync(new URL('../app/api/earth-properties/search/route.ts', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../app/vault/earth/page.js', import.meta.url), 'utf8');
const globeController = fs.readFileSync(new URL('../app/vault/earth/GlobalEarthGlobe.js', import.meta.url), 'utf8');
const planetGlobe = fs.readFileSync(new URL('../app/vault/earth/PlanetStreamGlobe.js', import.meta.url), 'utf8');
const streamRoute = fs.readFileSync(new URL('../app/api/world-atlas/stream/route.ts', import.meta.url), 'utf8');
const streamLib = fs.readFileSync(new URL('../lib/world-atlas-tile-stream.js', import.meta.url), 'utf8');
const env = fs.readFileSync(new URL('../.env.example', import.meta.url), 'utf8');

assert.match(provider, /Global authorized property federation/, 'Earth search must be a provider federation, not a single-feed facade.');
assert.match(provider, /Bridge \/ authorized MLS/, 'Existing authorized Bridge/MLS support must remain.');
assert.match(provider, /Domain Australia/, 'Australia must have an official Domain provider adapter.');
assert.match(provider, /EARTH_PARTNER_FEEDS_JSON/, 'Additional licensed countries must be pluggable without UI rewrites.');
assert.match(provider, /https:\/\/auth\.domain\.com\.au\/v1\/connect\/token/, 'Domain OAuth must use official token endpoint.');
assert.match(provider, /api_listings_read/, 'Domain listing access must request read scope.');
assert.match(provider, /\/v1\/listings\/residential\/_search/, 'Domain residential listings must use official search endpoint.');
assert.match(provider, /propertyDetails/, 'Domain normalization must read nested propertyDetails.');
assert.match(provider, /currency:\s*'AUD'/, 'Domain listing prices must preserve AUD.');
assert.match(provider, /currency\s*:/, 'Normalized Earth listings must carry currency.');
assert.match(provider, /if\s*\(!jobs\.length\)[\s\S]*listings\s*:\s*\[\]/, 'No-provider state must return no listings instead of samples.');
assert.doesNotMatch(provider, /sampleListing|demoListing|fakeListing|mockListing/i, 'Production Earth provider code must not fabricate samples.');
assert.match(provider, /new URL\(String\(item\.url\)\)\.protocol\s*===\s*'https:'/, 'Configured partner feeds must require HTTPS.');

assert.match(route, /getEarthProviderCoverage/, 'Earth API must expose provider coverage.');
assert.match(route, /Search any city, country, ZIP\/postcode or address, use your location, or tap the globe/, 'Earth API must advertise worldwide location search.');
assert.match(route, /No replacement or fabricated listings were returned/, 'Provider failures must fail honest.');
assert.match(route, /digital twin or NFT does not itself convey a deed/i, 'Global search must preserve property-rights boundary.');

assert.match(page, /GlobalEarthGlobe/, 'Earth UI must retain interactive global navigation.');
assert.match(page, /VOXEL VAULT WORLD ATLAS/, 'Earth UI must be explicitly global.');
assert.match(page, /Listings are not fabricated/, 'Earth UI must explicitly separate authorized inventory from map coverage.');
assert.match(page, /property\.currency/, 'Earth UI must display source currency rather than hardcoding USD.');
assert.match(page, /onLocation=\{globeLocation\}/, 'Tapping globe must feed geographic search.');
assert.match(page, /OVERTURE PRIMARY/, 'Users must be able to see global primary-source state.');
assert.match(page, /MAP READY · MARKET FEED NOT CONNECTED/, 'Unsupported market inventory must be disclosed.');
assert.match(page, /OPEN SOURCE LISTING/, 'Each market result should route back to authoritative listing source when available.');
assert.match(page, /real-property acquisition still requires the normal broker\/contract, title, closing and recording process/i, 'Physical-property closing boundary must remain explicit.');
assert.match(page, /digital twin does not replace the deed/i, 'Digital representation must never be presented as the deed.');
assert.match(page, /VERIFY OWNER · CREATE PROPERTY PASSPORT/, 'Verification must remain downstream/upstream of digital property workflows.');
assert.match(page, /REALITY ≠ TITLE ≠ INVESTMENT/, 'reality visualization must remain separate from legal/investment rights.');

assert.match(planetGlobe, /SphereGeometry/, 'Global Earth should use lightweight Three.js stack.');
assert.match(planetGlobe, /vectorToLatLng/, 'Globe taps must convert to real latitude/longitude.');
assert.match(planetGlobe, /listingId/, 'Real listing coordinates must render as selectable globe markers.');
assert.match(planetGlobe, /pointerdown|pointermove|pointerup/, 'Globe must use pointer events for mouse/touch.');
assert.match(planetGlobe, /onViewport/, 'Settled globe movement must be able to request the visible region.');
assert.match(globeController, /MAX_STREAMED_BUILDINGS = 420/, 'Worldwide exploration must cap accumulated client markers.');
assert.match(globeController, /MAX_VISITED_REGIONS = 96/, 'Worldwide exploration must cap visited-region memory.');
assert.match(globeController, /streamed globe markers are fast map references only/i, 'streamed marker selection must deepen through the normal evidence workflow.');
assert.match(globeController, /REGIONS VISITED/, 'globe should expose in-session region coverage rather than pretending all Earth data is loaded locally');
assert.match(globeController, /STREAMED MAP BUILDINGS/, 'globe should label streamed buildings as map references');
assert.match(globeController, /DETAILED LOCAL BUILDINGS/, 'globe should distinguish detailed local lookup results from fast streamed references');
assert.match(globeController, /MAP REFERENCE · NOT TITLE/, 'coverage HUD must keep map coverage legally separate from title');
assert.doesNotMatch(globeController, /OWNED PROPERTIES|VERIFIED HOUSES|DEEDS LOADED/i, 'coverage telemetry must never convert map references into ownership or verification claims');
assert.match(streamRoute, /s-maxage=300/, 'Visible-region streaming should use a bounded shared cache.');
assert.match(streamLib, /global-on-demand/, 'World atlas streaming must describe itself as global on-demand coverage.');
assert.match(streamLib, /createsOwnership:\s*false/, 'Streaming map markers must never create ownership.');
assert.match(streamLib, /createsTitle:\s*false/, 'Streaming map markers must never create title.');

assert.match(env, /DOMAIN_CLIENT_ID=/, 'Domain client ID must be documented.');
assert.match(env, /DOMAIN_CLIENT_SECRET=/, 'Domain client secret must be documented.');
assert.match(env, /EARTH_PARTNER_FEEDS_JSON=/, 'Additional licensed provider config must be documented.');
assert.doesNotMatch(env, /NEXT_PUBLIC_DOMAIN_CLIENT_SECRET|NEXT_PUBLIC_BRIDGE_ACCESS_TOKEN|NEXT_PUBLIC_EARTH_PARTNER/, 'Listing-provider secrets must never be client-exposed.');

console.log('Global Earth federation safety checks passed: worldwide streamed navigation, honest coverage HUD, authorized listings, source currencies, visible provider gaps, bounded map references, deed/title boundaries, and verification-first digital twins remain intact.');
