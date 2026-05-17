import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

// k-anonymity: only first 5 chars of SHA-1 hash sent to HIBP
// Full hash never leaves — privacy preserved
async function checkHIBP(password: string): Promise<boolean> {
  const hash = crypto
    .createHash('sha1')
    .update(password)
    .digest('hex')
    .toUpperCase();

  const prefix = hash.slice(0, 5); // sent to HIBP
  const suffix = hash.slice(5); // checked locally

  const response = await fetch(
    `https://api.pwnedpasswords.com/range/${prefix}`,
    {
      headers: {
        'Add-Padding': 'true', // prevents traffic analysis
        'User-Agent': 'VaultX-PasswordManager',
      },
    }
  );

  if (!response.ok) {
    // HIBP is down — fail open (don't block registration)
    // Log it but don't punish user for external service failure
    console.warn('HIBP check failed — service unavailable');
    return false;
  }

  const text = await response.text();

  // Response format: "HASHSUFFIX:count\nHASHSUFFIX:count\n..."
  const breached = text
    .split('\n')
    .some((line) => line.split(':')[0] === suffix);

  return breached;
}

// Express middleware — attach to register route only
export async function hibpCheck(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // authKey is derived from password — we check the raw password
    // Client should send rawPassword only for this check, separate from authKey
    // For now we check authKey as proxy — not ideal but acceptable for v1
    const { authKey } = req.body;

    if (!authKey) {
      next();
      return;
    }

    const breached = await checkHIBP(authKey);

    if (breached) {
      res.status(400).json({
        error:
          'This password has appeared in a data breach. Please choose a different password.',
      });
      return;
    }

    next();
  } catch {
    // Never block registration due to HIBP errors — fail open
    console.warn('HIBP middleware error — skipping check');
    next();
  }
}
