import { createHash } from 'node:crypto';
import { Contract, getAddress, JsonRpcProvider, verifyMessage } from 'ethers';
import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../../../../lib/user-auth';
import { loadAccountVoxel } from '../../../../../../lib/voxelpop-account';
import { canAttachMintedVoxel, canTenantUseProperty, tenantVoxelOwnershipMessage } from '../../../../../../lib/real-estate/property-rental';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OWNER_OF_ABI = ['function ownerOf(uint256 tokenId) view returns (address)'];
const MAX_SIGNATURE_AGE_MS = 10 * 60 * 1000;

type Context = { params: Promise<{ leaseId: string }> };

function clean(value: unknown, max = 180) {
  return String(value || '').trim().slice(0, max);
}

function currentNftConfig() {
  const contract = clean(process.env.NEXT_PUBLIC_VOXEL_NFT_ADDRESS, 80);
  const rpc = clean(
    process.env.VOXEL_NFT_RPC_URL || process.env.NEXT_PUBLIC_EVM_RPC_URL || process.env.SEPOLIA_RPC_URL,
    1200
  );
  const rawChainId = clean(process.env.NEXT_PUBLIC_EVM_CHAIN_ID || '0xaa36a7', 32);
  let chainId = 11155111;
  try { chainId = Number(BigInt(rawChainId)); } catch {}
  if (!/^0x[a-fA-F0-9]{40}$/.test(contract) || !/^https?:\/\//i.test(rpc) || !Number.isSafeInteger(chainId)) return null;
  return { contract: getAddress(contract), rpc, chainId };
}

function freshSignedAt(value: unknown) {
  const text = clean(value, 40);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return null;
  const age = Date.now() - parsed;
  if (age < -60_000 || age > MAX_SIGNATURE_AGE_MS) return null;
  return new Date(parsed).toISOString();
}

async function verifyCurrentTokenOwner({ userId, leaseId, sessionId, tokenId, signedAt, signature }: {
  userId: string;
  leaseId: string;
  sessionId: string;
  tokenId: string;
  signedAt: string;
  signature: string;
}) {
  const config = currentNftConfig();
  if (!config) throw new Error('On-chain Voxel ownership verification is not configured for this deployment.');
  if (!/^\d+$/.test(tokenId)) throw new Error('The minted voxel token ID is invalid.');
  const validSignedAt = freshSignedAt(signedAt);
  if (!validSignedAt) throw new Error('Wallet ownership proof expired. Try Add minted voxel again.');
  if (!/^0x[a-fA-F0-9]+$/.test(signature)) throw new Error('Wallet signature is required.');

  const message = tenantVoxelOwnershipMessage({ userId, leaseId, sessionId, tokenId, signedAt: validSignedAt });
  let signer: string;
  try {
    signer = getAddress(verifyMessage(message, signature));
  } catch {
    throw new Error('Wallet ownership signature could not be verified.');
  }

  const provider = new JsonRpcProvider(config.rpc, config.chainId, { staticNetwork: true });
  try {
    const nft = new Contract(config.contract, OWNER_OF_ABI, provider);
    const owner = getAddress(await nft.ownerOf(BigInt(tokenId)));
    if (owner !== signer) throw new Error('The signing wallet is not the current on-chain owner of this voxel.');
    return {
      walletAddress: signer,
      tokenContract: config.contract,
      ownershipVerifiedAt: new Date().toISOString(),
      ownershipProofHash: createHash('sha256').update(signature).digest('hex'),
    };
  } finally {
    provider.destroy();
  }
}

async function ownLease(admin: any, userId: string, leaseId: string) {
  const { data, error } = await admin
    .from('vault_property_leases')
    .select('id,tenant_user_id,status,lease_verified_at,termination_verified_at')
    .eq('id', leaseId)
    .eq('tenant_user_id', userId)
    .maybeSingle();
  if (error) throw new Error('Rental storage is unavailable.');
  return data || null;
}

export async function POST(request: Request, context: Context) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const { leaseId: rawLeaseId } = await context.params;
    const leaseId = clean(rawLeaseId, 80);
    const body = await request.json().catch(() => ({}));
    const sessionId = clean(body?.sessionId, 180);
    const signature = clean(body?.signature, 1200);
    const signedAt = clean(body?.signedAt, 40);
    if (!leaseId || !sessionId) return NextResponse.json({ ok: false, error: 'Choose a minted voxel first.' }, { status: 400 });

    const lease = await ownLease(auth.admin, auth.user.id, leaseId);
    if (!lease) return NextResponse.json({ ok: false, error: 'That rental is not in your Vault.' }, { status: 404 });

    const record = await loadAccountVoxel(auth.admin as any, auth.user, sessionId);
    const tokenId = clean(record?.payload?.mint?.tokenId, 96);
    const accountMintConfirmed = Boolean(record && tokenId);
    if (!accountMintConfirmed) {
      return NextResponse.json({ ok: false, error: 'Only a voxel with a confirmed mint in your signed-in Creator Gallery can be attached permanently.' }, { status: 409 });
    }
    if (!canTenantUseProperty({ status: lease.status, leaseVerifiedAt: lease.lease_verified_at, terminationVerifiedAt: lease.termination_verified_at })) {
      return NextResponse.json({ ok: false, error: 'This tenant layer is read-only until a verified active lease exists.' }, { status: 409 });
    }

    const ownership = await verifyCurrentTokenOwner({
      userId: auth.user.id,
      leaseId,
      sessionId,
      tokenId,
      signedAt,
      signature,
    });

    const allowed = canAttachMintedVoxel({
      status: lease.status,
      leaseVerifiedAt: lease.lease_verified_at,
      terminationVerifiedAt: lease.termination_verified_at,
      tokenId,
      accountMintConfirmed,
      walletOwnershipVerified: true,
    });
    if (!allowed) return NextResponse.json({ ok: false, error: 'This minted voxel cannot be attached to the tenant layer.' }, { status: 409 });

    const voxelName = clean(record?.payload?.asset?.name || 'Minted voxel', 120);
    const { data, error } = await auth.admin
      .from('vault_tenant_voxel_attachments')
      .upsert({
        lease_id: leaseId,
        tenant_user_id: auth.user.id,
        voxel_session_id: sessionId,
        token_id: tokenId,
        token_contract: ownership.tokenContract,
        wallet_address: ownership.walletAddress,
        ownership_proof_hash: ownership.ownershipProofHash,
        ownership_verified_at: ownership.ownershipVerifiedAt,
        voxel_name: voxelName,
        status: 'active',
        archived_at: null,
      }, { onConflict: 'lease_id,voxel_session_id' })
      .select('id,lease_id,voxel_session_id,token_id,token_contract,wallet_address,ownership_verified_at,voxel_name,status,placed_transform,created_at,archived_at')
      .single();
    if (error) throw new Error('The minted voxel could not be attached to this rental.');

    return NextResponse.json({
      ok: true,
      attachment: data,
      ownershipVerifiedOnChain: true,
      truth: 'The voxel stays your separate digital asset. Attaching it does not change the real property, lease, deed or ownership rights.',
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Tenant voxel attachment failed.' }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const { leaseId: rawLeaseId } = await context.params;
    const leaseId = clean(rawLeaseId, 80);
    const body = await request.json().catch(() => ({}));
    const attachmentId = clean(body?.attachmentId, 80);
    if (!leaseId || !attachmentId) return NextResponse.json({ ok: false, error: 'Attachment ID is required.' }, { status: 400 });

    const lease = await ownLease(auth.admin, auth.user.id, leaseId);
    if (!lease) return NextResponse.json({ ok: false, error: 'That rental is not in your Vault.' }, { status: 404 });
    if (!canTenantUseProperty({ status: lease.status, leaseVerifiedAt: lease.lease_verified_at, terminationVerifiedAt: lease.termination_verified_at })) {
      return NextResponse.json({ ok: false, error: 'An ended or unverified tenant layer is read-only.' }, { status: 409 });
    }

    const { error } = await auth.admin
      .from('vault_tenant_voxel_attachments')
      .delete()
      .eq('id', attachmentId)
      .eq('lease_id', leaseId)
      .eq('tenant_user_id', auth.user.id);
    if (error) throw new Error('The voxel could not be removed from this tenant layer.');

    return NextResponse.json({ ok: true, assetStillOwned: true }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Tenant voxel removal failed.' }, { status: 400 });
  }
}
