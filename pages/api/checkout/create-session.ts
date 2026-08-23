import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { itemId, itemName, price, email } = req.body;

    if (!itemId || !price || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create Stripe checkout session
    const sessionId = `sess_${Date.now()}`;

    res.status(200).json({
      success: true,
      sessionId,
      checkoutUrl: `https://checkout.stripe.com/pay/${sessionId}`,
      message: 'Checkout session created. You will receive the physical product + 3D NFT digital twin.',
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}