import { Wallet, formatEther } from 'ethers';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../lib/supabase-admin';
import { appendAuditChainEvent } from '../../../../../lib/audit-chain';
import {
  assertSpatialMintServerReady,
  signSpatialMintVoucher,
  spatialMintContract,
  spatialMintMetadataSignature,
  spatialMintProvider,
  spatialMintVoucherId,
} from '../../../../../lib/spatial-mint-server';

export const runtime = 'nodejs';
export const maxDuration = 60;
const BUCKET = process.env.SPATIAL_ASSET_BUCKET || 'assets-private';
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

async function authenticatedUser(request: Request, supabaseAdmin: any) {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  return error ? null : user;
}

async function makeVoxelPopModelDurable(request: Request, supabaseAdmin: any, asset: any, userId: string) {
  if (asset.glb_storage_path) return asset.glb_storage_path as string;
  if (asset.source_kind !== 'voxelpop' || !asset.source_session_id || !asset.source_task_id) {
    throw new Error('This asset has no finished 3D model to mint.');
  }

  const proxyUrl = new URL('/api/creator-pack/mesh', request.url);
  proxyUrl.searchParams.set('sessionId', asset.source_session_id);
  proxyUrl.searchParams.set('taskId', asset.source_task_id);
  proxyUrl.searchParams.set('preview', '1');
  const response = await fetch(proxyUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error('The finished VoxelPop GLB could not be recovered for durable NFT storage.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 35 * 1024 * 1024) throw new Error('The recovered GLB is empty or too large for the spatial mint pipeline.');

  const path = `spatial-assets/${userId}/${asset.id}/model.glb`;
  const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, {
    contentType: 'model/gltf-binary',
    upsert: true,
    cacheControl: '3600',
  });
  if (uploadError) throw uploadError;

  const { error: updateError } = await supabaseAdmin.from('spatial_assets').update({
    glb_storage_path: path,
    updated_at: new Date().toISOString(),
  }).eq('id', asset.id).eq('owner_user_id', userId);
  if (updateError) throw updateError;
  return path;
}

export async function POST(request: Request) {
  let provider: any = null;
  try {
    const config = assertSpatialMintServerReady({ requireSigner: true, requireMetadataSecret: true });
    const supabaseAdmin = getSupabaseAdmin();
    const user = await authenticatedUser(request, supabaseAdmin);
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const assetId = String(body?.assetId || '');
    const wallet = String(body?.wallet || '').trim().toLowerCase();
    if (!/^[0-9a-f-]{36}$/i.test(assetId) || !ADDRESS_RE.test(wallet)) {
      return NextResponse.json({ error: 'A valid asset and connected wallet are required.' }, { status: 400 });
    }

    const { data: asset, error: assetError } = await supabaseAdmin
      .from('spatial_assets')
      .select('*')
      .eq('id', assetId)
      .eq('owner_user_id', user.id)
      .maybeSingle();
    if (assetError) throw assetError;
    if (!asset) return NextResponse.json({ error: 'Spatial asset not found.' }, { status: 404 });
    if (asset.state === 'archived') return NextResponse.json({ error: 'Archived assets cannot be minted.' }, { status: 409 });
    if (asset.state === 'minted') return NextResponse.json({ error: 'This asset is already verified as minted.' }, { status: 409 });

    const { data: linkedWallet, error: linkError } = await supabaseAdmin
      .from('wallet_links')
      .select('id')
      .eq('user_id', user.id)
      .eq('wallet_address', wallet)
      .maybeSingle();
    if (linkError) throw linkError;
    if (!linkedWallet) return NextResponse.json({ error: 'Verify this wallet with your VoxelVault account before minting.' }, { status: 403 });

    await makeVoxelPopModelDurable(request, supabaseAdmin, asset, user.id);

    provider = spatialMintProvider();
    const contract = spatialMintContract(provider);
    const voucherId = spatialMintVoucherId(asset.id);
    const [voucherUsed, paused, onChainSigner, platformFeeWei] = await Promise.all([
      contract.usedVouchers(voucherId),
      contract.paused(),
      contract.voucherSigner(),
      contract.mintFeeWei(),
    ]);
    if (paused) return NextResponse.json({ error: 'Spatial NFT minting is paused on-chain.' }, { status: 503 });
    if (voucherUsed) return NextResponse.json({ error: 'This one-time asset voucher is already used. Use mint recovery/verification instead of minting again.', voucherUsed: true }, { status: 409 });

    const signerPrivateKey = String(process.env.SPATIAL_NFT_VOUCHER_SIGNER_PRIVATE_KEY || '').trim();
    const normalizedPrivateKey = signerPrivateKey.startsWith('0x') ? signerPrivateKey : `0x${signerPrivateKey}`;
    const configuredSigner = new Wallet(normalizedPrivateKey).address;
    if (configuredSigner.toLowerCase() !== String(onChainSigner).toLowerCase()) {
      throw new Error('Spatial voucher signer does not match the deployed contract.');
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
    const metadataUrl = `${appUrl}/api/spatial-assets/mint/metadata?${new URLSearchParams({
      assetId: asset.id,
      sig: spatialMintMetadataSignature(asset.id),
    }).toString()}`;
    const voucher = await signSpatialMintVoucher(wallet, metadataUrl, voucherId);
    const preparedAt = new Date().toISOString();

    const { error: stateError } = await supabaseAdmin.from('spatial_assets').update({
      state: 'mint_pending',
      owner_wallet: wallet,
      chain_id: config.chainId,
      contract_address: config.contractAddress.toLowerCase(),
      metadata_uri: metadataUrl,
      updated_at: preparedAt,
    }).eq('id', asset.id).eq('owner_user_id', user.id);
    if (stateError) throw stateError;

    const eventDetails = {
      wallet,
      chainId: config.chainId,
      contractAddress: config.contractAddress.toLowerCase(),
      voucherId,
      metadataUrl,
      platformFeeWei: platformFeeWei.toString(),
      preparedAt,
    };
    const { error: eventError } = await supabaseAdmin.from('spatial_asset_events').insert({
      asset_id: asset.id,
      event_type: 'mint_prepared',
      details: eventDetails,
    });
    if (eventError) throw eventError;

    const audit = await appendAuditChainEvent(supabaseAdmin, {
      eventType: 'spatial_mint_prepared',
      entityType: 'spatial_asset',
      entityId: asset.id,
      actorUserId: user.id,
      sourceRef: `spatial-mint:${asset.id}:${voucherId}`,
      payload: eventDetails,
    });
    await supabaseAdmin.from('spatial_assets').update({ audit_hash: audit.entryHash }).eq('id', asset.id).eq('owner_user_id', user.id);

    return NextResponse.json({
      ready: true,
      assetId: asset.id,
      wallet,
      chainId: config.chainId,
      chainName: config.chainId === 84532 ? 'Base Sepolia' : 'Base Mainnet',
      contractAddress: config.contractAddress,
      metadataUrl,
      voucherId,
      signature: voucher.signature,
      voucherSigner: voucher.signer,
      platformFeeWei: platformFeeWei.toString(),
      platformFeeEth: formatEther(platformFeeWei),
      gasNotice: 'Network gas is separate from the VoxelVault platform fee and is paid by your wallet to the blockchain network.',
      auditHash: audit.entryHash,
    });
  } catch (error) {
    console.error('spatial mint preparation failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to prepare this spatial mint.' }, { status: 500 });
  } finally {
    provider?.destroy?.();
  }
}
