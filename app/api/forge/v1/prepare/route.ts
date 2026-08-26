import { isAddress } from 'ethers';
import { NextResponse } from 'next/server';
import { POST as previewPOST } from '../../../voxelflip/forge/preview/route';
import {
  buildVoucherDraft,
  hashLockedRecipe,
  VOXELFORGE_VOUCHER_PRIMARY_TYPE,
  VOXELFORGE_VOUCHER_TYPES,
} from '../../../../../lib/voxelforge-voucher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store, private',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function publicDescendantUri(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('ipfs://')) return raw;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return '';
    const host = parsed.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.local')) return '';
    if (/^127\.|^10\.|^0\.|^169\.254\.|^192\.168\./.test(host)) return '';
    const match172 = host.match(/^172\.(\d{1,3})\./);
    if (match172 && Number(match172[1]) >= 16 && Number(match172[1]) <= 31) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function configuredChainId() {
  const value = Number(process.env.VOXELFORGE_CHAIN_ID || 8453);
  return value === 84532 ? 84532 : 8453;
}

function configuredFeeWei() {
  const raw = String(process.env.VOXELFORGE_FEE_WEI || '').trim();
  return /^\d+$/.test(raw) ? raw : null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const wallet = String(body?.wallet || '').trim();
    const tokenIds = Array.isArray(body?.tokenIds) ? body.tokenIds : [];
    const descendantURI = publicDescendantUri(body?.descendantURI);

    const previewRequest = new Request(request.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ wallet, tokenIds }),
    });
    const previewResponse = await previewPOST(previewRequest);
    if (!previewResponse.ok) return previewResponse;
    const preview = await previewResponse.json();

    const parents = Array.isArray(preview?.parents) ? preview.parents : [];
    if (parents.length !== 3) return json({ error: 'Forge preparation requires exactly three verified parents.' }, 409);

    const parentTokenIds = parents.map((parent: any) => String(parent?.tokenId || ''));
    const parentTokenUris = parents.map((parent: any) => String(parent?.tokenUri || ''));
    if (parentTokenUris.some((uri: string) => !uri)) {
      return json({ error: 'All three parents must expose a tokenURI before a Forge voucher can be prepared.' }, 409);
    }

    const recipeHash = hashLockedRecipe({
      collectionAddress: String(preview?.contractAddress || ''),
      account: String(preview?.wallet || ''),
      parentTokenIds,
      descendant: preview?.descendant,
    });

    const chainId = configuredChainId();
    const forgeContractAddress = String(process.env.VOXELFORGE_CONTRACT_ADDRESS || '').trim();
    const validForgeContract = isAddress(forgeContractAddress) ? forgeContractAddress : null;
    const feeWei = configuredFeeWei();
    const deadline = Math.floor(Date.now() / 1000) + 5 * 60;

    const voucher = buildVoucherDraft({
      account: String(preview?.wallet || ''),
      parentTokenIds,
      parentTokenUris,
      recipeHash,
      descendantUri: descendantURI || null,
      feeWei,
      deadline,
    });

    const missing: string[] = [];
    if (!validForgeContract) missing.push('forgeContractAddress');
    if (!descendantURI) missing.push('serverIssuedDescendantURI');
    if (!feeWei) missing.push('atomicFeeQuote');
    missing.push('forgeSignerSignature');

    return json({
      prepared: true,
      executionEnabled: false,
      signingEnabled: false,
      chain: chainId === 84532 ? 'base-sepolia' : 'base',
      chainId,
      collectionAddress: preview?.contractAddress || null,
      forgeContractAddress: validForgeContract,
      wallet: preview?.wallet || null,
      parentTokenIds,
      descendant: preview?.descendant || null,
      recipeHash,
      fee: {
        displayUsd: '4.99',
        amountWei: feeWei,
        atomicQuoteReady: Boolean(feeWei),
      },
      eip712: {
        domain: validForgeContract
          ? {
              name: 'VoxelForge',
              version: '1',
              chainId,
              verifyingContract: validForgeContract,
            }
          : null,
        primaryType: VOXELFORGE_VOUCHER_PRIMARY_TYPE,
        types: VOXELFORGE_VOUCHER_TYPES,
        message: voucher,
        signature: null,
      },
      expiresAt: new Date(deadline * 1000).toISOString(),
      missing,
      notice: 'This endpoint prepares the exact locked ForgeVoucher structure only. It never signs the voucher, approves NFTs, sends a transaction, burns parents, mints a descendant, or charges a fee. A production signer must only sign a server-issued descendant URI and a fresh atomic fee quote after the Forge contract is deployed and reviewed.',
    });
  } catch (error) {
    console.error('VoxelForge prepare failed', error);
    return json({ error: 'Forge preparation failed safely. Nothing was signed, burned, minted, or charged.' }, 500);
  }
}
