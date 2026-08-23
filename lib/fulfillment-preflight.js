import { getFulfillmentConfig } from './fulfillment.js';

function readPilotEntry(catalogKey) {
  try {
    const map = JSON.parse(process.env.VOXEL_FULFILLMENT_CATALOG || '{}');
    const entry = map?.[catalogKey];
    return entry && typeof entry === 'object' ? entry : null;
  } catch {
    return null;
  }
}

export async function preflightPhysicalFulfillment(catalogKey) {
  const config = getFulfillmentConfig(catalogKey);
  const entry = readPilotEntry(catalogKey);
  if (!config || !entry) return { configured: false, available: false, reason: 'FULFILLMENT_NOT_READY' };
  if (entry.pilotEnabled !== true) return { configured: true, available: false, reason: 'PILOT_DISABLED' };
  const shippingUsd = Number(entry.shippingUsd);
  if (!Number.isFinite(shippingUsd) || shippingUsd < 0) return { configured: true, available: false, reason: 'SHIPPING_NOT_CONFIGURED' };
  return { configured: true, available: true, provider: config.provider, costUsd: config.costUsd, shippingUsd };
}
