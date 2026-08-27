import { Contract, JsonRpcProvider, getAddress, isAddress } from 'ethers';

export const BASE_CHAIN_ID = 8453;
export const BASE_WETH = getAddress('0x4200000000000000000000000000000000000006');
export const BASE_USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
export const BASE_UNISWAP_V3_FACTORY = getAddress('0x33128a8fC17869897dcE68Ed026d694621f6FDfD');
export const BASE_UNISWAP_V3_POSITION_MANAGER = getAddress('0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1');

const FLASHBLOCKS_RPC = 'https://mainnet-preconf.base.org';
const FEE_TIERS = [100, 500, 3000, 10000] as const;
const UINT256_MOD = BigInt(2) ** BigInt(256);

const FACTORY_ABI = [
  'function getPool(address tokenA,address tokenB,uint24 fee) view returns (address pool)',
  'function feeAmountTickSpacing(uint24 fee) view returns (int24 spacing)',
];
const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,uint8 feeProtocol,bool unlocked)',
  'function liquidity() view returns (uint128)',
  'function feeGrowthGlobal0X128() view returns (uint256)',
  'function feeGrowthGlobal1X128() view returns (uint256)',
];

type StateTag = 'pending' | 'latest';

type ProviderChoice = {
  provider: JsonRpcProvider;
  rpcHost: string;
  stateTag: StateTag;
  flashblocks: boolean;
  observedBlock: string;
};

