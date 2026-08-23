// Voxel Vault security utilities - rate limiting, CSRF, XSS prevention, input validation

import crypto from 'crypto';

// CSRF Token generation and validation
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function validateCsrfToken(token: string, storedToken: string): boolean {
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(storedToken));
}

// Content Security Policy headers
export const CSP_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.stripe.com https://api.sketchfab.com; frame-src 'self' https://sketchfab.com;",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(self), microphone=(), camera=()',
};

// Input validation utilities
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return email.length <= 254 && emailRegex.test(email);
}

export function validateEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function sanitizeInput(input: string, maxLength = 500): string {
  return input
    .substring(0, maxLength)
    .replace(/[<>"'&]/g, (char) => {
      const escapeMap: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;',
      };
      return escapeMap[char] || char;
    });
}

// Wallet signature verification
export function recoverSignerAddress(message: string, signature: string): string | null {
  try {
    // Use ethers.js or ethers-utils in production
    // This is a placeholder
    return null;
  } catch (error) {
    return null;
  }
}

// Request validation middleware
export function validateRequestSignature(
  method: string,
  path: string,
  body: string,
  signature: string,
  secret: string
): boolean {
  const payload = `${method}${path}${body}`;
  const computed = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed));
}
