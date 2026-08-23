import { NextResponse } from 'next/server';
import { requireVaultAdmin } from '../../../../../../lib/admin-auth';
import { verifyBaseMint } from '../../../../../../lib/base-mint-verification';
import { getVaultReadyReport } from '../../../../../../lib/vault-ready.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireVaultAdmin(request);
  if ('response' in auth) return auth.response;
  const { id } = await context.params;
  if (!UUID.test(id)) return NextResponse.json({ error:'Invalid product draft.' }, { status:400 });
  const { data: product, error } = await auth.supabase.from('supplier_product_drafts').select('*').eq('id',id).maybeSingle();
  if (error || !product) return NextResponse.json({ error:'Product draft not found.' }, { status:404 });
  try {
    const evidence = await verifyBaseMint({ contractAddress:product.contract_address, tokenId:product.token_id, transactionHash:product.mint_tx_hash });
    const patch = {
      chain_id:evidence.chainId, mint_status:'confirmed', mint_confirmed_at:evidence.confirmedAt,
      mint_confirmed_block:evidence.blockNumber, mint_owner:evidence.owner, updated_at:new Date().toISOString(),
    };
    const readiness = getVaultReadyReport({...product,...patch});
    const { data:updated, error:updateError } = await auth.supabase.from('supplier_product_drafts').update({...patch,readiness,status:readiness.ready?'ready':'draft'}).eq('id',id).select('*').single();
    if (updateError || !updated) throw updateError || new Error('Unable to save mint evidence.');
    return NextResponse.json({product:updated,evidence});
  } catch (verificationError) {
    const message = verificationError instanceof Error ? verificationError.message : 'Mint verification failed.';
    return NextResponse.json({error:message}, {status:409});
  }
}
