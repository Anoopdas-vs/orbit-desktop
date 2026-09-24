#!/usr/bin/env node
/**
 * Orbit License Key Generator
 * Usage: node scripts/generate-license.mjs [email]
 * 
 * This script generates valid ORBIT-XXXX-XXXX-XXXX-XXXX license keys.
 * Keep this script PRIVATE — never distribute it.
 */

import { createHmac, randomBytes } from 'crypto';

const VERIFICATION_KEY = 'orbit-desktop-2026-public-verification';
const PREFIX = 'ORBIT';

function generateLicenseKey(email = 'customer@example.com') {
  // Generate 12 random alphanumeric characters (3 segments × 4 chars)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let payload = '';
  const bytes = randomBytes(12);
  for (let i = 0; i < 12; i++) {
    payload += chars[bytes[i] % chars.length];
  }
  
  // Generate HMAC-SHA256 signature of the payload
  const hmac = createHmac('sha256', VERIFICATION_KEY);
  hmac.update(payload);
  const signature = hmac.digest('hex').slice(0, 4).toUpperCase();
  
  // Format: ORBIT-XXXX-XXXX-XXXX-XXXX
  const segments = [
    PREFIX,
    payload.slice(0, 4),
    payload.slice(4, 8),
    payload.slice(8, 12),
    signature,
  ];
  
  return segments.join('-');
}

// Generate keys
const email = process.argv[2] || 'customer@example.com';
console.log('\n🔑 Orbit License Key Generator');
console.log('================================');
console.log(`Email: ${email}`);
console.log('');

for (let i = 0; i < 5; i++) {
  console.log(`  ${generateLicenseKey(email)}`);
}

console.log('');
console.log('⚠️  Keep this script private. Never include it in distributed builds.');
console.log('');
