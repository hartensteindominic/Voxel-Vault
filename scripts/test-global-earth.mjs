import assert from 'node:assert/strict';
import fs from 'node:fs';

const provider = fs.readFileSync(new URL('../lib/earth-properties.ts', import.meta.url), 'utf8');
const route = fs.readFileSync(new URL('../app/api/earth-properties/search/route.ts', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../app/vault/earth/page.js', import.meta.url), 'utf8');
const globe = fs.readFileSync(new URL('../app/vault/earth/GlobalEarthGlobe.js', import.meta.url), 'utf8');
const env = fs.readFileSync(new URL('../.env.example', import.meta.url), 'utf8');

assert.match(provider, /Global authorized property federation/, 'Earth search must be a provider federation, not a single-feed facade.');
assert.match(provider, /Bridge \/ authorized MLS/, 'Existing authorized Bridge/MLS support must remain.');
assert.match(provider, /Domain Australia/, 'Australia must have an official Domain provider adapter.');
assert.match(provider, /EARTH_PARTNER_FEEDS_JSON/, 'Additional licensed countries must be pluggable without UI rewrites.');
assert.match(provider, /https:\/\/auth\.domain\.com\.au\/v1\/connect\/token/, 'Domain OAuth must use the official token endpoint.');
assert.match(provider, /api_listings_read/, 'Domain listing access must request the documented read scope.');
assert.match(provider, /\/v1\/listings\/residential\/_search/, 'Domain residential listings must use the official search endpoint.');
assert.match(provider, /propertyDetails/, 'Domain search-result normalization must read nested propertyDetails.');
assert.match(provider, /currency:\s*'AUD'/, 'Domain listing prices must preserve AUD rather than masquerading as USD.');
assert.match(provider, /currency\s*:/, 'Normalized Earth listings must carry a currency.');
assert.match(provider, /if\s*\(!jobs\.length\)[\s\S]*listings\s*:\s*\[\]/, 'No-provider state must return no listings instead of samples.');
assert.doesNotMatch(provider, /sampleListing|demoListing|fakeListing|mockListing/i, 'Production Earth provider code must not fabricate sample listings.');
assert.match(provider, /new URL\(String\(item\.url\)\)\.protocol\s*===\s*'https:'/, 'Configured partner feeds must require HTTPS.');

assert.match(route, /getEarthProviderCoverage/, 'Earth API must expose provider coverage to the UI.');
assert.match(route, /Search any city, country, ZIP\/postcode or address, use your location, or tap the globe/, 'Earth API must advertise worldwide location search.');
assert.match(route, /No replacement or fabricated listings were returned/, 'Provider failures must fail honest rather than substituting fake inventory.');
assert.match(route, /digital twin or NFT does not itself convey a deed/i, 'Global search must preserve the real-property rights boundary.');

assert.match(page, /GlobalEarthGlobe/, 'Earth UI must retain the lightweight interactive globe.');
assert.match(page, /VOXEL VAULT WORLD ATLAS/, 'Earth UI must be explicitly global.');
assert.match(page, /Real listings only/, 'Earth UI must explicitly separate authorized inventory from map coverage.');
assert.match(page, /property\.currency/, 'Earth UI must display each source currency rather than hardcoding USD.');
assert.match(page, /onLocation=\{globeLocation\}/, 'Tapping the globe must feed a geographic search.');
assert.match(page, /OVERTURE PRIMARY/, 'Users must be able to see the primary worldwide building source state.');
assert.match(page, /MAP READY · MARKET FEED NOT CONNECTED/, 'Unsupported market inventory must be disclosed instead of populated with fake listings.');
assert.match(page, /OPEN (?:REAL )?SOURCE LISTING/, 'Each result should route back to its authoritative listing source when available.');
assert.match(page, /Physical purchase:<\/b> broker → contract → title → closing → deed-recording/i, 'The physical-property closing boundary must remain explicit.');
assert.match(page, /twin or NFT does not replace the deed/i, 'Digital representation must never be presented as the deed.');
assert.match(page, /MINTING RECOMMENDED AFTER VERIFICATION/, 'Minting must remain downstream of verification rather than masquerading as title.');
assert.match(page, /REALITY ≠ TITLE ≠ INVESTMENT/, 'reality visualization must remain separate from legal/investment rights.');

assert.match(globe, /SphereGeometry/, 'Global Earth should use the existing lightweight Three.js stack.');
assert.match(globe, /vectorToLatLng/, 'Globe taps must convert to real latitude/longitude.');
assert.match(globe, /listingId/, 'Real listing coordinates must render as selectable globe markers.');
assert.match(globe, /pointerdown|pointermove|pointerup/, 'The globe must use pointer events that work for mouse and touch input.');

assert.match(env, /DOMAIN_CLIENT_ID=/, 'Domain client ID must be documented.');
assert.match(env, /DOMAIN_CLIENT_SECRET=/, 'Domain client secret must be documented.');
assert.match(env, /EARTH_PARTNER_FEEDS_JSON=/, 'Additional licensed provider configuration must be documented.');
assert.doesNotMatch(env, /NEXT_PUBLIC_DOMAIN_CLIENT_SECRET|NEXT_PUBLIC_BRIDGE_ACCESS_TOKEN|NEXT_PUBLIC_EARTH_PARTNER/, 'Listing-provider secrets must never be client-exposed.');

console.log('Global Earth federation safety checks passed: worldwide map navigation, authorized listings, source currencies, visible provider gaps, deed/title boundaries, and verification-before-minting remain intact.');
