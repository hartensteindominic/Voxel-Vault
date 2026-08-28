import { NextResponse } from 'next/server';
import { Contract, JsonRpcProvider, getAddress, verifyMessage } from 'ethers';
import { requireVoxelVaultUser } from '../../../../lib/user-auth';
import {
  buildPropertySceneWalletMessage,
  normalizeSceneTransform,
  PROPERTY_SCENE_POLICY,
} from '../../../../lib/vault/property-scene.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OWNER_OF_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
];

function response(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store, private' } });
}

function setupMissing(error: any) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return code === '42P01' || /vault_property_scene_items/i.test(message);
}

function configuredVoxelChain() {
  const contractRaw = String(process.env.NEXT_PUBLIC_VOXEL_NFT_ADDRESS || '').trim();
  if (!contractRaw) throw new Error('VOXEL_NFT_NOT_CONFIGURED');

  let contractAddress: string;
  try {
    contractAddress = getAddress(contractRaw);
  } catch {
    throw new Error('VOXEL_NFT_ADDRESS_INVALID');
  }

  const chainId = Number(BigInt(process.env.NEXT_PUBLIC_EVM_CHAIN_ID || '0xaa36a7'));
  let rpcUrl = String(process.env.VOXEL_SCENE_RPC_URL || '').trim();
  if (!rpcUrl && chainId === 84532) rpcUrl = String(process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org').trim();
  if (!rpcUrl && chainId === 8453) rpcUrl = String(process.env.BASE_RPC_URL || 'https://mainnet.base.org').trim();
  if (!rpcUrl && chainId === 11155111) rpcUrl = String(process.env.SEPOLIA_RPC_URL || process.env.NEXT_PUBLIC_EVM_RPC_URL || '').trim();
  if (!rpcUrl) rpcUrl = String(process.env.NEXT_PUBLIC_EVM_RPC_URL || '').trim();
  if (!rpcUrl) throw new Error('VOXEL_SCENE_RPC_NOT_CONFIGURED');

  return { chainId, contractAddress, rpcUrl };
}

async function controlledProperty(auth: any, propertyIdentityId: string) {
  const result = await auth.admin
    .from('vault_property_claims')
    .select('id,property_identity_id,property_label,locality,claim_status,owner_authorized,vault_property_identities!inner(id,canonical_state,registry_verified,canonical_passport_token_id)')
    .eq('user_id', auth.user.id)
    .eq('property_identity_id', propertyIdentityId)
    .eq('claim_status', 'verified')
    .eq('owner_authorized', true)
    .maybeSingle();

  if (result.error) throw result.error;
  return result.data || null;
}

export async function GET(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if ('error' in auth) return response({ ok: false, error: auth.error, setupRequired: auth.setupRequired === true }, auth.status);

  const claimsResult = await auth.admin
    .from('vault_property_claims')
    .select('id,property_identity_id,property_label,locality,claim_status,owner_authorized,vault_property_identities!inner(id,canonical_state,registry_verified,canonical_passport_token_id)')
    .eq('user_id', auth.user.id)
    .eq('claim_status', 'verified')
    .eq('owner_authorized', true)
    .order('reviewed_at', { ascending: false });

  if (claimsResult.error) {
    return response({ ok: false, error: 'Verified properties could not be loaded.' }, 500);
  }

  const claims = Array.isArray(claimsResult.data) ? claimsResult.data : [];
  const propertyIds = claims.map((claim: any) => String(claim.property_identity_id || '')).filter(Boolean);
  let items: any[] = [];

  if (propertyIds.length) {
    const sceneResult = await auth.admin
      .from('vault_property_scene_items')
      .select('id,property_identity_id,owner_wallet,nft_chain_id,nft_contract,nft_token_id,token_uri,display_label,position_x,position_y,position_z,rotation_y,scale,ownership_verified_at,created_at,updated_at')
      .in('property_identity_id', propertyIds)
      .order('created_at', { ascending: true });

    if (sceneResult.error) {
      if (setupMissing(sceneResult.error)) {
        return response({ ok: false, setupRequired: true, error: 'Apply Supabase migration 020 before using Property Scene.' }, 503);
      }
      return response({ ok: false, error: 'Property scene items could not be loaded.' }, 500);
    }
    items = Array.isArray(sceneResult.data) ? sceneResult.data : [];
  }

  let voxelChain: { chainId: number; contractAddress: string } | null = null;
  try {
    const configured = configuredVoxelChain();
    voxelChain = { chainId: configured.chainId, contractAddress: configured.contractAddress };
  } catch {
    voxelChain = null;
  }

  return response({
    ok: true,
    properties: claims.map((claim: any) => ({
      claimId: claim.id,
      propertyIdentityId: claim.property_identity_id,
      propertyLabel: claim.property_label || 'Verified property',
      locality: claim.locality || '',
      canonicalState: claim.vault_property_identities?.canonical_state || '',
      registryVerified: claim.vault_property_identities?.registry_verified === true,
      passportTokenId: claim.vault_property_identities?.canonical_passport_token_id || '',
      items: items.filter((item) => item.property_identity_id === claim.property_identity_id),
    })),
    voxelChain,
    policy: PROPERTY_SCENE_POLICY,
    valueDisclosure: 'Attached voxel collectibles may have separate digital market value. They are never added to the property appraisal or presented as deed/rent rights.',
  });
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if ('error' in auth) return response({ ok: false, error: auth.error, setupRequired: auth.setupRequired === true }, auth.status);

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || '').trim().toLowerCase();
  const propertyIdentityId = String(body?.propertyIdentityId || '').trim();

  if (!['attach', 'move', 'remove'].includes(action)) return response({ ok: false, error: 'Action must be attach, move, or remove.' }, 400);
  if (!propertyIdentityId) return response({ ok: false, error: 'propertyIdentityId is required.' }, 400);

  let property: any;
  try {
    property = await controlledProperty(auth, propertyIdentityId);
  } catch (error) {
    if (setupMissing(error)) return response({ ok: false, setupRequired: true, error: 'Property scene storage is not installed yet.' }, 503);
    return response({ ok: false, error: 'Property control could not be verified.' }, 500);
  }
  if (!property) return response({ ok: false, error: 'Only the human-verified property controller can edit this digital scene.' }, 403);

  if (action === 'remove') {
    const sceneItemId = String(body?.sceneItemId || '').trim();
    if (!sceneItemId) return response({ ok: false, error: 'sceneItemId is required to remove a voxel.' }, 400);
    const deleted = await auth.admin
      .from('vault_property_scene_items')
      .delete()
      .eq('id', sceneItemId)
      .eq('property_identity_id', propertyIdentityId)
      .select('id')
      .maybeSingle();
    if (deleted.error) {
      if (setupMissing(deleted.error)) return response({ ok: false, setupRequired: true, error: 'Apply Supabase migration 020 before using Property Scene.' }, 503);
      return response({ ok: false, error: 'The voxel could not be removed from the digital scene.' }, 500);
    }
    if (!deleted.data) return response({ ok: false, error: 'Scene voxel was not found.' }, 404);
    return response({ ok: true, action: 'remove', sceneItemId, propertyRightsChanged: false, nftTransferred: false });
  }

  let configured: ReturnType<typeof configuredVoxelChain>;
  try {
    configured = configuredVoxelChain();
  } catch {
    return response({ ok: false, setupRequired: true, error: 'Voxel NFT ownership verification is not configured on the server.' }, 503);
  }

  const tokenId = String(body?.tokenId || '').trim();
  const walletRaw = String(body?.wallet || '').trim();
  const signature = String(body?.signature || '').trim();
  const timestamp = Number(body?.timestamp);
  const displayLabel = String(body?.displayLabel || '').trim().slice(0, 80);

  if (!/^\d{1,96}$/.test(tokenId)) return response({ ok: false, error: 'A numeric Voxel token ID is required.' }, 400);
  if (!signature || !Number.isFinite(timestamp)) return response({ ok: false, error: 'A fresh wallet signature is required.' }, 400);
  if (Math.abs(Date.now() - timestamp) > PROPERTY_SCENE_POLICY.signatureMaxAgeMs) {
    return response({ ok: false, error: 'The wallet approval expired. Sign the scene action again.' }, 409);
  }

  let wallet: string;
  let transform;
  try {
    wallet = getAddress(walletRaw);
    transform = normalizeSceneTransform(body?.transform || {});
  } catch (error) {
    return response({ ok: false, error: error instanceof Error ? error.message : 'Invalid scene placement.' }, 400);
  }

  const walletAction = action === 'attach' ? 'ATTACH' : 'MOVE';
  const message = buildPropertySceneWalletMessage({
    action: walletAction,
    propertyIdentityId,
    chainId: configured.chainId,
    contractAddress: configured.contractAddress,
    tokenId,
    transform,
    timestamp,
  });

  let recovered: string;
  try {
    recovered = getAddress(verifyMessage(message, signature));
  } catch {
    return response({ ok: false, error: 'The wallet signature could not be verified.' }, 401);
  }
  if (recovered !== wallet) return response({ ok: false, error: 'The wallet signature does not match the connected wallet.' }, 401);

  let tokenUri = '';
  try {
    const provider = new JsonRpcProvider(configured.rpcUrl, configured.chainId, { staticNetwork: true });
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== configured.chainId) throw new Error('Configured RPC returned the wrong chain.');
    const nft = new Contract(configured.contractAddress, OWNER_OF_ABI, provider);
    const currentOwner = getAddress(await nft.ownerOf(BigInt(tokenId)));
    if (currentOwner !== wallet) return response({ ok: false, error: 'That wallet is not the current on-chain owner of this Voxel.' }, 409);
    try {
      tokenUri = String(await nft.tokenURI(BigInt(tokenId)) || '').slice(0, 4000);
    } catch {
      tokenUri = '';
    }
  } catch (error) {
    if (error instanceof Response) throw error;
    return response({ ok: false, error: 'Voxel ownership could not be confirmed on-chain. Nothing was attached.' }, 503);
  }

  const now = new Date().toISOString();
  const row = {
    property_identity_id: propertyIdentityId,
    attached_by_user_id: auth.user.id,
    owner_wallet: wallet.toLowerCase(),
    nft_chain_id: configured.chainId,
    nft_contract: configured.contractAddress.toLowerCase(),
    nft_token_id: tokenId,
    token_uri: tokenUri,
    display_label: displayLabel,
    position_x: transform.x,
    position_y: transform.y,
    position_z: transform.z,
    rotation_y: transform.rotationY,
    scale: transform.scale,
    ownership_verified_at: now,
    updated_at: now,
  };

  const stored = await auth.admin
    .from('vault_property_scene_items')
    .upsert(row, { onConflict: 'property_identity_id,nft_chain_id,nft_contract,nft_token_id' })
    .select('id,property_identity_id,owner_wallet,nft_chain_id,nft_contract,nft_token_id,token_uri,display_label,position_x,position_y,position_z,rotation_y,scale,ownership_verified_at,created_at,updated_at')
    .single();

  if (stored.error || !stored.data) {
    if (setupMissing(stored.error)) return response({ ok: false, setupRequired: true, error: 'Apply Supabase migration 020 before using Property Scene.' }, 503);
    return response({ ok: false, error: 'The verified Voxel could not be saved to the property scene.' }, 500);
  }

  return response({
    ok: true,
    action,
    item: stored.data,
    ownershipVerified: true,
    nftTransferred: false,
    propertyRightsChanged: false,
    appraisalChanged: false,
    valueDisclosure: 'This attachment adds to the digital collectible scene only; it is not part of the real-property appraisal.',
  }, action === 'attach' ? 201 : 200);
}
