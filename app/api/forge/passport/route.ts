import { NextResponse } from 'next/server';
import { Interface, JsonRpcProvider, getAddress, isAddress, zeroPadValue } from 'ethers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BASE_SEPOLIA_CHAIN_ID = 84532;
const DEFAULT_TEST_FORGE = '0x8A853C34Dba507f69c3CF802DC9c713a8116201A';
const RPC_URLS = [
  process.env.BASE_SEPOLIA_RPC_URL || '',
  'https://sepolia.base.org',
  'https://base-sepolia-rpc.publicnode.com',
].filter(Boolean);
const ABI = [
  'event Forged(uint256 indexed descendantTokenId,address indexed account,uint8 indexed outputTier,uint256 parentTokenId0,uint256 parentTokenId1,uint256 parentTokenId2,uint256 feeWei,bytes32 requestId)',
];
const iface = new Interface(ABI);
const forgedTopic = iface.getEvent('Forged')!.topicHash;

function clean(value: unknown, max = 200) {
  return String(value || '').trim().slice(0, max);
}

async function scan(provider: JsonRpcProvider, forge: string, wallet: string) {
  const latest = await provider.getBlockNumber();
  const windowBlocks = 750_000;
  const chunk = 50_000;
  const floor = Math.max(0, latest - windowBlocks);
  const walletTopic = zeroPadValue(wallet, 32);
  const logs: any[] = [];

  for (let to = latest; to >= floor; to -= chunk) {
    const from = Math.max(floor, to - chunk + 1);
    const found = await provider.getLogs({
      address: forge,
      topics: [forgedTopic, null, walletTopic],
      fromBlock: from,
      toBlock: to,
    });
    logs.push(...found);
  }

  const parsed = logs.map(log => {
    const event = iface.parseLog(log);
    if (!event) return null;
    return {
      tokenId: event.args.descendantTokenId.toString(),
      outputTier: Number(event.args.outputTier),
      parentTokenIds: [
        event.args.parentTokenId0.toString(),
        event.args.parentTokenId1.toString(),
        event.args.parentTokenId2.toString(),
      ],
      feeWei: event.args.feeWei.toString(),
      txHash: log.transactionHash,
      blockNumber: Number(log.blockNumber),
      logIndex: Number(log.index ?? 0),
    };
  }).filter(Boolean) as Array<any>;

  parsed.sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);
  return { latestBlock: latest, fromBlock: floor, events: parsed };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const walletRaw = clean(url.searchParams.get('wallet'), 80);
  const forgeRaw = clean(url.searchParams.get('forge') || DEFAULT_TEST_FORGE, 80);
  if (!isAddress(walletRaw)) return NextResponse.json({ error: 'Connect a valid wallet first.' }, { status: 400 });
  if (!isAddress(forgeRaw)) return NextResponse.json({ error: 'Invalid Forge address.' }, { status: 400 });
  const wallet = getAddress(walletRaw);
  const forge = getAddress(forgeRaw);

  let lastError = '';
  for (const rpc of RPC_URLS) {
    const provider = new JsonRpcProvider(rpc, BASE_SEPOLIA_CHAIN_ID, { staticNetwork: true });
    try {
      const result = await scan(provider, forge, wallet);
      const events = result.events;
      const latest = events.at(-1) || null;
      return NextResponse.json({
        wallet,
        forge,
        confirmedForges: events.length,
        forgeXp: events.length * 100,
        rareTokenIds: events.map(event => event.tokenId).reverse().slice(0, 12),
        recent: events.slice().reverse().slice(0, 6),
        latest,
        scannedFromBlock: result.fromBlock,
        scannedToBlock: result.latestBlock,
        note: 'Forge XP and badges are cosmetic testnet progress only and do not represent market or resale value.',
      }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error || 'RPC scan failed');
    } finally {
      provider.destroy();
    }
  }

  return NextResponse.json({ error: lastError || 'Could not read Forge history.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
}
