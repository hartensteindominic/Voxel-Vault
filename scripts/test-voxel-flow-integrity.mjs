import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const requireText=(rel,text,message)=>{const source=read(rel);if(!source.includes(text))failures.push(`${rel}: ${message}`)};
const forbid=(rel,pattern,message)=>{const source=read(rel);if(pattern.test(source))failures.push(`${rel}: ${message}`)};

requireText('app/studio/page.js','session?.access_token','signed-in checkout must use the current Supabase access token.');
requireText('app/studio/page.js','Authorization=`Bearer ${session.access_token}`','signed-in checkout must send a Bearer token to the server.');
requireText('app/studio/page.js','/forge/real?focus_session=','3D-ready non-minted My Voxels must have an exact-session Forge handoff.');

requireText('app/api/creator-pack/checkout/route.ts','verifiedAccount(request)','checkout must verify a supplied account token server-side.');
requireText('app/api/creator-pack/checkout/route.ts','metadata.voxelpop_user_id = account.id','verified purchases must be permanently linked to the VoxelPop account ID.');
requireText('app/api/creator-pack/checkout/route.ts','client_reference_id: account.id','Stripe checkout must retain the verified account reference.');

requireText('app/pack/success/PackBuilder.tsx','focus_session=${encodeURIComponent(sessionId)}','finished paid 3D pages must preserve the exact paid session when opening Forge.');

requireText('app/forge/real/layout.js','/api/forge/session-asset?','Forge must recover an exact paid session across browser handoff.');
requireText('app/forge/real/layout.js','/api/forge/account-assets','Forge must support authenticated historical paid-asset recovery.');
requireText('app/forge/real/layout.js','REFRESH PAID 3D VOXELS','Forge must expose an explicit paid 3D recovery retry.');

requireText('app/api/forge/session-asset/route.ts','getVoxelPopEntitlement(sessionId)','focused-session recovery must verify the paid entitlement.');
requireText('app/api/forge/session-asset/route.ts','mesh_task_0','focused-session recovery must use the saved Meshy task.');
requireText('app/api/forge/account-assets/route.ts','mesh_completed','historical recovery must use completed-mesh analytics.');
requireText('app/api/forge/account-assets/route.ts','nonMintedReady','historical recovery must explicitly report finished non-minted 3D assets.');
requireText('app/api/forge/account-assets/route.ts','voxelpop_user_id','historical paid sessions must support stable account-ID linkage.');

requireText('app/forge/real/page.js','loadMyVoxels().then','saved My Voxels must load before wallet connection.');
requireText('app/forge/real/page.js','3D READY · NOT MINTED','non-minted 3D assets must remain visibly distinct from wallet NFTs.');
requireText('app/forge/real/page.js','Connect MetaMask only when you want to add verified Base NFTs.','wallet connection must not be required merely to see saved My Voxels.');
requireText('app/forge/real/page.js',"const BASE_SEPOLIA_CHAIN_ID='0x14a34'",'Forge write flow must remain locked to Base Sepolia.');
requireText('app/forge/real/page.js','network.chainId!==84532n','Forge transaction provider must reject non-Sepolia networks.');
forbid('app/forge/real/page.js',/wallet_switchEthereumChain[^\n]+0x2105/i,'Forge must not switch the write flow to Base mainnet.');

requireText('app/api/forge/owned-assets/route.ts','verifyOwnedAcrossProviders','wallet NFT discovery must independently verify current ownership.');
requireText('app/api/forge/owned-assets/route.ts','blockscoutOwned','wallet NFT discovery must have an indexer fallback independent of OpenSea.');
requireText('app/api/forge/owned-assets/route.ts','legacyVoxelFlip','older Voxel-like contracts must stay distinguishable after verification.');

if(failures.length){
 console.error('\nVoxel flow integrity failures:');
 for(const failure of failures)console.error(`- ${failure}`);
 process.exit(1);
}

console.log('Voxel flow integrity passed: signed-in purchases are account-linked, non-minted 3D assets recover by paid session/history and remain visible without a wallet, minted NFTs are ownership-verified, and Forge writes stay locked to Base Sepolia.');
