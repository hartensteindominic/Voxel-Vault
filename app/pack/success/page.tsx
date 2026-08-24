import PackBuilder from './PackBuilder';
import { stripe } from '../../../lib/stripe-server';
import { attributionFromMetadata, recordVoxelPopEvent } from '../../../lib/voxelpop-analytics';

async function recordPurchase(sessionId: string) {
  if (!sessionId) return;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid' || session.metadata?.product !== 'voxelpop-3d-asset') return;
    await recordVoxelPopEvent({
      eventName: 'purchase_completed',
      eventKey: `purchase_completed:${session.id}`,
      flowId: session.metadata?.flow_id,
      stripeSessionId: session.id,
      attribution: attributionFromMetadata(session.metadata),
      details: {
        amount_cents: Number(session.amount_total || 0),
        currency: session.currency || 'usd',
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
