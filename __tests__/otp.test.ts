import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { requestOTP, verifyOTP, getStatus } from '../src/actions/otp';
import store, { getUserData } from '../src/store';

describe('OTP Rate Limiter Core Logic', () => {
  const testUser = 'test-user-1';

  beforeEach(() => {
    // Reset store before each test
    for (const key in store) {
      delete store[key];
    }
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('OTP Generation and Verification', () => {
    it('generates a 6-digit OTP and verifies it successfully', async () => {
      const res = await requestOTP(testUser);
      expect(res.allowed).toBe(true);
      if (res.allowed) {
        expect(res.code).toMatch(/^\d{6}$/);
        
        const verifyRes = await verifyOTP(testUser, res.code);
        expect(verifyRes.valid).toBe(true);
      }
    });

    it('rejects an incorrect OTP code', async () => {
      await requestOTP(testUser);
      const verifyRes = await verifyOTP(testUser, '000000');
      expect(verifyRes.valid).toBe(false);
      if (!verifyRes.valid) {
        expect(verifyRes.reason).toBe('not_found');
      }
    });

    it('rejects an already used OTP', async () => {
      const res = await requestOTP(testUser);
      if (res.allowed) {
        await verifyOTP(testUser, res.code);
        const secondVerifyRes = await verifyOTP(testUser, res.code);
        expect(secondVerifyRes.valid).toBe(false);
        if (!secondVerifyRes.valid) {
          expect(secondVerifyRes.reason).toBe('already_used');
        }
      }
    });

    it('rejects an expired OTP', async () => {
      const res = await requestOTP(testUser);
      if (res.allowed) {
        // Advance time by 2 minutes and 1 second
        vi.advanceTimersByTime(2 * 60 * 1000 + 1000);
        const verifyRes = await verifyOTP(testUser, res.code);
        expect(verifyRes.valid).toBe(false);
        if (!verifyRes.valid) {
          expect(verifyRes.reason).toBe('expired');
        }
      }
    });

    it('invalidates an OTP after 3 failed verification attempts', async () => {
      const res = await requestOTP(testUser);
      if (res.allowed) {
        // 1st failed attempt
        await verifyOTP(testUser, '000000');
        // 2nd failed attempt
        await verifyOTP(testUser, '000001');
        // 3rd failed attempt
        const fail3 = await verifyOTP(testUser, '000002');
        expect(fail3.valid).toBe(false);
        if (!fail3.valid) expect(fail3.reason).toBe('max_attempts_exceeded');

        // Now even the correct code should fail
        const correctRes = await verifyOTP(testUser, res.code);
        expect(correctRes.valid).toBe(false);
        if (!correctRes.valid) {
          expect(correctRes.reason).toBe('max_attempts_exceeded');
        }
      }
    });
  });

  describe('Rate Limiting', () => {
    it('blocks request after 3 attempts within 60 seconds', async () => {
      await requestOTP(testUser);
      await requestOTP(testUser);
      const req3 = await requestOTP(testUser);
      expect(req3.allowed).toBe(true);

      const req4 = await requestOTP(testUser);
      expect(req4.allowed).toBe(false);
      if (!req4.allowed) {
        expect(req4.waitSeconds).toBeGreaterThan(0);
        expect(req4.waitSeconds).toBeLessThanOrEqual(60);
      }
    });

    it('allows request after the 60-second window expires', async () => {
      await requestOTP(testUser);
      await requestOTP(testUser);
      await requestOTP(testUser);

      const req4 = await requestOTP(testUser);
      expect(req4.allowed).toBe(false);

      // Advance time by 60 seconds
      vi.advanceTimersByTime(60 * 1000);

      const req5 = await requestOTP(testUser);
      expect(req5.allowed).toBe(true);
    });
  });

  describe('Status Tracking', () => {
    it('returns the correct status for a user', async () => {
      await requestOTP(testUser);
      const status = await getStatus(testUser);
      expect(status.attemptsInWindow).toBe(1);
      expect(status.remainingAttempts).toBe(2);
      expect(status.isBlocked).toBe(false);
      expect(status.waitSeconds).toBe(0);
      expect(status.auditLogs.length).toBeGreaterThan(0);
    });
  });
});
