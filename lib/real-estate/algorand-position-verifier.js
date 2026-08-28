import { createHash } from 'node:crypto';

const clean = (value) => String(value ?? '').trim();
const UINT64_MAX = 18446744073709551615n;

export const ALGORAND_ONCHAIN_HOLDING_VERIFIER_IMPLEMENTATION_READY = true;
export const ALGORAND_WALLET_CONTROL_VERIFIER_IMPLEMENTATION_READY = false;
export const ALGORAND_ISSUER_PROPERTY_MAPPING_VERIFIER_IMPLEMENTATION_READY = false;

function readBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(clean(value).toLowerCase());
}

function parseBaseUrl(value) {
  const raw = clean(value).replace(/\/+$/, '');
  if (!raw) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('ALGORAND_INDEXER_BASE_URL must be a valid HTTPS URL.');
  }
  if (url.protocol !== 'https:') throw new Error('ALGORAND_INDEXER_BASE_URL must use HTTPS.');
  if (url.username || url.password) throw new Error('Do not place credentials inside ALGORAND_INDEXER_BASE_URL.');
  return url.toString().replace(/\/+$/, '');
}

export function getAlgorandVerifierConfig(env = process.env) {
  const baseUrl = parseBaseUrl(env.ALGORAND_INDEXER_BASE_URL);
  const token = clean(env.ALGORAND_INDEXER_API_TOKEN);
  const tokenHeader = clean(env.ALGORAND_INDEXER_API_TOKEN_HEADER) || 'X-Indexer-API-Token';
  if (!/^[A-Za-z0-9-]+$/.test(tokenHeader)) throw new Error('ALGORAND_INDEXER_API_TOKEN_HEADER contains invalid characters.');
  const enabled = readBoolean(env.ALGORAND_READONLY_POSITION_VERIFICATION_ENABLED);
  const productionReady = Boolean(baseUrl && enabled);
  const blockers = [];
  if (!baseUrl) blockers.push('ALGORAND_INDEXER_BASE_URL is not configured');
  if (!enabled) blockers.push('ALGORAND_READONLY_POSITION_VERIFICATION_ENABLED is not true');

  return {
    baseUrl,
    token,
    tokenHeader,
    enabled,
    productionReady,
    blockers,
    implementationReady: ALGORAND_ONCHAIN_HOLDING_VERIFIER_IMPLEMENTATION_READY,
  };
}

function base32Value(char) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  return alphabet.indexOf(char);
}

function decodeBase32NoPadding(input) {
  let bits = 0;
  let value = 0;
  const output = [];
  for (const char of input) {
    const digit = base32Value(char);
    if (digit < 0) throw new Error('Algorand address contains invalid Base32 characters.');
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
      value &= (1 << bits) - 1;
    }
  }
  return Buffer.from(output);
}

export function validateAlgorandAddress(value) {
  const address = clean(value).toUpperCase();
  if (!/^[A-Z2-7]{58}$/.test(address)) {
    throw new Error('Algorand address must be a 58-character public address.');
  }
  const decoded = decodeBase32NoPadding(address);
  if (decoded.length !== 36) throw new Error('Algorand address has an invalid encoded length.');
  const publicKey = decoded.subarray(0, 32);
  const checksum = decoded.subarray(32, 36);
  const digest = createHash('sha512-256').update(publicKey).digest();
  const expected = digest.subarray(digest.length - 4);
  if (!checksum.equals(expected)) throw new Error('Algorand address checksum is invalid.');
  return address;
}

export function normalizeAlgorandAssetId(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new Error('Algorand asset ID must be provided as an exact integer string when it exceeds JavaScript safe-integer precision.');
  }
  const raw = clean(value);
  if (!/^\d+$/.test(raw)) throw new Error('Algorand asset ID must be a positive integer.');
  const assetId = BigInt(raw);
  if (assetId <= 0n || assetId > UINT64_MAX) throw new Error('Algorand asset ID is outside the uint64 range.');
  return assetId.toString();
}

