/**
 * Orbit License Validation System
 * 
 * License Format: ORBIT-XXXX-XXXX-XXXX-XXXX
 * Validation: HMAC-SHA256 signature verification (offline)
 * 
 * For the seller: Use the companion script (scripts/generate-license.mjs)
 * to generate valid license keys with your secret.
 */

const LICENSE_PREFIX = 'ORBIT';
const VERIFICATION_KEY = 'orbit-desktop-2026-public-verification';

export type LicenseStatus = 
  | { valid: true; type: 'licensed'; email: string; expiresAt?: string }
  | { valid: true; type: 'trial'; daysRemaining: number; startedAt: string }
  | { valid: false; type: 'expired_trial'; expiredAt: string }
  | { valid: false; type: 'invalid_key'; reason: string }
  | { valid: false; type: 'no_license' };

interface StoredActivation {
  licenseKey?: string;
  email?: string;
  activatedAt?: string;
  trialStartedAt?: string;
}

const TRIAL_DAYS = 7;
const STORAGE_KEY = 'orbit_activation';

function getStoredActivation(): StoredActivation | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveActivation(activation: StoredActivation): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(activation));
}

/**
 * Validate a license key format and signature
 */
export async function validateLicenseKey(key: string): Promise<{ valid: boolean; email?: string; reason?: string }> {
  const cleaned = key.trim().toUpperCase();
  
  // Check format: ORBIT-XXXX-XXXX-XXXX-XXXX
  const parts = cleaned.split('-');
  if (parts.length !== 5 || parts[0] !== LICENSE_PREFIX) {
    return { valid: false, reason: 'Invalid license key format. Expected: ORBIT-XXXX-XXXX-XXXX-XXXX' };
  }
  
  // Validate each segment is alphanumeric
  for (let i = 1; i < parts.length; i++) {
    if (!/^[A-Z0-9]{4}$/.test(parts[i])) {
      return { valid: false, reason: 'Invalid license key characters.' };
    }
  }
  
  // Extract payload and signature segments
  const payload = parts.slice(1, 4).join('');
  const signature = parts[4];
  
  // Verify HMAC-SHA256 signature using Web Crypto API
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(VERIFICATION_KEY);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      encoder.encode(payload)
    );
    
    // Take first 4 chars of hex signature
    const fullHex = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const expectedSig = fullHex.slice(0, 4).toUpperCase();
    
    if (signature === expectedSig) {
      // Extract email hint from payload (first 4 chars encode a simple hash)
      const email = `user_${payload.slice(0, 4).toLowerCase()}@activated`;
      return { valid: true, email };
    } else {
      return { valid: false, reason: 'License key signature verification failed.' };
    }
  } catch (err) {
    return { valid: false, reason: 'Crypto verification error.' };
  }
}

/**
 * Activate a license key and store it
 */
export async function activateLicense(key: string): Promise<LicenseStatus> {
  const result = await validateLicenseKey(key);
  
  if (result.valid) {
    saveActivation({
      licenseKey: key.trim().toUpperCase(),
      email: result.email,
      activatedAt: new Date().toISOString(),
    });
    return {
      valid: true,
      type: 'licensed',
      email: result.email || 'activated',
    };
  }
  
  return {
    valid: false,
    type: 'invalid_key',
    reason: result.reason || 'Invalid license key.',
  };
}

/**
 * Start a free trial
 */
export function startTrial(): LicenseStatus {
  const existing = getStoredActivation();
  if (existing?.trialStartedAt) {
    // Trial already started — check if expired
    return checkTrialStatus(existing.trialStartedAt);
  }
  
  const now = new Date().toISOString();
  saveActivation({ trialStartedAt: now });
  return {
    valid: true,
    type: 'trial',
    daysRemaining: TRIAL_DAYS,
    startedAt: now,
  };
}

function checkTrialStatus(startedAt: string): LicenseStatus {
  const start = new Date(startedAt);
  const now = new Date();
  const elapsed = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const remaining = Math.ceil(TRIAL_DAYS - elapsed);
  
  if (remaining > 0) {
    return {
      valid: true,
      type: 'trial',
      daysRemaining: remaining,
      startedAt,
    };
  }
  
  return {
    valid: false,
    type: 'expired_trial',
    expiredAt: new Date(start.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Get current activation status
 */
export function getActivationStatus(): LicenseStatus {
  const stored = getStoredActivation();
  
  if (!stored) {
    return { valid: false, type: 'no_license' };
  }
  
  // Licensed user
  if (stored.licenseKey && stored.activatedAt) {
    return {
      valid: true,
      type: 'licensed',
      email: stored.email || 'activated',
    };
  }
  
  // Trial user
  if (stored.trialStartedAt) {
    return checkTrialStatus(stored.trialStartedAt);
  }
  
  return { valid: false, type: 'no_license' };
}
