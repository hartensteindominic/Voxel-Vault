import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const app=path.join(root,'app');
const routeExts=new Set(['.js','.jsx','.ts','.tsx']);
const failures=[];
const publicPages=[];
const apiRoutes=[];

function walk(dir){
 const entries=fs.readdirSync(dir,{withFileTypes:true});
 const routeGroups=new Map();
 for(const entry of entries){
  const full=path.join(dir,entry.name);
  if(entry.isDirectory()){walk(full);continue;}
  const ext=path.extname(entry.name);
  const base=path.basename(entry.name,ext);
  if(routeExts.has(ext)&&['page','route'].includes(base)){
   const items=routeGroups.get(base)||[];items.push(entry.name);routeGroups.set(base,items);
   const rel=path.relative(app,full).replaceAll(path.sep,'/');
   if(base==='page')publicPages.push(rel);else apiRoutes.push(rel);
  }
 }
 for(const [base,items] of routeGroups){
  if(items.length>1)failures.push(`Duplicate ${base} files in ${path.relative(root,dir)}: ${items.join(', ')}`);
 }
}
walk(app);

for(const required of [
 'app/page.js',
 'app/studio/page.js',
 'app/pack/success/page.tsx',
 'app/voxelflip/mint/page.js',
 'app/voxelflip/autopilot/page.js',
 'app/voxelflip/factory/page.js',
 'app/admin/neural-core/page.js',
 'app/admin/neural-core/list/page.js',
 'app/admin/neural-core/setup/page.js',
 'app/admin/neural-core/whatsapp/page.js',
 'app/api/image-to-3d/route.js',
 'app/api/cron/catalog-3d/route.js',
 'app/api/voxelflip/trader/route.ts',
 'app/api/voxelflip/factory/route.ts',
 'app/api/admin/neural-core/route.ts',
 'app/api/admin/neural-core/listing-actions/route.ts',
 'app/api/admin/neural-core/setup/route.ts',
 'app/api/admin/neural-core/whatsapp/route.ts',
 'app/api/whatsapp/webhook/route.ts',
 'app/api/cron/neural-core/route.ts',
 'app/api/creator-pack/nft/confirm/route.ts',
 'lib/voxelflip-deployment.ts',
 'lib/whatsapp-cloud.ts',
 'lib/voxelflip-control-actions.ts',
 'supabase/migrations/013_voxelflip_whatsapp_control.sql',
]){
 if(!fs.existsSync(path.join(root,required)))failures.push(`Missing critical VoxelPop/VoxelFlip route: ${required}`);
}

const criticalSources=[
 'app/voxelflip/autopilot/page.js',
 'app/voxelflip/factory/page.js',
 'app/api/voxelflip/trader/route.ts',
 'app/api/voxelflip/factory/route.ts',
 'app/admin/neural-core/page.js',
 'app/admin/neural-core/list/page.js',
 'app/admin/neural-core/setup/page.js',
 'app/admin/neural-core/whatsapp/page.js',
 'app/api/admin/neural-core/route.ts',
 'app/api/admin/neural-core/listing-actions/route.ts',
 'app/api/admin/neural-core/setup/route.ts',
 'app/api/admin/neural-core/whatsapp/route.ts',
 'app/api/whatsapp/webhook/route.ts',
 'app/api/cron/neural-core/route.ts',
 'lib/voxelflip-neural-core.ts',
 'lib/whatsapp-cloud.ts',
 'lib/voxelflip-control-actions.ts',
];
for(const rel of criticalSources){
 const text=fs.readFileSync(path.join(root,rel),'utf8');
 if(/automaticSigningActive\s*[:=]\s*true/.test(text))failures.push(`${rel} enables automatic signing directly.`);
 if(/automaticFactoryActive\s*[:=]\s*true/.test(text))failures.push(`${rel} enables the Factory directly.`);
 if(/automaticListingActive\s*[:=]\s*true/.test(text))failures.push(`${rel} enables automatic listing directly.`);
 if(/automaticBuyingActive\s*[:=]\s*true/.test(text))failures.push(`${rel} enables automatic buying directly.`);
}

