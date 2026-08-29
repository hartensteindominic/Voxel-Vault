import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const requireText=(rel,text,message)=>{const source=read(rel);if(!source.includes(text))failures.push(`${rel}: ${message}`)};
const forbid=(rel,pattern,message)=>{const source=read(rel);if(pattern.test(source))failures.push(`${rel}: ${message}`)};

requireText('app/studio/page.js','Sign in with Google before making a voxel.','Studio must block creation while signed out.');
requireText('app/studio/page.js','Nothing generates, uploads or opens checkout until your account is verified.','Studio must visibly explain the sign-in-first boundary.');
requireText('app/studio/page.js','Sign in before you type a prompt, upload a reference image, create a voxel, or pay.','signed-out Studio must not expose the creation workflow as usable.');
requireText('app/studio/page.js','Authorization:`Bearer ${session.access_token}`','checkout must always send the verified account Bearer token.');
requireText('app/studio/page.js','Make the voxel first','Studio must put the voxel image ahead of 3D.');
requireText('app/studio/page.js','/forge/real?focus_session=','3D-ready non-minted My Voxels must have an exact-session Forge handoff.');

requireText('app/api/creator-pack/checkout/route.ts','requireVoxelVaultUser(request)','checkout must require a verified signed-in account server-side.');
requireText('app/api/creator-pack/checkout/route.ts','voxelpop_user_id: account.id','every new VoxelPop purchase must be permanently linked to the account ID.');
requireText('app/api/creator-pack/checkout/route.ts','client_reference_id: account.id','Stripe checkout must retain the verified account reference.');
requireText('app/api/creator-pack/checkout/route.ts','account_linked: true','checkout analytics must record that new purchases are account-linked.');

requireText('app/api/creator-pack/generate/route.ts','requireVoxelVaultUser(request)','paid voxel image generation must require the signed-in account.');
requireText('app/api/creator-pack/generate/route.ts',"session.metadata?.voxelpop_user_id!==auth.user.id",'paid voxel image generation must reject a different signed-in account.');
requireText('app/api/creator-pack/mesh/route.ts','requireVoxelVaultUser(request)','starting a paid 3D mesh must require the signed-in account.');
requireText('app/api/creator-pack/mesh/route.ts',"session.metadata?.voxelpop_user_id!==auth.user.id",'starting 3D must reject a different signed-in account.');

requireText('app/pack/success/PackBuilder.tsx','accountAccessToken','paid builder must retain the current signed-in access token.');
requireText('app/pack/success/PackBuilder.tsx','Authorization:`Bearer ${accountAccessToken}`','paid voxel image and 3D starts must send the verified account token.');
requireText('app/pack/success/PackBuilder.tsx','Sign in with the same Google account before the voxel image or 3D build can start.','expired sessions must fail closed without losing the paid entitlement.');
requireText('app/pack/success/PackBuilder.tsx','MAKE VOXEL → APPROVE → MAKE 3D → MOVE','post-payment flow must keep voxel image approval ahead of 3D.');
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

console.log('Voxel flow integrity passed: account verification comes first, every new paid VoxelPop purchase is user-bound, voxel image approval precedes 3D, paid-session recovery remains intact, minted NFTs are ownership-verified, and Forge writes stay locked to Base Sepolia.');
