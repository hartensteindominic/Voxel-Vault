import { createHash, createHmac } from 'crypto';
import { AbiCoder, Contract, getBytes, id, JsonRpcProvider, keccak256, solidityPackedKeccak256, toUtf8Bytes, Wallet } from 'ethers';
import { NextResponse } from 'next/server';
import { getVoxelFlipDeployment } from '../../../../../lib/voxelflip-deployment';
import { getVoxelPopEntitlement, updateVoxelPopEntitlementMetadata } from '../../../../../lib/voxelpop-entitlement';
import { attributionFromMetadata, recordVoxelPopEvent } from '../../../../../lib/voxelpop-analytics';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MESH_ENDPOINT = 'https://api.meshy.ai/openapi/v1/image-to-3d';
const TASK_KEY = 'mesh_task_0';
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const PRIVATE_KEY_RE = /^[a-fA-F0-9]{64}$/;
const VOXELFLIP_MINT_TOPIC = id('VoxelFlipMinted(uint256,address,bytes32,string)');
const BLOCKSCOUT_API = 'https://base.blockscout.com/api';
const EXISTING_MINT_ABI = [
  'function usedVouchers(bytes32 voucherId) view returns (bool)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
];

function safeName(value: unknown) {
  const cleaned = String(value || 'your-voxel').trim().slice(0, 72).replace(/[^a-z0-9 _-]+/gi, '').replace(/\s+/g, ' ');
  return cleaned || 'your-voxel';
}
function normalizePrivateKey(value: string) {
  const trimmed = value.trim();
  if (PRIVATE_KEY_RE.test(trimmed)) return `0x${trimmed}`;
  if (/^0X[a-fA-F0-9]{64}$/.test(trimmed)) return `0x${trimmed.slice(2)}`;
  return trimmed;
}
function signingSecret() {
  const raw = process.env.VOXELFLIP_MINT_SIGNER_PRIVATE_KEY?.trim() || '';
  return raw ? normalizePrivateKey(raw) : '';
}
function hmacHex(value: string) {
  const secret = signingSecret();
  return secret ? createHmac('sha256', secret).update(value).digest('hex') : '';
}
function voucherIdFor(sessionId: string, taskId: string) {
  return `0x${createHash('sha256').update(`voxelflip:${sessionId}:${taskId}`).digest('hex')}`;
}
function rpcCandidates() {
  const configured = (process.env.VOXELFLIP_RPC_URL || process.env.NEXT_PUBLIC_VOXELFLIP_RPC_URL || '').trim();
  return Array.from(new Set([
    configured,
    'https://base.blockscout.com/api/eth-rpc',
    'https://mainnet.base.org',
    'https://base.llamarpc.com',
  ].filter(Boolean)));
}
async function mintVoucher(wallet: string, metadataUrl: string, voucherId: string) {
  const rawPrivateKey = process.env.VOXELFLIP_MINT_SIGNER_PRIVATE_KEY;
  if (!rawPrivateKey) return null;
  const signer = new Wallet(normalizePrivateKey(rawPrivateKey));
  const uriHash = keccak256(toUtf8Bytes(metadataUrl));
  const digest = solidityPackedKeccak256(['address', 'bytes32', 'bytes32'], [wallet, uriHash, voucherId]);
  const signature = await signer.signMessage(getBytes(digest));
  return { signature, signer: signer.address };
}

function parseMintLog(log: any) {
  const topics = Array.isArray(log?.topics) ? log.topics : [];
  const tokenTopic = topics[1];
  const ownerTopic = topics[2];
  if (!tokenTopic || !ownerTopic) return null;
  let metadataUrl = '';
  try {
    if (typeof log?.data === 'string' && log.data.startsWith('0x')) {
      metadataUrl = String(AbiCoder.defaultAbiCoder().decode(['string'], log.data)?.[0] || '');
    }
  } catch {}
  return {
    tokenId: BigInt(tokenTopic).toString(),
    mintedOwner: `0x${String(ownerTopic).slice(-40)}`,
    txHash: String(log?.transactionHash || log?.transaction_hash || ''),
    metadataUrl,
  };
}