function normalizeUnsignedInteger(value, label) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new Error(`${label} exceeds JavaScript safe-integer precision; the configured Indexer must return an exact JSON-safe value for this verifier.`);
  }
  const raw = clean(value);
  if (!/^\d+$/.test(raw)) throw new Error(`${label} was not returned as an unsigned integer.`);
  return BigInt(raw).toString();
}

function buildHeaders(config) {
  const headers = { Accept: 'application/json' };
  if (config.token) headers[config.tokenHeader] = config.token;
  return headers;
}

async function readJson(url, config, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: buildHeaders(config),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    throw Object.assign(new Error(`Algorand Indexer request failed: ${error instanceof Error ? error.message : 'network error'}`), { code: 'INDEXER_UNAVAILABLE' });
  }
  if (!response?.ok) {
    throw Object.assign(new Error(`Algorand Indexer returned HTTP ${response?.status || 'error'}.`), { code: response?.status === 404 ? 'NOT_FOUND' : 'INDEXER_UNAVAILABLE' });
  }
  const body = await response.json().catch(() => null);
  if (!body || typeof body !== 'object') throw Object.assign(new Error('Algorand Indexer returned an unreadable response.'), { code: 'INDEXER_UNAVAILABLE' });
  return body;
}

function holdingAssetId(holding) {
  const value = holding?.['asset-id'] ?? holding?.assetId ?? holding?.index;
  if (value === undefined || value === null) return '';
  try {
    return normalizeAlgorandAssetId(value);
  } catch {
    return '';
  }
}

function assetIndex(asset) {
  const value = asset?.index ?? asset?.['asset-id'] ?? asset?.assetId;
  if (value === undefined || value === null) return '';
  try {
    return normalizeAlgorandAssetId(value);
  } catch {
    return '';
  }
}

function safeAssetText(value, max = 512) {
  return clean(value).slice(0, max);
}

