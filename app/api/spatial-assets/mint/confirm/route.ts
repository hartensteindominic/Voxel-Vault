import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../lib/supabase-admin';
import { appendAuditChainEvent } from '../../../../../lib/audit-chain';
import { recordSpatialMintFeeJournal } from '../../../../../lib/commerce-ledger';
import {
  assertSpatialMintServerReady,
  spatialMintContract,
  spatialMintExplorerUrl,
  spatialMintProvider,
} from '../../../../../lib/spatial-mint-server';

export const runtime = 'nodejs';
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_RE = /^0x[a-fA-F0-9]{64}$/;

export async function POST(request: Request) {
  let provider: any = null;
  try {
    const config = assertSpatialMintServerReady();
    const supabaseAdmin = getSupabaseAdmin();
    const auth = request.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const assetId = String(body?.assetId || '');
    const txHash = String(body?.txHash || '').trim().toLowerCase();
    const tokenId = String(body?.tokenId || '').trim();
    const wallet = String(body?.wallet || '').trim().toLowerCase();
    const metadataUrl = String(body?.metadataUrl || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(assetId) || !TX_RE.test(txHash) || !/^\d+$/.test(tokenId) || !ADDRESS_RE.test(wallet) || !/^https:\/\//i.test(metadataUrl)) {
      return NextResponse.json({ error: 'Mint verification details are incomplete.' }, { status: 400 });
    }

    const { data: asset, error: assetError } = await supabaseAdmin
      .from('spatial_assets')
      .select('*')
      .eq('id', assetId)
      .eq('owner_user_id', user.id)
      .maybeSingle();
    if (assetError) throw assetError;
    if (!asset) return NextResponse.json({ error: 'Spatial asset not found.' }, { status: 404 });
    if (asset.state === 'minted') {
      const same = String(asset.transaction_hash || '').toLowerCase() === txHash && String(asset.token_id || '') === tokenId;
      if (!same) return NextResponse.json({ error: 'This asset is already linked to a different verified mint.' }, { status: 409 });
      return NextResponse.json({
        confirmed: true,
        duplicate: true,
        assetId,
        tokenId,
        wallet: asset.owner_wallet,
        contractAddress: asset.contract_address,
        chainId: Number(asset.chain_id),
        txHash,
        explorerUrl: `${spatialMintExplorerUrl()}/tx/${txHash}`,
        openSeaUrl: Number(asset.chain_id) === 84532
          ? `https://testnets.opensea.io/assets/base_sepolia/${asset.contract_address}/${tokenId}`
          : `https://opensea.io/assets/base/${asset.contract_address}/${tokenId}`,
      });
    }

    if (asset.owner_wallet && String(asset.owner_wallet).toLowerCase() !== wallet) {
      return NextResponse.json({ error: 'The mint wallet does not match the wallet used during preparation.' }, { status: 403 });
    }
    if (asset.metadata_uri && String(asset.metadata_uri) !== metadataUrl) {
      return NextResponse.json({ error: 'The NFT metadata URL does not match the prepared spatial asset.' }, { status: 403 });
    }

    const { data: preparation, error: prepError } = await supabaseAdmin
      .from('spatial_asset_events')
      .select('details,created_at')
      .eq('asset_id', assetId)
      .eq('event_type', 'mint_prepared')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prepError) throw prepError;
    if (!preparation?.details) return NextResponse.json({ error: 'No server-authoritative mint preparation was found.' }, { status: 409 });
    const prepared = preparation.details as any;
    if (String(prepared.wallet || '').toLowerCase() !== wallet || String(prepared.metadataUrl || '') !== metadataUrl) {
      return NextResponse.json({ error: 'Submitted mint details do not match the prepared server record.' }, { status: 403 });
    }

    provider = spatialMintProvider();
    const [receipt, transaction] = await Promise.all([
      provider.getTransactionReceipt(txHash),
      provider.getTransaction(txHash),
    ]);
    if (!receipt || !transaction) return NextResponse.json({ error: 'The transaction is not visible on the configured chain yet. Resume verification instead of minting again.' }, { status: 409 });
    if (receipt.status !== 1) return NextResponse.json({ error: 'The spatial mint transaction failed on-chain.' }, { status: 422 });
    if (String(transaction.to || '').toLowerCase() !== config.contractAddress.toLowerCase()) {
      return NextResponse.json({ error: 'The transaction was not sent to the reviewed SpatialVoxelNFT contract.' }, { status: 403 });
    }
    if (String(transaction.from || '').toLowerCase() !== wallet) {
      return NextResponse.json({ error: 'The transaction sender does not match the verified wallet.' }, { status: 403 });
    }
    const expectedFeeWei = String(prepared.platformFeeWei || '0');
    if (transaction.value.toString() !== expectedFeeWei) {
      return NextResponse.json({ error: 'The on-chain platform fee does not match the server-reviewed mint preparation.' }, { status: 403 });
    }

    const contract = spatialMintContract(provider);
    const [owner, tokenUri] = await Promise.all([contract.ownerOf(tokenId), contract.tokenURI(tokenId)]);
    if (String(owner).toLowerCase() !== wallet) return NextResponse.json({ error: 'The verified wallet does not own this token.' }, { status: 403 });
    if (String(tokenUri) !== metadataUrl) return NextResponse.json({ error: 'The minted token metadata does not match this spatial asset.' }, { status: 403 });

    const verifiedAt = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin.from('spatial_assets').update({
      state: 'minted',
      chain_id: config.chainId,
      contract_address: config.contractAddress.toLowerCase(),
      token_id: tokenId,
      transaction_hash: txHash,
      owner_wallet: wallet,
      metadata_uri: metadataUrl,
      updated_at: verifiedAt,
    }).eq('id', assetId).eq('owner_user_id', user.id);
    if (updateError) throw updateError;

    const details = {
      chainId: config.chainId,
      contractAddress: config.contractAddress.toLowerCase(),
      tokenId,
      transactionHash: txHash,
      ownerWallet: wallet,
      metadataUri: metadataUrl,
      platformFeeWei: expectedFeeWei,
      verifiedAt,
    };
    const { error: eventError } = await supabaseAdmin.from('spatial_asset_events').insert({ asset_id: assetId, event_type: 'mint_verified', details });
    if (eventError) throw eventError;

    if (BigInt(expectedFeeWei) > 0n) {
      await recordSpatialMintFeeJournal(supabaseAdmin, {
        txHash,
        feeWei: expectedFeeWei,
        assetId,
        tokenId,
        wallet,
        chainId: config.chainId,
      });
    }

    const audit = await appendAuditChainEvent(supabaseAdmin, {
      eventType: 'spatial_mint_verified',
      entityType: 'spatial_asset',
      entityId: assetId,
      actorUserId: user.id,
      sourceRef: `spatial-mint:${txHash}`,
      payload: details,
    });
    await supabaseAdmin.from('spatial_assets').update({ audit_hash: audit.entryHash }).eq('id', assetId).eq('owner_user_id', user.id);

    return NextResponse.json({
      confirmed: true,
      assetId,
      tokenId,
      wallet,
      contractAddress: config.contractAddress,
      chainId: config.chainId,
      txHash,
      auditHash: audit.entryHash,
      explorerUrl: `${spatialMintExplorerUrl()}/tx/${txHash}`,
      openSeaUrl: config.chainId === 84532
        ? `https://testnets.opensea.io/assets/base_sepolia/${config.contractAddress}/${tokenId}`
        : `https://opensea.io/assets/base/${config.contractAddress}/${tokenId}`,
    });
  } catch (error) {
    console.error('spatial mint verification failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to verify this spatial mint.' }, { status: 500 });
  } finally {
    provider?.destroy?.();
  }
}
