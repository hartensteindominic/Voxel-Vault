const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ZERO_TOPIC = `0x${'0'.repeat(64)}`;
const OWNER_OF_SELECTOR = '0x6352211e';
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const HASH = /^0x[a-fA-F0-9]{64}$/;

function hexNumber(value: unknown) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/i.test(value)) throw new Error('Base returned an invalid block number.');
  return Number.parseInt(value.slice(2), 16);
}

function normalizedAddress(value: unknown) {
  const address = String(value || '').toLowerCase();
  if (!ADDRESS.test(address)) throw new Error('Invalid EVM address.');
  return address;
}

export function validateBaseMintReceipt(receipt: any, currentBlockHex: string, input: { contractAddress: string; tokenId: string; confirmations: number }) {
  const contractAddress = normalizedAddress(input.contractAddress);
  if (!receipt || hexNumber(receipt.status) !== 1 || normalizedAddress(receipt.to) !== contractAddress) throw new Error('Mint transaction was not confirmed by the expected contract.');
  const blockNumber = hexNumber(receipt.blockNumber);
  const currentBlock = hexNumber(currentBlockHex);
  if (currentBlock - blockNumber + 1 < input.confirmations) throw new Error('Mint transaction does not have enough Base confirmations.');
  const tokenHex = BigInt(input.tokenId).toString(16).padStart(64, '0').toLowerCase();
  const mintLog = (receipt.logs || []).find((log: any) =>
    String(log.address || '').toLowerCase() === contractAddress &&
    String(log.topics?.[0] || '').toLowerCase() === TRANSFER_TOPIC &&
    String(log.topics?.[1] || '').toLowerCase() === ZERO_TOPIC &&
    String(log.topics?.[3] || '').slice(2).toLowerCase() === tokenHex
  );
  if (!mintLog) throw new Error('Transaction does not contain the expected ERC-721 mint event.');
  return { blockNumber };
}

export async function verifyBaseMint(input: { contractAddress: string; tokenId: string; transactionHash: string }) {
  const rpcUrl = process.env.BASE_RPC_URL;
  if (!rpcUrl) throw new Error('BASE_RPC_URL is not configured.');
  if (!process.env.VAULT_NFT_INVENTORY_OWNER) throw new Error('VAULT_NFT_INVENTORY_OWNER is not configured.');
  const inventoryOwner = normalizedAddress(process.env.VAULT_NFT_INVENTORY_OWNER);
  if (!HASH.test(input.transactionHash)) throw new Error('Invalid mint transaction hash.');
  const confirmations = Math.max(1, Number.parseInt(process.env.BASE_MINT_CONFIRMATIONS || '3', 10) || 3);
  let id = 0;
  async function rpc(method: string, params: unknown[]) {
    const response = await fetch(rpcUrl, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params}), cache:'no-store' });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || payload.error) throw new Error(`Base RPC ${method} failed.`);
    return payload.result;
  }
  const [receipt,currentBlock] = await Promise.all([
    rpc('eth_getTransactionReceipt',[input.transactionHash]),
    rpc('eth_blockNumber',[]),
  ]);
  const evidence = validateBaseMintReceipt(receipt,currentBlock,{...input,confirmations});
  const tokenHex = BigInt(input.tokenId).toString(16).padStart(64,'0');
  const ownerResult = await rpc('eth_call',[{to:normalizedAddress(input.contractAddress),data:`${OWNER_OF_SELECTOR}${tokenHex}`},'latest']);
  const owner = normalizedAddress(`0x${String(ownerResult || '').slice(-40)}`);
  if (owner !== inventoryOwner) throw new Error('Pre-minted token is not owned by the configured Vault inventory wallet.');
  return { chainId:8453, owner, blockNumber:evidence.blockNumber, confirmedAt:new Date().toISOString(), confirmations };
}
