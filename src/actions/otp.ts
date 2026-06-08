'use server';

import { getUserData, clearExpired, addAuditLog } from '../store';

function generateRandomOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function requestOTP(userId: string) {
  if (!userId) {
    throw new Error('User ID is required');
  }

  // Bonus 2: Stale data cleanup
  clearExpired(userId);

  const userData = getUserData(userId);
  const now = Date.now();
  const windowStart = now - 60 * 1000;

  // Rate limit window check
  const attemptsInWindow = userData.attempts.filter((ts) => ts > windowStart);
  
  if (attemptsInWindow.length >= 3) {
    // Blocked
    const oldestAttempt = Math.min(...attemptsInWindow);
    const waitSeconds = Math.ceil((oldestAttempt + 60 * 1000 - now) / 1000);
    
    addAuditLog(userId, { action: 'request', result: 'blocked' });
    return { allowed: false as const, waitSeconds };
  }

  // Allowed
  userData.attempts.push(now);
  
  const code = generateRandomOTP();
  const expiresAt = now + 2 * 60 * 1000;
  
  userData.otps.push({ code, expiresAt, used: false, failedAttempts: 0 });
  addAuditLog(userId, { action: 'request', result: 'allowed' });

  return { allowed: true as const, code, expiresAt };
}

export async function verifyOTP(userId: string, code: string) {
  if (!userId || !code) {
    throw new Error('User ID and Code are required');
  }

  const userData = getUserData(userId);
  const now = Date.now();

  const otpIndex = userData.otps.findIndex((otp) => otp.code === code);

  // Find the latest active OTP for the user
  const activeOtps = userData.otps.filter((o) => o.expiresAt > now && !o.used);
  const latestOtp = activeOtps.length > 0 ? activeOtps[activeOtps.length - 1] : null;

  if (otpIndex === -1) {
    // Code doesn't match any OTP. It's a failed attempt on the latest OTP.
    if (latestOtp) {
      latestOtp.failedAttempts += 1;
      if (latestOtp.failedAttempts >= 3) {
        addAuditLog(userId, { action: 'verify', result: 'max_attempts_exceeded' });
        return { valid: false as const, reason: 'max_attempts_exceeded' as const };
      }
    }
    addAuditLog(userId, { action: 'verify', result: 'not_found' });
    return { valid: false as const, reason: 'not_found' as const };
  }

  const otp = userData.otps[otpIndex];

  if (otp.used) {
    addAuditLog(userId, { action: 'verify', result: 'already_used' });
    return { valid: false as const, reason: 'already_used' as const };
  }

  if (now > otp.expiresAt) {
    addAuditLog(userId, { action: 'verify', result: 'expired' });
    return { valid: false as const, reason: 'expired' as const };
  }

  if (otp.failedAttempts >= 3) {
     addAuditLog(userId, { action: 'verify', result: 'max_attempts_exceeded' });
     return { valid: false as const, reason: 'max_attempts_exceeded' as const };
  }

  // It's a match and valid!
  otp.used = true;
  addAuditLog(userId, { action: 'verify', result: 'success' });
  return { valid: true as const };
}

export async function getStatus(userId: string) {
  const userData = getUserData(userId);
  const now = Date.now();
  const windowStart = now - 60 * 1000;

  const attemptsInWindow = userData.attempts.filter((ts) => ts > windowStart);
  const isBlocked = attemptsInWindow.length >= 3;
  let waitSeconds = 0;

  if (isBlocked) {
    const oldestAttempt = Math.min(...attemptsInWindow);
    waitSeconds = Math.max(0, Math.ceil((oldestAttempt + 60 * 1000 - now) / 1000));
  }

  return {
    attemptsInWindow: attemptsInWindow.length,
    remainingAttempts: Math.max(0, 3 - attemptsInWindow.length),
    isBlocked,
    waitSeconds,
    auditLogs: userData.auditLogs.slice(-10).reverse(), // Send last 10 logs
  };
}
