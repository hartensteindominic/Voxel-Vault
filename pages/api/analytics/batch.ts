import type { NextApiRequest, NextApiResponse } from 'next';
import { validateRequestSignature } from '@/lib/security-hardening';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate request signature
    const signature = req.headers['x-signature'] as string;
    const isValid = validateRequestSignature(
      req.method,
      req.url || '',
      JSON.stringify(req.body),
      signature,
      process.env.ANALYTICS_SECRET_KEY || ''
    );

    if (!isValid) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'No events provided' });
    }

    // Store events in database (Supabase, PostgeSQL, etc.)
    // await storeAnalyticsEvents(events);

    res.status(200).json({ received: events.length });
  } catch (error) {
    console.error('Analytics batch error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}
