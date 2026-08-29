import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const worker = read('app/api/image-to-3d/route.js');
const cron = read('app/api/cron/catalog-3d/route.js');

assert.match(worker, /process\.env\.CRON_SECRET/, 'catalog Meshy worker must require CRON_SECRET');
assert.ok((worker.match(/if \(!authorized\(request\)\)/g) || []).length >= 2, 'catalog Meshy worker must authenticate both POST and GET');
assert.match(worker, /REAL_WORLD_CATALOG/, 'catalog Meshy worker must resolve items from the trusted repository catalog');
assert.match(worker, /trustedCatalogItem/, 'catalog Meshy worker must reject arbitrary caller-supplied catalog objects');
assert.doesNotMatch(worker, /requestedImageUrl|body\?\.imageUrl/, 'catalog Meshy worker must not accept arbitrary public image URLs');
assert.doesNotMatch(worker, /scrapeProductImage\(item\?\.sourceUrl \|\| ''\).*body/s, 'catalog worker source fetches must come from the trusted catalog item');

assert.match(cron, /process\.env\.CRON_SECRET/, 'catalog cron must require CRON_SECRET');
assert.doesNotMatch(cron, /vercel-cron|user-agent/i, 'catalog cron must never authenticate by spoofable user-agent');
assert.match(cron, /Catalog cron is not configured/, 'catalog cron must fail closed when CRON_SECRET is missing');
assert.match(cron, /authorization:\s*authHeader/, 'catalog cron must forward its secret to internal Meshy worker calls');
assert.match(cron, /headers:\s*internalHeaders/, 'catalog polling must forward authorization too');
assert.match(cron, /JSON\.stringify\(\{ itemId: item\.id/, 'catalog cron must send only trusted item ids rather than caller-controlled item objects');

console.log('Catalog worker security guard passed: metered Meshy generation is secret-authenticated, catalog-bound, and no longer accepts arbitrary source/image URLs.');