async function hydrateRecoveredMint(contractAddress: string, wallet: string, parsed: any) {
  if (!parsed) return null;
  if (parsed.mintedOwner.toLowerCase() !== wallet.toLowerCase()) {
    return { ownerMismatch: parsed.mintedOwner };
  }
  for (const rpcUrl of rpcCandidates()) {
    try {
      const provider = new JsonRpcProvider(rpcUrl, 8453, { staticNetwork: true });
      const contract = new Contract(contractAddress, EXISTING_MINT_ABI, provider);
      const [currentOwner, tokenUri] = await Promise.all([
        contract.ownerOf(parsed.tokenId),
        contract.tokenURI(parsed.tokenId),
      ]);
      return {
        mint: {
          tokenId: parsed.tokenId,
          txHash: parsed.txHash,
          owner: String(currentOwner),
          mintedOwner: parsed.mintedOwner,
          metadataUrl: String(tokenUri || parsed.metadataUrl || ''),
        },
      };
    } catch {}
  }
  // The indexed mint event still proves which voucher created which token. Keep
  // the recovery usable even if state reads are temporarily rate-limited.
  return {
    mint: {
      tokenId: parsed.tokenId,
      txHash: parsed.txHash,
      owner: parsed.mintedOwner,
      mintedOwner: parsed.mintedOwner,
      metadataUrl: parsed.metadataUrl,
    },
  };
}

