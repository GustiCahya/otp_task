type OTP = {
  code: string;
  expiresAt: number;
  used: boolean;
  failedAttempts: number;
};

type AuditLog = {
  timestamp: number;
  action: 'request' | 'verify';
  result: 'allowed' | 'blocked' | 'success' | 'not_found' | 'expired' | 'already_used' | 'max_attempts_exceeded';
};

type UserData = {
  attempts: number[];
  otps: OTP[];
  auditLogs: AuditLog[];
};

const store: Record<string, UserData> = {};

export function getUserData(userId: string): UserData {
  if (!store[userId]) {
    store[userId] = {
      attempts: [],
      otps: [],
      auditLogs: [],
    };
  }
  return store[userId];
}

export function clearExpired(userId: string) {
  const userData = store[userId];
  if (!userData) return;

  const now = Date.now();
  const windowStart = now - 60 * 1000;

  // Remove timestamps outside the 60-second window
  userData.attempts = userData.attempts.filter((timestamp) => timestamp > windowStart);

  // Remove OTPs that are expired or used (and their max attempts exceeded too, though they might fall under expired eventually)
  userData.otps = userData.otps.filter(
    (otp) => !otp.used && otp.expiresAt > now && otp.failedAttempts < 3
  );
}

export function addAuditLog(userId: string, log: Omit<AuditLog, 'timestamp'>) {
  const userData = getUserData(userId);
  userData.auditLogs.push({
    ...log,
    timestamp: Date.now(),
  });
}

export default store;