function safeHost(url: string) {
  try { return new URL(url).hostname; } catch { return 'base-rpc'; }
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function delta256(newValue: bigint, oldValue: bigint) {
  return newValue >= oldValue ? newValue - oldValue : UINT256_MOD - oldValue + newValue;
}

function alignedCenter(tick: number, spacing: number) {
  return Math.floor(tick / spacing) * spacing;
}

async function chooseProvider(requireFlashblocks: boolean): Promise<ProviderChoice> {
  const flashUrl = String(process.env.BASE_FLASHBLOCKS_RPC_URL || '').trim() || FLASHBLOCKS_RPC;
  const standard = [
    String(process.env.BASE_RPC_URL || '').trim(),
    'https://base-rpc.publicnode.com',
    'https://mainnet.base.org',
  ].filter(Boolean);
  const candidates = [
    { url: flashUrl, stateTag: 'pending' as const, flashblocks: true },
    ...standard.map(url => ({ url, stateTag: 'latest' as const, flashblocks: false })),
  ];
  const seen = new Set<string>();
  const errors: string[] = [];

  for (const candidate of candidates) {
    if (seen.has(candidate.url)) continue;
    seen.add(candidate.url);
    const provider = new JsonRpcProvider(candidate.url, BASE_CHAIN_ID, { staticNetwork: true });
    try {
      if (candidate.flashblocks) {
        const block = await provider.send('eth_getBlockByNumber', ['pending', false]);
        if (!block || typeof block !== 'object') throw new Error('pending state unavailable');
        return {
          provider,
          rpcHost: safeHost(candidate.url),
          stateTag: 'pending',
          flashblocks: true,
          observedBlock: String((block as { number?: string }).number || 'pending'),
        };
      }
      if (requireFlashblocks) {
        provider.destroy();
        continue;
      }
      const blockNumber = await provider.getBlockNumber();
      return {
        provider,
        rpcHost: safeHost(candidate.url),
        stateTag: 'latest',
        flashblocks: false,
        observedBlock: String(blockNumber),
      };
    } catch (error) {
      errors.push(`${safeHost(candidate.url)}: ${error instanceof Error ? error.message : String(error)}`);
      provider.destroy();
    }
  }

  throw new Error(`No suitable Base state provider was available. ${errors.at(-1) || ''}`);
}

async function readPool(poolAddress: string, provider: JsonRpcProvider, blockTag: StateTag) {
  const pool = new Contract(poolAddress, POOL_ABI, provider);
  const [slot0, liquidity, growth0, growth1] = await Promise.all([
    pool.getFunction('slot0').staticCall({ blockTag }),
    pool.getFunction('liquidity').staticCall({ blockTag }),
    pool.getFunction('feeGrowthGlobal0X128').staticCall({ blockTag }),
    pool.getFunction('feeGrowthGlobal1X128').staticCall({ blockTag }),
  ]);
  return {
    sqrtPriceX96: BigInt(slot0[0]),
    tick: Number(slot0[1]),
    unlocked: Boolean(slot0[6]),
    liquidity: BigInt(liquidity),
    feeGrowth0: BigInt(growth0),
    feeGrowth1: BigInt(growth1),
  };
}

export async function scanBaseLiquidity(input: {
  widthMultiples?: unknown;
  requireFlashblocks?: boolean;
} = {}) {
  const widthMultiples = clampInteger(input.widthMultiples, 10, 1, 50);
  const requireFlashblocks = input.requireFlashblocks !== false;
  const chosen = await chooseProvider(requireFlashblocks);
  const factory = new Contract(BASE_UNISWAP_V3_FACTORY, FACTORY_ABI, chosen.provider);

  try {
    const rows = [] as Array<Record<string, unknown>>;
    for (const fee of FEE_TIERS) {
      const [poolRaw, spacingRaw] = await Promise.all([
        factory.getFunction('getPool').staticCall(BASE_WETH, BASE_USDC, fee, { blockTag: chosen.stateTag }),
        factory.getFunction('feeAmountTickSpacing').staticCall(fee, { blockTag: chosen.stateTag }),
      ]);
      const poolAddress = isAddress(poolRaw) ? getAddress(poolRaw) : '';
      const spacing = Number(spacingRaw);
      if (!poolAddress || poolAddress === '0x0000000000000000000000000000000000000000' || spacing <= 0) continue;

      const current = await readPool(poolAddress, chosen.provider, chosen.stateTag);
      let sealed = current;
      let feeGrowthDelta0 = BigInt(0);
      let feeGrowthDelta1 = BigInt(0);
      if (chosen.flashblocks) {
        sealed = await readPool(poolAddress, chosen.provider, 'latest');
        feeGrowthDelta0 = delta256(current.feeGrowth0, sealed.feeGrowth0);
        feeGrowthDelta1 = delta256(current.feeGrowth1, sealed.feeGrowth1);
      }

      const center = alignedCenter(current.tick, spacing);
      const halfWidth = spacing * widthMultiples;
      rows.push({
        fee,
        feePercent: fee / 1_000_000,
        poolAddress,
        tickSpacing: spacing,
        pendingTick: current.tick,
        sealedTick: sealed.tick,
        liquidityRaw: current.liquidity.toString(),
        feeGrowthDelta0X128: feeGrowthDelta0.toString(),
        feeGrowthDelta1X128: feeGrowthDelta1.toString(),
        feeGrowthChanged: feeGrowthDelta0 > BigInt(0) || feeGrowthDelta1 > BigInt(0),
        poolUnlocked: current.unlocked,
        suggestedRange: {
          tickLower: center - halfWidth,
          tickUpper: center + halfWidth,
          widthMultiples,
        },
        signal: chosen.flashblocks
          ? (feeGrowthDelta0 > BigInt(0) || feeGrowthDelta1 > BigInt(0) ? 'PENDING_FEE_ACTIVITY' : 'NO_PENDING_FEE_ACTIVITY')
          : 'SEALED_STATE_ONLY',
      });
    }

    rows.sort((a, b) => {
      const aActive = a.feeGrowthChanged ? 1 : 0;
      const bActive = b.feeGrowthChanged ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      const aLiquidity = BigInt(String(a.liquidityRaw));
      const bLiquidity = BigInt(String(b.liquidityRaw));
      return aLiquidity < bLiquidity ? -1 : aLiquidity > bLiquidity ? 1 : 0;
    });

    const managerRaw = String(process.env.BASE_LIQUIDITY_MANAGER_ADDRESS || process.env.NEXT_PUBLIC_BASE_LIQUIDITY_MANAGER_ADDRESS || '').trim();
    const managerAddress = isAddress(managerRaw) ? getAddress(managerRaw) : '';

    return {
      chainId: BASE_CHAIN_ID,
      network: 'Base',
      pair: 'WETH/USDC',
      token0: BASE_WETH,
      token1: BASE_USDC,
      factory: BASE_UNISWAP_V3_FACTORY,
      positionManager: BASE_UNISWAP_V3_POSITION_MANAGER,
      stateMode: chosen.flashblocks ? 'flashblocks-pending' : 'sealed-latest',
      flashblocks: chosen.flashblocks,
      rpcHost: chosen.rpcHost,
      observedBlock: chosen.observedBlock,
      scannedAt: new Date().toISOString(),
      managerAddress,
      executionConfigured: Boolean(managerAddress),
      pools: rows,
      interpretation: 'Fee-growth deltas are activity signals, not guaranteed fees, APR, or profit. A real LP entry still requires inventory valuation, tick-specific fee-growth accounting, gas, adverse-selection and impermanent-loss simulation.',
    };
  } finally {
    chosen.provider.destroy();
  }
}
