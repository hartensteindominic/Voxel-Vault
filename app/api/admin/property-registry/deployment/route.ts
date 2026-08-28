import { NextResponse } from 'next/server';
import { Contract, JsonRpcProvider, getAddress, isAddress } from 'ethers';
import { requireVoxelVaultAdmin } from '../../../../../lib/admin-auth';
import {
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_EXPLORER,
  BASE_SEPOLIA_RPC,
  CANONICAL_PROPERTY_REGISTRY_ABI,
} from '../../../../../lib/vault/canonical-property-registry.js';
import {
  CANONICAL_REGISTRY_BYTECODE_PATH,
  CANONICAL_REGISTRY_CREATION_BYTECODE_LENGTH,
  CANONICAL_REGISTRY_CREATION_BYTECODE_SHA256,
  CANONICAL_REGISTRY_RUNTIME_BYTECODE_SHA256,
  sha256HexBytes,
} from '../../../../../lib/vault/canonical-property-registry-deployment.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store, private' } });
}

function setupMissing(error: any) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return code === '42P01'
    || code === '42703'
    || code === '42883'
    || /vault_property_registry_deployments|record_canonical_property_registry_deployment/i.test(message);
}

function provider() {
  return new JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL || BASE_SEPOLIA_RPC, BASE_SEPOLIA_CHAIN_ID, { staticNetwork: true });
}

async function verifiedExistingDeployment(admin: any) {
  const result = await admin
    .from('vault_property_registry_deployments')
    .select('chain_id,contract_address,owner_address,deployment_tx_hash,runtime_code_hash,deployed_block,active,verified_at')
    .eq('chain_id', BASE_SEPOLIA_CHAIN_ID)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data || result.data.active !== true) return null;

  const rpc = provider();
  const network = await rpc.getNetwork();
  if (Number(network.chainId) !== BASE_SEPOLIA_CHAIN_ID) throw new Error('PROPERTY_REGISTRY_RPC_WRONG_CHAIN');

  const contractAddress = getAddress(result.data.contract_address);
  const code = await rpc.getCode(contractAddress);
  if (!code || code === '0x') throw new Error('PROPERTY_REGISTRY_CODE_MISSING');
  const runtimeHash = sha256HexBytes(code).toLowerCase();
  if (runtimeHash !== CANONICAL_REGISTRY_RUNTIME_BYTECODE_SHA256.toLowerCase()
      || runtimeHash !== String(result.data.runtime_code_hash || '').toLowerCase()) {
    throw new Error('PROPERTY_REGISTRY_RUNTIME_MISMATCH');
  }

  const contract = new Contract(contractAddress, CANONICAL_PROPERTY_REGISTRY_ABI, rpc);
  const owner = getAddress(await contract.owner());
  if (owner !== getAddress(result.data.owner_address)) throw new Error('PROPERTY_REGISTRY_OWNER_MISMATCH');

  return {
    chainId: BASE_SEPOLIA_CHAIN_ID,
    contractAddress,
    ownerAddress: owner,
    deploymentTxHash: String(result.data.deployment_tx_hash || ''),
    deployedBlock: Number(result.data.deployed_block || 0),
    runtimeCodeHash: runtimeHash,
    verifiedAt: result.data.verified_at || null,
    explorerUrl: `${BASE_SEPOLIA_EXPLORER}/address/${contractAddress}`,
  };
}

