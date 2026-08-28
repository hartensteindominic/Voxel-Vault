import { NextResponse } from 'next/server';
import { Contract, Interface, JsonRpcProvider, getAddress } from 'ethers';
import { requireVoxelVaultAdmin } from '../../../../lib/admin-auth';
import {
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_EXPLORER,
  BASE_SEPOLIA_RPC,
  CANONICAL_PROPERTY_REGISTRY_ABI,
  buildCanonicalPropertyAnchor,
  isPropertyNotRegisteredError,
  registryAddressFromEnvironment,
  shortHash,
} from '../../../../lib/vault/canonical-property-registry.js';

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
    || /vault_property_registry_anchor_events|record_property_registry_anchor|registry_registered_tx_hash/i.test(message);
}

function identityObject(row: any) {
  const value = row?.vault_property_identities;
  return Array.isArray(value) ? value[0] || {} : value || {};
}

function safeCandidate(row: any) {
  const identity = identityObject(row);
  return {
    claimId: String(row?.id || ''),
    propertyIdentityId: String(identity?.id || ''),
    propertyLabel: String(row?.property_label || ''),
    locality: String(row?.locality || ''),
    claimStatus: String(row?.claim_status || ''),
    canonicalState: String(identity?.canonical_state || ''),
    authoritativeFingerprintSuffix: shortHash(identity?.verified_property_fingerprint, 12),
    registryPropertyIdSuffix: shortHash(identity?.registry_property_id, 12),
    registryRegistered: Boolean(identity?.registry_registered_tx_hash),
    registryVerified: identity?.registry_verified === true,
    passportMinted: Boolean(identity?.canonical_passport_token_id),
  };
}

async function loadClaim(admin: any, claimId: string) {
  const result = await admin
    .from('vault_property_claims')
    .select('id,user_id,property_label,locality,claim_status,reviewed_at,vault_property_identities!inner(id,canonical_state,verified_claim_id,verified_property_fingerprint,verified_property_namespace,verified_property_source,verified_property_source_checked_at,registry_chain_id,registry_contract_address,registry_property_id,registry_verified,registry_registered_tx_hash,registry_registered_at,registry_verified_tx_hash,registry_verified_at,registry_claim_hash,registry_source_hash,registry_metadata_uri,canonical_passport_token_id)')
    .eq('id', claimId)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) return null;
  return { row: result.data, identity: identityObject(result.data) };
}

function provider() {
  return new JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL || BASE_SEPOLIA_RPC, BASE_SEPOLIA_CHAIN_ID, { staticNetwork: true });
}

