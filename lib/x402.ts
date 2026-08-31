import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { x402ResourceServer } from '@x402/next';
import { BASE_NETWORK, DEFAULT_RECEIVER, requireAddress, shortAddress } from './config';

export const X402_FACILITATOR_URL = process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator';
const X402_NETWORK = BASE_NETWORK as `${string}:${string}`;

const facilitatorClient = new HTTPFacilitatorClient({ url: X402_FACILITATOR_URL });

export const resourceServer = new x402ResourceServer(facilitatorClient).register(
  X402_NETWORK,
  new ExactEvmScheme()
);

export function x402PayTo() {
  return requireAddress(process.env.X402_PAY_TO, DEFAULT_RECEIVER);
}

export function licensePrice() {
  const configured = String(process.env.X402_LICENSE_PRICE || '$0.01').trim();
  return /^\$\d+(\.\d{1,6})?$/.test(configured) ? configured : '$0.01';
}

export function x402Status() {
  const payTo = x402PayTo();
  return {
    configured: Boolean(payTo && X402_FACILITATOR_URL),
    payTo,
    payToShort: shortAddress(payTo),
    facilitator: X402_FACILITATOR_URL,
    network: X402_NETWORK,
    protocol: 'x402',
    asset: 'USDC'
  };
}

export function licenseRouteConfig() {
  return {
    accepts: {
      scheme: 'exact' as const,
      price: licensePrice(),
      network: X402_NETWORK,
      payTo: x402PayTo(),
      maxTimeoutSeconds: 60
    },
    description: 'One machine-use license receipt for one eligible Galactic VoxelFlip asset.',
    mimeType: 'application/json'
  };
}
