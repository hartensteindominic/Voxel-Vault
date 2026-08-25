import PackBuilder from './PackBuilder';
import { getVoxelPopEntitlement } from '../../../lib/voxelpop-entitlement';
import { attributionFromMetadata, recordVoxelPopEvent } from '../../../lib/voxelpop-analytics';

async function recordPurchase(sessionId: string) {
  if (!sessionId) return;
  try {
    const entitlement = await getVoxelPopEntitlement(sessionId);
    if (!entitlement) return;
    await recordVoxelPopEvent({
      eventName: 'purchase_completed',
      eventKey: `purchase_completed:${entitlement.paymentMethod}:${entitlement.id}`,
      flowId: entitlement.metadata?.flow_id,
      stripeSessionId: entitlement.paymentMethod === 'stripe' ? entitlement.id : null,
      attribution: attributionFromMetadata(entitlement.metadata),
      details: {
        amount_cents: entitlement.amountCents,
        currency: entitlement.currency,
        payment_method: entitlement.paymentMethod,
      },
    });
  } catch (error) {
    console.error('VoxelPop purchase analytics failed', error);
  }
}

export default async function PackSuccessPage({searchParams}:{searchParams:Promise<{session_id?:string}>}){
  const {session_id}=await searchParams;
  await recordPurchase(session_id||'');
  return <PackBuilder sessionId={session_id||''}/>;
}