async function findVoucherEventWithBlockscout(contractAddress: string, wallet: string, voucherId: string) {
  try {
    const query = new URLSearchParams({
      module: 'logs',
      action: 'getLogs',
      fromBlock: '0',
      toBlock: 'latest',
      address: contractAddress,
      topic0: VOXELFLIP_MINT_TOPIC,
      topic3: voucherId,
      topic0_3_opr: 'and',
      page: '1',
      offset: '50',
    });
    const response = await fetch(`${BLOCKSCOUT_API}?${query.toString()}`, { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    const logs = Array.isArray(data?.result) ? data.result : [];
    for (const log of logs.slice().reverse()) {
      const parsed = parseMintLog(log);
      if (!parsed) continue;
      const hydrated = await hydrateRecoveredMint(contractAddress, wallet, parsed);
      if (hydrated?.ownerMismatch) return { checked: true, used: true, mint: null, ownerMismatch: hydrated.ownerMismatch };
      if (hydrated?.mint) return { checked: true, used: true, mint: hydrated.mint };
    }
  } catch (error) {
    console.warn('VoxelFlip Blockscout voucher recovery unavailable', error);
  }
  return null;
}

async function findVoucherMint(contractAddress: string, wallet: string, voucherId: string) {
  let stateChecked = false;
  let voucherKnownUsed = false;

  for (const rpcUrl of rpcCandidates()) {
    try {
      const provider = new JsonRpcProvider(rpcUrl, 8453, { staticNetwork: true });
      const contract = new Contract(contractAddress, EXISTING_MINT_ABI, provider);
      const used = Boolean(await contract.usedVouchers(voucherId));
      stateChecked = true;
      if (!used) return { checked: true, used: false, mint: null };
      voucherKnownUsed = true;

      // A failed mint is normally retried immediately. Search the newest blocks
      // first so recovery does not depend on archive-range RPC access.
      const latest = await provider.getBlockNumber();
      const firstBlock = Math.max(0, latest - 20_000);
      let toBlock = latest;
      while (toBlock >= firstBlock) {
        const fromBlock = Math.max(firstBlock, toBlock - 1_999);
        const logs = await provider.getLogs({
          address: contractAddress,
          fromBlock,
          toBlock,
          topics: [VOXELFLIP_MINT_TOPIC, null, null, voucherId],
        });
        if (logs.length) {
          const parsed = parseMintLog(logs[logs.length - 1]);
          const hydrated = await hydrateRecoveredMint(contractAddress, wallet, parsed);
          if (hydrated?.ownerMismatch) return { checked: true, used: true, mint: null, ownerMismatch: hydrated.ownerMismatch };
          if (hydrated?.mint) return { checked: true, used: true, mint: hydrated.mint };
        }
        if (fromBlock === firstBlock) break;
        toBlock = fromBlock - 1;
      }
    } catch (error) {
      console.warn('VoxelFlip voucher recovery RPC unavailable', rpcUrl, error);
    }
  }

  const explorerLookup = await findVoucherEventWithBlockscout(contractAddress, wallet, voucherId);
  if (explorerLookup) return explorerLookup;

  if (voucherKnownUsed) {
    // State proved the voucher was consumed. Never issue a second voucher even
    // when every historical-log source is temporarily rate-limited.
    return { checked: true, used: true, mint: null };
  }
  if (stateChecked) return { checked: true, used: false, mint: null };
  return { checked: false, used: false, mint: null };
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.MESHY_API_KEY;
    if (!apiKey) return NextResponse.json({ error: '3D mesh generation is not configured.' }, { status: 503 });
    const body = await request.json();
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
    const taskId = typeof body?.taskId === 'string' ? body.taskId : '';
    const imageDataUrl = typeof body?.image === 'string' ? body.image : '';
    const idea = typeof body?.idea === 'string' ? body.idea.trim().slice(0, 120) : '';
    const wallet = typeof body?.wallet === 'string' ? body.wallet.trim() : '';
    const name = safeName(body?.name);
    if (!sessionId || !taskId || !/^data:image\/(png|jpeg|webp);base64,/.test(imageDataUrl) || !ADDRESS_RE.test(wallet)) {
      return NextResponse.json({ error: 'A connected wallet, completed VoxelPop image, and finished 3D mesh are required.' }, { status: 400 });
    }
    if (imageDataUrl.length > 5_500_000) return NextResponse.json({ error: 'The source image is too large to prepare for minting.' }, { status: 400 });

    const entitlement = await getVoxelPopEntitlement(sessionId);
    if (!entitlement) return NextResponse.json({ error: 'A completed VoxelPop purchase is required.' }, { status: 403 });
    if (entitlement.metadata?.[TASK_KEY] !== taskId) return NextResponse.json({ error: 'This 3D mesh does not belong to the current purchase.' }, { status: 403 });

    const meshResponse = await fetch(`${MESH_ENDPOINT}/${encodeURIComponent(taskId)}`, { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' });
    const meshData = await meshResponse.json().catch(() => ({}));
    const status = String(meshData?.status || '').toUpperCase();
    const remoteModelUrl = typeof meshData?.model_urls?.glb === 'string' ? meshData.model_urls.glb : '';
    const remoteImageUrl = typeof meshData?.alpha_thumbnail_url === 'string' ? meshData.alpha_thumbnail_url : (typeof meshData?.thumbnail_url === 'string' ? meshData.thumbnail_url : '');
    if (!meshResponse.ok || status !== 'SUCCEEDED' || !remoteModelUrl) return NextResponse.json({ error: 'Finish the 3D mesh before preparing the NFT.' }, { status: 409 });

    const assetId = createHash('sha256').update(`${sessionId}:${taskId}`).digest('hex').slice(0, 32);
    const origin = new URL(request.url).origin;
    const mediaSig = hmacHex(`media:${taskId}`);
    const metadataSig = hmacHex(`metadata:${taskId}|${name}|${idea}|Card`);
    if (!mediaSig || !metadataSig) return NextResponse.json({ error: 'VoxelFlip mint signer is not configured.' }, { status: 503 });

    const imageUrl = `${origin}/api/creator-pack/nft/media?${new URLSearchParams({ taskId, kind: 'image', sig: mediaSig }).toString()}`;
    const modelUrl = `${origin}/api/creator-pack/nft/media?${new URLSearchParams({ taskId, kind: 'model', sig: mediaSig }).toString()}`;
    const metadataUrl = `${origin}/api/creator-pack/nft/metadata?${new URLSearchParams({ taskId, name, idea, sig: metadataSig }).toString()}`;
    const voucherId = voucherIdFor(sessionId, taskId);
    const deployment = await getVoxelFlipDeployment();
    const contractAddress = deployment?.address || '';

    let existingMint = null;
    let existingMintChecked = false;
    let voucherUsed = false;
    if (ADDRESS_RE.test(contractAddress)) {
      const lookup = await findVoucherMint(contractAddress, wallet, voucherId);
      existingMintChecked = lookup.checked;
      voucherUsed = lookup.used;
      existingMint = lookup.mint;
      if (!lookup.checked) {
        return NextResponse.json({
          error: 'Base verification is temporarily unavailable, so VoxelFlip stopped before sending another mint. No transaction was sent. Use Recover existing mint again.',
        }, { status: 503 });
      }
      if (lookup.ownerMismatch) {
        return NextResponse.json({
          error: `This voucher was already minted to ${lookup.ownerMismatch}. VoxelFlip will not issue a duplicate.`,
          voucherUsed: true,
        }, { status: 409 });
      }
      if (lookup.used && !lookup.mint) {
        return NextResponse.json({
          error: 'This voucher is already minted on Base. VoxelFlip blocked a duplicate, but the explorer has not returned the original mint event yet. Use Recover existing mint again; do not approve another mint.',
          voucherUsed: true,
        }, { status: 409 });
      }
    }

    const canonicalMetadataUrl = existingMint?.metadataUrl || metadataUrl;
    const voucher = voucherUsed ? null : await mintVoucher(wallet, canonicalMetadataUrl, voucherId);

    try {
      await updateVoxelPopEntitlementMetadata(entitlement, {
        voxelflip_asset_id: assetId,
        voxelflip_wallet: wallet.toLowerCase(),
        voxelflip_metadata_url: canonicalMetadataUrl.slice(0, 500),
        ...(existingMint?.tokenId ? { voxelflip_token_id: String(existingMint.tokenId).slice(0, 80) } : {}),
        ...(existingMint?.txHash ? { voxelflip_tx_hash: String(existingMint.txHash) } : {}),
      });
    } catch (error) {
      console.warn('VoxelFlip entitlement metadata persistence is unavailable; mint can continue.', error);
    }

    const attribution = attributionFromMetadata(entitlement.metadata);
    await recordVoxelPopEvent({
      eventName: 'nft_prepared', eventKey: `nft_prepared:${sessionId}:${taskId}`, flowId: entitlement.metadata?.flow_id || null,
      stripeSessionId: entitlement.id, attribution,
      details: { assetId, format: 'glb', wallet: wallet.toLowerCase(), voucherReady: Boolean(voucher), voucherUsed, existingMint: Boolean(existingMint), existingMintChecked, payment_method: 'stripe' },
    });

    return NextResponse.json({
      ready: true,
      assetId,
      metadataUrl: canonicalMetadataUrl,
      imageUrl,
      modelUrl,
      sourcePreviewUrl: remoteImageUrl || null,
      name: `${name} · VoxelFlip`,
      wallet,
      voucherId,
      voucherUsed,
      mintConfigured: Boolean(voucher) || Boolean(existingMint),
      signature: voucher?.signature || null,
      signer: voucher?.signer || null,
      existingMint,
      existingMintChecked,
    });
  } catch (error) {
    console.error('VoxelFlip NFT preparation failed', error);
    return NextResponse.json({ error: 'Unable to prepare or recover this 3D voxel for NFT minting right now.' }, { status: 500 });
  }
}