async function expectedAnchor(request: Request, admin: any, claimId: string) {
  const loaded = await loadClaim(admin, claimId);
  if (!loaded) return { error: response({ ok: false, error: 'Verified property claim was not found.' }, 404) };

  const { row, identity } = loaded;
  if (row.claim_status !== 'verified'
      || String(identity?.verified_claim_id || '') !== String(row.id)
      || !['verified', 'passport-minted'].includes(String(identity?.canonical_state || ''))) {
    return { error: response({ ok: false, error: 'Only the single human-verified canonical claim may enter the registry anchor flow.' }, 409) };
  }

  let anchor;
  try {
    anchor = buildCanonicalPropertyAnchor({
      claimId: row.id,
      identity,
      appUrl: process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin,
    });
  } catch (error: any) {
    return { error: response({ ok: false, error: error?.message || 'Authoritative property identity is incomplete.' }, 409) };
  }

  const contractAddress = registryAddressFromEnvironment();
  if (!contractAddress) {
    return {
      error: response({
        ok: false,
        setupRequired: true,
        error: 'Canonical property registry is not configured yet. Deploy the reviewed Base Sepolia registry, register its address, and redeploy before anchoring a property.',
      }, 503),
    };
  }

  const rpc = provider();
  const network = await rpc.getNetwork();
  if (Number(network.chainId) !== BASE_SEPOLIA_CHAIN_ID) {
    return { error: response({ ok: false, error: 'Property registry RPC is not Base Sepolia. Anchoring is locked.' }, 503) };
  }

  const code = await rpc.getCode(contractAddress);
  if (!code || code === '0x') {
    return { error: response({ ok: false, setupRequired: true, error: 'Configured canonical property registry has no contract code on Base Sepolia.' }, 503) };
  }

  const contract = new Contract(contractAddress, CANONICAL_PROPERTY_REGISTRY_ABI, rpc);
  const owner = getAddress(await contract.owner());

  const dbContract = String(identity?.registry_contract_address || '').trim();
  if (dbContract && getAddress(dbContract) !== contractAddress) {
    return { error: response({ ok: false, error: 'Database registry contract does not match the configured Base Sepolia registry. Anchoring stopped.' }, 409) };
  }
  const dbPropertyId = String(identity?.registry_property_id || '').trim().toLowerCase();
  if (dbPropertyId && dbPropertyId !== anchor.propertyId.toLowerCase()) {
    return { error: response({ ok: false, error: 'Database property ID does not match the authoritative fingerprint. Anchoring stopped.' }, 409) };
  }
  const dbClaimHash = String(identity?.registry_claim_hash || '').trim().toLowerCase();
  if (dbClaimHash && dbClaimHash !== anchor.claimHash.toLowerCase()) {
    return { error: response({ ok: false, error: 'Database registry claim hash does not match the verified claim. Anchoring stopped.' }, 409) };
  }
  const dbSourceHash = String(identity?.registry_source_hash || '').trim().toLowerCase();
  if (dbSourceHash && dbSourceHash !== anchor.sourceHash.toLowerCase()) {
    return { error: response({ ok: false, error: 'Database registry source hash does not match the independently checked source. Anchoring stopped.' }, 409) };
  }

  return { row, identity, anchor, contractAddress, rpc, contract, owner };
}