export async function verifyAlgorandAssetHolding(input = {}, options = {}) {
  const env = options.env || process.env;
  let config;
  try {
    config = getAlgorandVerifierConfig(env);
  } catch (error) {
    throw Object.assign(new Error(`Algorand read-only verification configuration is invalid: ${error instanceof Error ? error.message : 'configuration error'}`), { code: 'VERIFIER_NOT_CONFIGURED' });
  }
  if (!config.productionReady && !options.allowUnconfiguredForTest) {
    throw Object.assign(new Error(`Algorand read-only verification is not configured: ${config.blockers.join('; ')}`), { code: 'VERIFIER_NOT_CONFIGURED' });
  }

  const walletAddress = validateAlgorandAddress(input.walletAddress);
  const assetId = normalizeAlgorandAssetId(input.assetId);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw Object.assign(new Error('No fetch implementation is available.'), { code: 'INDEXER_UNAVAILABLE' });
  const baseUrl = config.baseUrl || 'https://indexer.example.invalid';

  const holdingsUrl = new URL(`${baseUrl}/v2/accounts/${encodeURIComponent(walletAddress)}/assets`);
  holdingsUrl.searchParams.set('asset-id', assetId);
  holdingsUrl.searchParams.set('limit', '1');
  const assetUrl = new URL(`${baseUrl}/v2/assets/${assetId}`);

  const [holdingBody, assetBody] = await Promise.all([
    readJson(holdingsUrl.toString(), config, fetchImpl),
    readJson(assetUrl.toString(), config, fetchImpl),
  ]);

  const holdings = Array.isArray(holdingBody.assets) ? holdingBody.assets : [];
  const holding = holdings.find((item) => holdingAssetId(item) === assetId) || null;
  const asset = assetBody.asset && typeof assetBody.asset === 'object' ? assetBody.asset : null;
  if (!asset || assetIndex(asset) !== assetId) {
    throw Object.assign(new Error('Algorand Indexer did not return the requested asset metadata.'), { code: 'ASSET_METADATA_MISMATCH' });
  }

  const amountAtomic = holding ? normalizeUnsignedInteger(holding.amount ?? '0', 'Asset holding amount') : '0';
  const decimalsRaw = asset.params?.decimals ?? 0;
  const decimals = Number(decimalsRaw);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 19) throw new Error('Algorand asset decimals are outside the expected range.');
  const denominator = 10n ** BigInt(decimals);
  const whole = BigInt(amountAtomic) / denominator;
  const remainder = BigInt(amountAtomic) % denominator;
  const quantity = decimals === 0
    ? whole.toString()
    : `${whole}.${remainder.toString().padStart(decimals, '0')}`.replace(/\.?0+$/, '');
  const positiveHolding = BigInt(amountAtomic) > 0n;

  return {
    network: 'algorand',
    verificationType: 'public-onchain-asset-holding',
    source: 'configured Algorand Indexer API',
    walletAddress,
    assetId,
    holding: {
      found: Boolean(holding),
      positive: positiveHolding,
      amountAtomic,
      quantity,
      decimals,
      frozen: Boolean(holding?.['is-frozen'] ?? holding?.isFrozen ?? false),
    },
    asset: {
      creator: safeAssetText(asset.params?.creator, 128),
      name: safeAssetText(asset.params?.name, 256),
      unitName: safeAssetText(asset.params?.['unit-name'] ?? asset.params?.unitName, 64),
      url: safeAssetText(asset.params?.url, 512),
      totalAtomic: asset.params?.total !== undefined ? normalizeUnsignedInteger(asset.params.total, 'Asset total supply') : '',
      manager: safeAssetText(asset.params?.manager, 128),
      reserve: safeAssetText(asset.params?.reserve, 128),
      freeze: safeAssetText(asset.params?.freeze, 128),
      clawback: safeAssetText(asset.params?.clawback, 128),
      deleted: Boolean(asset.deleted),
    },
    evidence: {
      onChainHoldingVerified: positiveHolding && !asset.deleted,
      walletControlVerified: false,
      issuerPropertyMappingVerified: false,
      legalPropertyRightsVerified: false,
      rightsType: 'reference_only',
      targetRightsType: 'provider_fractional_security',
    },
    legalEffects: {
      provesWalletControl: false,
      provesInvestorIdentity: false,
      provesLlcMembership: false,
      provesTitleOwnership: false,
      provesPropertySecurityRights: false,
      createsOwnershipRights: false,
      movesFunds: false,
      signsTransactions: false,
    },
    blockers: [
      'wallet-control proof is not implemented',
      'approved issuer/legal-entity-to-property mapping verifier is not implemented',
      'canonical parcel/property rights must be verified separately',
    ],
  };
}

export function publicAlgorandVerifierStatus(env = process.env) {
  try {
    const config = getAlgorandVerifierConfig(env);
    return {
      implementationReady: ALGORAND_ONCHAIN_HOLDING_VERIFIER_IMPLEMENTATION_READY,
      configured: config.productionReady,
      enabled: config.enabled,
      indexerConfigured: Boolean(config.baseUrl),
      indexerTokenConfigured: Boolean(config.token),
      walletControlVerifierImplementationReady: ALGORAND_WALLET_CONTROL_VERIFIER_IMPLEMENTATION_READY,
      issuerPropertyMappingVerifierImplementationReady: ALGORAND_ISSUER_PROPERTY_MAPPING_VERIFIER_IMPLEMENTATION_READY,
      canVerifyPublicHolding: config.productionReady,
      canVerifyLegalPropertyRights: false,
      blockers: config.blockers,
    };
  } catch (error) {
    return {
      implementationReady: ALGORAND_ONCHAIN_HOLDING_VERIFIER_IMPLEMENTATION_READY,
      configured: false,
      enabled: false,
      indexerConfigured: false,
      indexerTokenConfigured: false,
      walletControlVerifierImplementationReady: ALGORAND_WALLET_CONTROL_VERIFIER_IMPLEMENTATION_READY,
      issuerPropertyMappingVerifierImplementationReady: ALGORAND_ISSUER_PROPERTY_MAPPING_VERIFIER_IMPLEMENTATION_READY,
      canVerifyPublicHolding: false,
      canVerifyLegalPropertyRights: false,
      blockers: [`invalid Algorand verifier configuration: ${error instanceof Error ? error.message : 'configuration error'}`],
    };
  }
}