export async function GET(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if ('error' in auth) return response({ ok: false, error: auth.error, setupRequired: Boolean(auth.setupRequired) }, auth.status);

  try {
    const existingDeployment = await verifiedExistingDeployment(auth.admin);
    return response({
      ok: true,
      network: { name: 'Base Sepolia', chainId: BASE_SEPOLIA_CHAIN_ID, explorer: BASE_SEPOLIA_EXPLORER },
      existingDeployment,
      deployAllowed: existingDeployment === null,
      bytecode: {
        path: CANONICAL_REGISTRY_BYTECODE_PATH,
        length: CANONICAL_REGISTRY_CREATION_BYTECODE_LENGTH,
        sha256: CANONICAL_REGISTRY_CREATION_BYTECODE_SHA256,
      },
      expectedRuntimeSha256: CANONICAL_REGISTRY_RUNTIME_BYTECODE_SHA256,
      controls: {
        mainnetAllowed: false,
        deploysProperty: false,
        registersProperty: false,
        verifiesProperty: false,
        mintsPassport: false,
        createsPropertyRights: false,
      },
    });
  } catch (error: any) {
    if (setupMissing(error)) {
      return response({ ok: false, setupRequired: true, error: 'Apply property registry migration 019 before deploying the canonical registry.' }, 503);
    }
    console.error('Canonical property registry deployment config failed', error);
    return response({ ok: false, error: 'Canonical registry deployment state failed independent verification.' }, 409);
  }
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if ('error' in auth) return response({ ok: false, error: auth.error, setupRequired: Boolean(auth.setupRequired) }, auth.status);

  try {
    const body = await request.json().catch(() => ({}));
    const rawAddress = String(body?.address || '').trim();
    const rawWallet = String(body?.wallet || '').trim();
    const txHash = String(body?.txHash || '').trim().toLowerCase();

    if (!isAddress(rawAddress)) return response({ ok: false, error: 'A valid deployed registry address is required.' }, 400);
    if (!isAddress(rawWallet)) return response({ ok: false, error: 'A valid deployment owner wallet is required.' }, 400);
    if (!/^0x[0-9a-f]{64}$/.test(txHash)) return response({ ok: false, error: 'A valid Base Sepolia deployment transaction hash is required.' }, 400);

    const address = getAddress(rawAddress);
    const wallet = getAddress(rawWallet);
    const rpc = provider();
    const network = await rpc.getNetwork();
    if (Number(network.chainId) !== BASE_SEPOLIA_CHAIN_ID) return response({ ok: false, error: 'Registry deployment verification is Base Sepolia only.' }, 503);

    const [receipt, tx] = await Promise.all([rpc.getTransactionReceipt(txHash), rpc.getTransaction(txHash)]);
    if (!receipt || receipt.status !== 1) return response({ ok: false, error: 'Base Sepolia deployment transaction is missing or did not succeed.' }, 409);
    if (!tx) return response({ ok: false, error: 'Base Sepolia deployment transaction could not be loaded.' }, 409);
    if (tx.to !== null) return response({ ok: false, error: 'Submitted transaction is not a contract-creation transaction.' }, 409);
    if (getAddress(tx.from) !== wallet) return response({ ok: false, error: 'Deployment transaction sender does not match the submitted owner wallet.' }, 409);
    if (!receipt.contractAddress || getAddress(receipt.contractAddress) !== address) {
      return response({ ok: false, error: 'Deployment receipt contract address does not match the submitted registry address.' }, 409);
    }

    const code = await rpc.getCode(address);
    if (!code || code === '0x') return response({ ok: false, error: 'No registry contract code exists at the submitted Base Sepolia address.' }, 409);
    const runtimeHash = sha256HexBytes(code).toLowerCase();
    if (runtimeHash !== CANONICAL_REGISTRY_RUNTIME_BYTECODE_SHA256.toLowerCase()) {
      return response({ ok: false, error: 'Deployed runtime bytecode does not match the exact CI-reviewed CanonicalPropertyRegistry build.' }, 409);
    }

    const contract = new Contract(address, CANONICAL_PROPERTY_REGISTRY_ABI, rpc);
    const onchainOwner = getAddress(await contract.owner());
    if (onchainOwner !== wallet) return response({ ok: false, error: 'Deployed registry owner does not match the deployment wallet.' }, 409);

    const saved = await auth.admin.rpc('record_canonical_property_registry_deployment', {
      p_chain_id: BASE_SEPOLIA_CHAIN_ID,
      p_contract_address: address.toLowerCase(),
      p_owner_address: wallet.toLowerCase(),
      p_deployment_tx_hash: txHash,
      p_runtime_code_hash: runtimeHash,
      p_deployed_block: receipt.blockNumber,
    });
    if (saved.error) {
      if (setupMissing(saved.error)) return response({ ok: false, setupRequired: true, error: 'Apply property registry migration 019 before registering the Base Sepolia deployment.' }, 503);
      throw saved.error;
    }

    const deployment = await verifiedExistingDeployment(auth.admin);
    if (!deployment) throw new Error('PROPERTY_REGISTRY_DEPLOYMENT_NOT_PERSISTED');

    return response({
      ok: true,
      deployment,
      audit: saved.data,
      nextStep: 'The canonical identity registry is verified and locked. Property registration remains a separate human-initiated action.',
    });
  } catch (error: any) {
    if (setupMissing(error)) return response({ ok: false, setupRequired: true, error: 'Apply property registry migration 019 before registering the Base Sepolia deployment.' }, 503);
    console.error('Canonical property registry deployment registration failed', error);
    return response({ ok: false, error: 'The Base Sepolia registry deployment could not be verified and locked safely.' }, 409);
  }
}
