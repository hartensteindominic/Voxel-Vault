export const BASE_CHAIN_ID = 8453;
export const BASE_NETWORK = 'eip155:8453';
export const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

export const DEFAULT_RECEIVER = '0x02f93c7547309ca50EEAB446DaEBE8ce8E694cBb';
export const DEFAULT_LICENSE_USDC_ATOMIC = '10000';
export const DEFAULT_VOXELFLIP_CONTRACT = '0xa00758b05f96ef4409d97c3ffebb6794b2eafbde';
export const DEFAULT_VOXELFLIP_DEPLOYMENT_TX = '0xc2f198a3730169bc5c61f0a1251301f16d40441c022b6cc30e9cf06bb8ea31bb';

export function clean(value: unknown, max = 240) {
  return String(value || '').trim().slice(0, max);
}

export function isAddress(value: unknown) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || '').trim());
}

export function requireAddress(value: unknown, fallback: string) {
  const raw = clean(value, 80);
  return isAddress(raw) ? raw : fallback;
}

export function shortAddress(value: string) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : 'not set';
}

export function licenseAtomicAmount() {
  const raw = clean(process.env.X402_LICENSE_USDC_ATOMIC, 32);
  return /^\d+$/.test(raw) ? raw : DEFAULT_LICENSE_USDC_ATOMIC;
}

export function baseUsdcPaymentUri(payTo = DEFAULT_RECEIVER) {
  const receiver = requireAddress(payTo, DEFAULT_RECEIVER);
  return `ethereum:${BASE_USDC_ADDRESS}@${BASE_CHAIN_ID}/transfer?address=${receiver}&uint256=${licenseAtomicAmount()}`;
}

export function metamaskSendLink(payTo = DEFAULT_RECEIVER) {
  const receiver = requireAddress(payTo, DEFAULT_RECEIVER);
  return `https://metamask.app.link/send/${receiver}@${BASE_CHAIN_ID}`;
}
