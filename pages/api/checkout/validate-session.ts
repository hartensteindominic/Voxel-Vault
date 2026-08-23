import type { NextApiRequest, NextApiResponse } from 'next';
import { validateCsrfToken, sanitizeInput, validateEmail } from '@/lib/security-hardening';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate CSRF token
    const csrfToken = req.headers['x-csrf-token'] as string;
    const sessionCsrfToken = req.headers.cookie
      ?.split(';')
      .find((c) => c.trim().startsWith('csrf='))
      ?.split('=')?.[1];

    if (!csrfToken || !sessionCsrfToken || !validateCsrfToken(csrfToken, sessionCsrfToken)) {
      return res.status(403).json({ error: 'Invalid session' });
    }

    // Validate input
    const { email, itemId, quantity } = req.body;

    if (!validateEmail(email) || !sanitizeInput(itemId)) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    if (quantity < 1 || quantity > 100) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }

    // Generate session token
    const sessionToken = Buffer.from(Math.random().toString()).toString('base64');

    res.status(200).json({
      valid: true,
      sessionToken,
      expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
    });
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}
