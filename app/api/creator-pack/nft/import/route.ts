import { Contract, JsonRpcProvider } from 'ethers';
import { NextResponse } from 'next/server';
import { recordVoxelPopEvent } from '../../../../../lib/voxelpop-analytics';

export const runtime = 'nodejs';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const ABI = ['function ownerOf(uint256 tokenId) view returns (address)','function tokenURI(uint256 tokenId) view returns (string)'];

function configuredChain() {
  const chainId = String(process.env.NEXT_PUBLIC_VOXELFLIP_CHAIN_ID || '0x2105').toLowerCase();
  if (chainId === '0x14a34') return { id: chainId, slug: 'base_sepolia', apiSlug: 'base_sepolia', explorer: 'https://sepolia.basescan.org', rpc: process.env.VOXELFLIP_RPC_URL || process.env.NEXT_PUBLIC_VOXELFLIP_RPC_URL || 'https://sepolia.base.org' };
  if (chainId === '0xaa36a7') return { id: chainId, slug: 'sepolia', apiSlug: 'sepolia', explorer: 'https://sepolia.etherscan.io', rpc: process.env.VOXELFLIP_RPC_URL || process.env.NEXT_PUBLIC_VOXELFLIP_RPC_URL || '' };
  if (chainId === '0x1') return { id: chainId, slug: 'ethereum', apiSlug: 'ethereum', explorer: 'https://etherscan.io', rpc: process.env.VOXELFLIP_RPC_URL || process.env.NEXT_PUBLIC_VOXELFLIP_RPC_URL || process.env.MAINNET_RPC_URL || 'https://cloudflare-eth.com' };
  return { id: '0x2105', slug: 'base', apiSlug: 'base', explorer: 'https://basescan.org', rpc: process.env.VOXELFLIP_RPC_URL || process.env.NEXT_PUBLIC_VOXELFLIP_RPC_URL || 'https://mainnet.base.org' };
}

function parseToken(value: unknown, contractAddress: string) {
  const raw = String(value || '').trim();
  if (/^\d+$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (!/(^|\.)opensea\.io$/i.test(url.hostname)) return '';
    const parts = url.pathname.split('/').filter(Boolean);
    const assets = parts.indexOf('assets');
    if (assets < 0 || parts.length < assets + 4) return '';
    const contract = parts[assets + 2];
    const tokenId = parts[assets + 3];
    if (contract?.toLowerCase() !== contractAddress.toLowerCase() || !/^\d+$/.test(tokenId || '')) return '';
    return tokenId;
  } catch { return ''; }
}

async function readMetadata(uri: string) {
  if (!/^https:\/\//i.test(uri)) throw new Error('VoxelFlip metadata must use an HTTPS URI.');
  const response = await fetch(uri, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('VoxelFlip metadata could not be loaded.');
  const data = await response.json();
  return {
    name: String(data?.name || 'VoxelFlip'),
    description: String(data?.description || ''),
    image: typeof data?.image === 'string' ? data.image : '',
    animationUrl: typeof data?.animation_url === 'string' ? data.animation_url : '',
    externalUrl: typeof data?.external_url === 'string' ? data.external_url : '',
    attributes: Array.isArray(data?.attributes) ? data.attributes.slice(0, 40) : [],
  };
}

async function optionalOpenSeaData(chain: string, contract: string, tokenId: string) {
  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch(`https://api.opensea.io/api/v2/chain/${encodeURIComponent(chain)}/contract/${contract}/nfts/${tokenId}`, {
      headers: { 'x-api-key': apiKey, accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return { collection: data?.nft?.collection || null, displayImageUrl: data?.nft?.display_image_url || null, updatedAt: data?.nft?.updated_at || null };
  } catch { return null; }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const wallet = typeof body?.wallet === 'string' ? body.wallet.trim() : '';
    const contractAddress = process.env.NEXT_PUBLIC_VOXELFLIP_NFT_ADDRESS || '';
    if (!ADDRESS_RE.test(wallet)) return NextResponse.json({ error: 'Connect a valid wallet first.' }, { status: 400 });
    if (!ADDRESS_RE.test(contractAddress)) return NextResponse.json({ error: 'VoxelFlip collection is not configured on this deployment yet.' }, { status: 503 });
    const tokenId = parseToken(body?.token || body?.openSeaUrl || body?.tokenId, contractAddress);
    if (!tokenId) return NextResponse.json({ error: 'Paste a VoxelFlip OpenSea asset URL or token ID.' }, { status: 400 });

    const chain = configuredChain();
    if (!chain.rpc) return NextResponse.json({ error: 'VoxelFlip RPC is not configured.' }, { status: 503 });
    const provider = new JsonRpcProvider(chain.rpc);
    const contract = new Contract(contractAddress, ABI, provider);
    const [owner, tokenUri] = await Promise.all([contract.ownerOf(tokenId), contract.tokenURI(tokenId)]);
    if (String(owner).toLowerCase() !== wallet.toLowerCase()) return NextResponse.json({ error: 'That wallet does not currently own this VoxelFlip NFT.' }, { status: 403 });

    const metadata = await readMetadata(String(tokenUri));
    const openSeaUrl = `${chain.slug.includes('sepolia') ? 'https://testnets.opensea.io' : 'https://opensea.io'}/assets/${chain.slug}/${contractAddress}/${tokenId}`;
    const openSea = await optionalOpenSeaData(chain.apiSlug, contractAddress, tokenId);
    await recordVoxelPopEvent({ eventName: 'nft_imported', eventKey: `nft_imported:${contractAddress.toLowerCase()}:${tokenId}:${wallet.toLowerCase()}`, details: { tokenId, wallet: wallet.toLowerCase(), chain: chain.slug, opensea_api: Boolean(openSea) } });

    return NextResponse.json({
      imported: true,
      tokenId,
      owner: wallet,
      contract: contractAddress,
      tokenUri: String(tokenUri),
      openSeaUrl,
      explorerUrl: `${chain.explorer}/token/${contractAddress}?a=${tokenId}`,
      metadata,
      openSea,
    });
  } catch (error) {
    console.error('VoxelFlip import failed', error);
    return NextResponse.json({ error: 'Unable to import that VoxelFlip NFT right now.' }, { status: 500 });
  }
}