const deploymentSource=fs.readFileSync(path.join(root,'lib/voxelflip-deployment.ts'),'utf8');
if(!deploymentSource.includes('0xa00758b05f96ef4409d97c3ffebb6794b2eafbde'))failures.push('VoxelFlip production deployment is not pinned to the reviewed Base contract.');
if(!deploymentSource.includes('matchesVerifiedProduction'))failures.push('VoxelFlip stored deployment metadata is not gated against the reviewed production deployment.');
if(!deploymentSource.includes('Ignoring untrusted VoxelFlip deployment.json'))failures.push('VoxelFlip deployment resolver does not fail closed on a conflicting stored deployment.');
if(/return\s+envFallback\s*\(/.test(deploymentSource)||/envFallback\s*\(\)\s*\|\|/.test(deploymentSource))failures.push('VoxelFlip production contract may not be selected from a mutable environment fallback.');

const adminApi=fs.readFileSync(path.join(root,'app/api/admin/neural-core/route.ts'),'utf8');
if(!adminApi.includes('requireNeuralCoreAdmin'))failures.push('Neural Core admin API is missing server-side admin authentication.');
const listingApi=fs.readFileSync(path.join(root,'app/api/admin/neural-core/listing-actions/route.ts'),'utf8');
if(!listingApi.includes('requireNeuralCoreAdmin'))failures.push('Listing Assistant API is missing server-side admin authentication.');
if(!listingApi.includes('6352211e'))failures.push('Listing Assistant must verify ERC-721 ownerOf on Base before preparing a listing.');
const setupApi=fs.readFileSync(path.join(root,'app/api/admin/neural-core/setup/route.ts'),'utf8');
if(!setupApi.includes('requireNeuralCoreAdmin'))failures.push('Neural Core setup status is missing server-side admin authentication.');
if(!setupApi.includes('voxelflip_profit_ledger')||!setupApi.includes('voxelflip_neural_memory'))failures.push('Neural Core setup must verify both private database tables.');
const whatsappAdminApi=fs.readFileSync(path.join(root,'app/api/admin/neural-core/whatsapp/route.ts'),'utf8');
if(!whatsappAdminApi.includes('requireNeuralCoreAdmin'))failures.push('WhatsApp control setup API is missing server-side admin authentication.');
const whatsappWebhook=fs.readFileSync(path.join(root,'app/api/whatsapp/webhook/route.ts'),'utf8');
if(!whatsappWebhook.includes('whatsappWebhookSignatureValid'))failures.push('WhatsApp webhook must verify Meta x-hub-signature-256 before processing controls.');
if(!whatsappWebhook.includes('whatsappSenderAuthorized'))failures.push('WhatsApp webhook must restrict controls to the configured approver phone.');
if(!whatsappWebhook.includes('decideControlAction'))failures.push('WhatsApp webhook must use single-use stored control decisions.');
if(/eth_sendTransaction|eth_signTypedData|personal_sign|signTypedData\s*\(/.test(whatsappWebhook))failures.push('WhatsApp webhook may not sign or broadcast blockchain actions.');
const whatsappLib=fs.readFileSync(path.join(root,'lib/whatsapp-cloud.ts'),'utf8');
if(!whatsappLib.includes('WHATSAPP_APPROVER_NUMBER'))failures.push('WhatsApp approver number must come from server environment configuration.');
if(/7163593694/.test(whatsappLib)||/7163593694/.test(whatsappWebhook))failures.push('A personal phone number was hardcoded into the public repository.');
const controlMigration=fs.readFileSync(path.join(root,'supabase/migrations/013_voxelflip_whatsapp_control.sql'),'utf8');
if(!controlMigration.includes('revoke all on table public.voxelflip_control_actions from anon, authenticated'))failures.push('WhatsApp control actions must remain server-only.');
const listingPage=fs.readFileSync(path.join(root,'app/admin/neural-core/list/page.js'),'utf8');
if(/eth_sendTransaction|eth_signTypedData|personal_sign|signTypedData\s*\(/.test(listingPage))failures.push('Listing Assistant may not sign or broadcast wallet actions until the live OpenSea action parser is separately verified.');
const adminAuth=fs.readFileSync(path.join(root,'lib/neural-core-auth.ts'),'utf8');
if(!adminAuth.includes('NEURAL_CORE_ADMIN_EMAILS')&&!adminAuth.includes('NEURAL_CORE_ADMIN_USER_IDS'))failures.push('Neural Core admin auth has no explicit allowlist.');

const catalogWorker=fs.readFileSync(path.join(root,'app/api/image-to-3d/route.js'),'utf8');
if(!catalogWorker.includes('process.env.CRON_SECRET'))failures.push('Catalog Meshy worker must require CRON_SECRET.');
if((catalogWorker.match(/if \(!authorized\(request\)\)/g)||[]).length<2)failures.push('Catalog Meshy worker must authenticate both POST and GET.');
if(!catalogWorker.includes('REAL_WORLD_CATALOG')||!catalogWorker.includes('trustedCatalogItem'))failures.push('Catalog Meshy worker must bind generation to the trusted repository catalog.');
if(/requestedImageUrl|body\?\.imageUrl/.test(catalogWorker))failures.push('Catalog Meshy worker may not accept an arbitrary caller-supplied image URL.');
const catalogCron=fs.readFileSync(path.join(root,'app/api/cron/catalog-3d/route.js'),'utf8');
if(!catalogCron.includes('process.env.CRON_SECRET'))failures.push('Catalog cron must require CRON_SECRET.');
if(/user-agent|vercel-cron/i.test(catalogCron))failures.push('Catalog cron may not trust a spoofable User-Agent.');
if(!/authorization:\s*authHeader/.test(catalogCron)||!/headers:\s*internalHeaders/.test(catalogCron))failures.push('Catalog cron must forward authorization to internal Meshy worker calls.');
if(!/JSON\.stringify\(\{ itemId: item\.id/.test(catalogCron))failures.push('Catalog cron must pass trusted catalog item ids rather than whole caller-shaped item objects.');

const sitemap=fs.readFileSync(path.join(root,'app/sitemap.js'),'utf8');
if(sitemap.includes("'/marketplace'")||sitemap.includes('CATALOG_SIZE'))failures.push('Sitemap still advertises the legacy marketplace/catalog instead of the VoxelPop launch surface.');
if(sitemap.includes('/admin/neural-core'))failures.push('Private Neural Core route must not appear in the sitemap.');

const robots=fs.readFileSync(path.join(root,'app/robots.js'),'utf8');
if(!robots.includes("'/admin/'")||!robots.includes("'/api/admin/'"))failures.push('robots.js must disallow private Neural Core surfaces.');

console.log(`Route audit: ${publicPages.length} public page files, ${apiRoutes.length} API route files.`);
if(failures.length){
 console.error('\nRoute integrity failures:');
 for(const failure of failures)console.error(`- ${failure}`);
 process.exit(1);
}
console.log('Route integrity passed: no duplicate route handlers, critical VoxelPop/VoxelFlip/catalog/Neural Core/WhatsApp routes exist, the production deployment is pinned, admin and catalog worker auth, ownership, webhook signatures and private database controls are present, automatic signing/buying/listing remain disabled, and private admin routes stay out of indexing.');