export async function GET(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if ('error' in auth) return response({ ok: false, error: auth.error, setupRequired: Boolean(auth.setupRequired) }, auth.status);

  try {
    const url = new URL(request.url);
    const claimId = String(url.searchParams.get('claimId') || '').trim();

    if (!claimId) {
      const result = await auth.admin
        .from('vault_property_claims')
        .select('id,property_label,locality,claim_status,vault_property_identities!inner(id,canonical_state,verified_property_fingerprint,registry_property_id,registry_verified,registry_registered_tx_hash,canonical_passport_token_id)')
        .eq('claim_status', 'verified')
        .order('reviewed_at', { ascending: false })
        .limit(100);
      if (result.error) {
        if (setupMissing(result.error)) return response({ ok: false, setupRequired: true, error: 'Apply property registry migration 019 before using the anchor console.' }, 503);
        throw result.error;
      }
      return response({
        ok: true,
        candidates: (result.data || []).map(safeCandidate),
        controls: {
          network: 'Base Sepolia',
          chainId: BASE_SEPOLIA_CHAIN_ID,
          mainnetAllowed: false,
          canMintPassport: false,
          canCreatePropertyRights: false,
        },
      });
    }

    const prepared: any = await expectedAnchor(request, auth.admin, claimId);
    if (prepared.error) return prepared.error;
    const { row, identity, anchor, contractAddress, contract, owner } = prepared;

    let onchain: any = null;
    try {
      onchain = await contract.getIdentity(anchor.propertyId);
    } catch (error: any) {
      if (!isPropertyNotRegisteredError(error)) throw error;
    }

    if (!onchain) {
      if (identity.registry_registered_tx_hash) {
        return response({ ok: false, error: 'Database says this property was registered, but the configured Base Sepolia registry has no matching identity. Manual reconciliation is required.' }, 409);
      }
      return response({
        ok: true,
        stage: 'register',
        claim: safeCandidate(row),
        network: { name: 'Base Sepolia', chainId: BASE_SEPOLIA_CHAIN_ID, explorer: BASE_SEPOLIA_EXPLORER },
        contractAddress,
        requiredOwner: owner,
        anchor,
        warnings: ['Registration does not verify the identity.', 'No Passport is minted.', 'No deed, rent right or investment interest is created.'],
      });
    }

    if (String(onchain.claimHash).toLowerCase() !== anchor.claimHash.toLowerCase()
        || String(onchain.sourceHash).toLowerCase() !== anchor.sourceHash.toLowerCase()) {
      return response({ ok: false, error: 'The onchain identity hashes do not match the verified Voxel Vault claim. Anchoring stopped.' }, 409);
    }
    if (String(onchain.metadataURI || '') !== anchor.metadataURI) {
      return response({ ok: false, error: 'The onchain identity metadata URI does not match the prepared canonical record. Anchoring stopped.' }, 409);
    }

    if (!identity.registry_registered_tx_hash) {
      return response({
        ok: true,
        stage: 'registration-unreconciled',
        claim: safeCandidate(row),
        contractAddress,
        requiredOwner: owner,
        anchor,
        onchainVerified: Boolean(onchain.verified),
        error: 'The Base Sepolia registration exists but its transaction has not been reconciled into Supabase. Retry reconciliation with the original registration transaction hash.',
      }, 409);
    }

    if (Boolean(onchain.verified)) {
      if (identity.registry_verified !== true) {
        return response({
          ok: true,
          stage: 'verification-unreconciled',
          claim: safeCandidate(row),
          contractAddress,
          requiredOwner: owner,
          anchor,
          error: 'The Base Sepolia identity is verified but its verification transaction has not been reconciled into Supabase. Retry reconciliation with the original verification transaction hash.',
        }, 409);
      }

      return response({
        ok: true,
        stage: 'complete',
        claim: safeCandidate(row),
        contractAddress,
        requiredOwner: owner,
        anchor: { propertyId: anchor.propertyId, claimHashSuffix: shortHash(anchor.claimHash), sourceHashSuffix: shortHash(anchor.sourceHash), metadataURI: anchor.metadataURI },
        onchainVerified: true,
        passportMinted: false,
        propertyRightsCreated: false,
      });
    }

    if (identity.registry_verified === true) {
      return response({ ok: false, error: 'Database says this property is registry-verified, but Base Sepolia says it is not. Manual reconciliation is required.' }, 409);
    }

    return response({
      ok: true,
      stage: 'verify',
      claim: safeCandidate(row),
      network: { name: 'Base Sepolia', chainId: BASE_SEPOLIA_CHAIN_ID, explorer: BASE_SEPOLIA_EXPLORER },
      contractAddress,
      requiredOwner: owner,
      anchor,
      warnings: ['Verification is a separate owner transaction.', 'No Passport is minted by this action.', 'No deed, rent right or investment interest is created.'],
    });
  } catch (error: any) {
    if (setupMissing(error)) return response({ ok: false, setupRequired: true, error: 'Apply property registry migration 019 before using the anchor console.' }, 503);
    console.error('Property registry preparation failed', error);
    return response({ ok: false, error: 'Property registry state could not be prepared safely.' }, 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if ('error' in auth) return response({ ok: false, error: auth.error, setupRequired: Boolean(auth.setupRequired) }, auth.status);

  try {
    const body = await request.json().catch(() => ({}));
    const claimId = String(body?.claimId || '').trim();
    const action = String(body?.action || '').trim().toLowerCase();
    const txHash = String(body?.txHash || '').trim().toLowerCase();

    if (!claimId) return response({ ok: false, error: 'claimId is required.' }, 400);
    if (!['register', 'verify'].includes(action)) return response({ ok: false, error: 'action must be register or verify.' }, 400);
    if (!/^0x[0-9a-f]{64}$/.test(txHash)) return response({ ok: false, error: 'A valid Base Sepolia transaction hash is required.' }, 400);

    const prepared: any = await expectedAnchor(request, auth.admin, claimId);
    if (prepared.error) return prepared.error;
    const { identity, anchor, contractAddress, rpc, contract, owner } = prepared;

    const already = action === 'register'
      ? String(identity.registry_registered_tx_hash || '').toLowerCase()
      : String(identity.registry_verified_tx_hash || '').toLowerCase();
    if (already === txHash) {
      return response({ ok: true, reconciled: true, duplicate: true, action, registryVerified: action === 'verify' || identity.registry_verified === true });
    }

    const [receipt, tx] = await Promise.all([rpc.getTransactionReceipt(txHash), rpc.getTransaction(txHash)]);
    if (!receipt || receipt.status !== 1) return response({ ok: false, error: 'Base Sepolia transaction is missing or did not succeed.' }, 409);
    if (!tx || !tx.to || getAddress(tx.to) !== contractAddress) return response({ ok: false, error: 'Transaction was not sent to the configured canonical property registry.' }, 409);
    if (getAddress(tx.from) !== owner) return response({ ok: false, error: 'Transaction sender is not the canonical property registry owner.' }, 409);

    const iface = new Interface(CANONICAL_PROPERTY_REGISTRY_ABI);
    const parsed = receipt.logs
      .filter((log: any) => {
        try { return getAddress(log.address) === contractAddress; } catch { return false; }
      })
      .map((log: any) => { try { return iface.parseLog(log); } catch { return null; } })
      .filter(Boolean);

    if (action === 'register') {
      const event: any = parsed.find((item: any) => item?.name === 'PropertyIdentityRegistered');
      if (!event
          || String(event.args.propertyId).toLowerCase() !== anchor.propertyId.toLowerCase()
          || String(event.args.claimHash).toLowerCase() !== anchor.claimHash.toLowerCase()
          || String(event.args.sourceHash).toLowerCase() !== anchor.sourceHash.toLowerCase()
          || String(event.args.metadataURI || '') !== anchor.metadataURI) {
        return response({ ok: false, error: 'Registration transaction did not emit the exact prepared canonical identity event.' }, 409);
      }
    } else {
      const event: any = parsed.find((item: any) => item?.name === 'PropertyIdentityVerificationUpdated');
      if (!event
          || String(event.args.propertyId).toLowerCase() !== anchor.propertyId.toLowerCase()
          || event.args.verified !== true) {
        return response({ ok: false, error: 'Verification transaction did not emit the exact prepared verified=true event.' }, 409);
      }
    }

    const onchain: any = await contract.getIdentity(anchor.propertyId);
    if (String(onchain.claimHash).toLowerCase() !== anchor.claimHash.toLowerCase()
        || String(onchain.sourceHash).toLowerCase() !== anchor.sourceHash.toLowerCase()
        || String(onchain.metadataURI || '') !== anchor.metadataURI) {
      return response({ ok: false, error: 'Onchain identity state does not match the human-reviewed canonical record.' }, 409);
    }
    if (action === 'verify' && onchain.verified !== true) {
      return response({ ok: false, error: 'Onchain identity is not verified after the submitted transaction.' }, 409);
    }

    const saved = await auth.admin.rpc('record_property_registry_anchor', {
      p_property_identity_id: identity.id,
      p_action: action,
      p_chain_id: BASE_SEPOLIA_CHAIN_ID,
      p_contract_address: contractAddress.toLowerCase(),
      p_property_id: anchor.propertyId.toLowerCase(),
      p_tx_hash: txHash,
      p_block_number: receipt.blockNumber,
      p_actor_address: owner.toLowerCase(),
      p_claim_hash: anchor.claimHash.toLowerCase(),
      p_source_hash: anchor.sourceHash.toLowerCase(),
      p_metadata_uri: anchor.metadataURI,
    });
    if (saved.error) {
      if (setupMissing(saved.error)) return response({ ok: false, setupRequired: true, error: 'Apply property registry migration 019 before reconciling Base Sepolia transactions.' }, 503);
      throw saved.error;
    }

    return response({
      ok: true,
      reconciled: true,
      action,
      transactionHash: txHash,
      explorerUrl: `${BASE_SEPOLIA_EXPLORER}/tx/${txHash}`,
      registryVerified: action === 'verify',
      passportMinted: false,
      deedChanged: false,
      propertyRightsCreated: false,
      audit: saved.data,
    });
  } catch (error: any) {
    if (setupMissing(error)) return response({ ok: false, setupRequired: true, error: 'Apply property registry migration 019 before reconciling Base Sepolia transactions.' }, 503);
    console.error('Property registry reconciliation failed', error);
    return response({ ok: false, error: 'Property registry transaction could not be reconciled safely.' }, 500);
  }
}
