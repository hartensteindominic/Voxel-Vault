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
 'app/api/voxelflip/trader/route.ts',
 'app/api/voxelflip/factory/route.ts',
 'app/api/creator-pack/nft/confirm/route.ts',
]){
 if(!fs.existsSync(path.join(root,required)))failures.push(`Missing critical VoxelPop/VoxelFlip route: ${required}`);
}

const criticalSources=[
 'app/voxelflip/autopilot/page.js',
 'app/voxelflip/factory/page.js',
 'app/api/voxelflip/trader/route.ts',
 'app/api/voxelflip/factory/route.ts',
];
for(const rel of criticalSources){
 const text=fs.readFileSync(path.join(root,rel),'utf8');
 if(/automaticSigningActive\s*=\s*true/.test(text))failures.push(`${rel} enables automatic signing directly.`);
 if(/automaticFactoryActive\s*=\s*true/.test(text))failures.push(`${rel} enables the Factory directly.`);
}

const sitemap=fs.readFileSync(path.join(root,'app/sitemap.js'),'utf8');
if(sitemap.includes("'/marketplace'")||sitemap.includes('CATALOG_SIZE'))failures.push('Sitemap still advertises the legacy marketplace/catalog instead of the VoxelPop launch surface.');

console.log(`Route audit: ${publicPages.length} public page files, ${apiRoutes.length} API route files.`);
if(failures.length){
 console.error('\nRoute integrity failures:');
 for(const failure of failures)console.error(`- ${failure}`);
 process.exit(1);
}
console.log('Route integrity passed: no duplicate route handlers, critical VoxelFlip routes exist, automatic signing remains disabled, and sitemap is current.');
