'use client';

import { useState, useEffect } from 'react';
import { requestOTP, verifyOTP, getStatus } from '../actions/otp';

type Status = {
  attemptsInWindow: number;
  remainingAttempts: number;
  isBlocked: boolean;
  waitSeconds: number;
  auditLogs: { timestamp: number; action: string; result: string }[];
};

export default function OTPApp() {
  const [userId, setUserId] = useState('user123');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  
  const [currentOtp, setCurrentOtp] = useState<{ code: string; expiresAt: number } | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  
  const [msg, setMsg] = useState<{ text: string; type: 'error' | 'success' } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    if (!userId) return;
    const s = await getStatus(userId);
    setStatus(s);
  };

  useEffect(() => {
    fetchStatus();
    // Poll status every second if blocked to update cooldown visually, though the instruction says "On every page load, read current status".
    // We can just update it after actions, but a live cooldown on block is nice.
    const interval = setInterval(() => {
      fetchStatus();
    }, 1000);
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    if (!currentOtp) {
      setCountdown(0);
      return;
    }
    
    const tick = () => {
      const remaining = Math.max(0, Math.floor((currentOtp.expiresAt - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) {
        setCurrentOtp(null); // Expired
      }
    };
    
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [currentOtp]);

  const handleRequestOTP = async () => {
    setLoading(true);
    setMsg(null);
    setCurrentOtp(null);
    
    try {
      const res = await requestOTP(userId);
      if (res.allowed) {
        setCurrentOtp({ code: res.code, expiresAt: res.expiresAt });
        setMsg({ text: 'OTP requested successfully!', type: 'success' });
      } else {
        setMsg({ text: `Rate limited. Please wait ${res.waitSeconds} seconds.`, type: 'error' });
      }
    } catch (e: any) {
      setMsg({ text: e.message || 'Error requesting OTP', type: 'error' });
    } finally {
      await fetchStatus();
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!code) {
      setMsg({ text: 'Please enter OTP', type: 'error' });
      return;
    }
    
    setLoading(true);
    setMsg(null);
    
    try {
      const res = await verifyOTP(userId, code);
      if (res.valid) {
        setMsg({ text: 'OTP verified successfully!', type: 'success' });
        setCurrentOtp(null);
        setCode('');
      } else {
        const errorMapping: Record<string, string> = {
          'not_found': 'Invalid OTP code.',
          'expired': 'OTP has expired.',
          'already_used': 'OTP has already been used.',
          'max_attempts_exceeded': 'Maximum verification attempts exceeded. Please request a new OTP.'
        };
        setMsg({ text: errorMapping[res.reason] || 'Verification failed.', type: 'error' });
      }
    } catch (e: any) {
      setMsg({ text: e.message || 'Error verifying OTP', type: 'error' });
    } finally {
      await fetchStatus();
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Auth Center</h1>
        <p>Secure OTP Verification</p>
      </div>

      <div className="form-group">
        <label>User ID</label>
        <input 
          type="text" 
          value={userId} 
          onChange={(e) => setUserId(e.target.value)} 
          placeholder="Enter user ID"
        />
      </div>

      {status && (
        <div className="status-card">
          <div className="status-row">
            <span className="status-label">Attempts in window:</span>
            <span className="status-value">{status.attemptsInWindow} / 3</span>
          </div>
          <div className="status-row">
            <span className="status-label">Remaining attempts:</span>
            <span className="status-value">{status.remainingAttempts}</span>
          </div>
          {status.isBlocked && status.waitSeconds > 0 && (
            <div className="status-row">
              <span className="status-label">Cooldown:</span>
              <span className="status-value" style={{ color: 'var(--error)' }}>
                {status.waitSeconds}s
              </span>
            </div>
          )}
        </div>
      )}

      <button 
        onClick={handleRequestOTP} 
        disabled={loading || (status?.isBlocked && status.waitSeconds > 0)}
      >
        {loading ? 'Requesting...' : 'Request OTP'}
      </button>

      {currentOtp && (
        <div className="otp-display">
          <div className="otp-code">{currentOtp.code}</div>
          <div className="otp-countdown">Expires in {countdown}s</div>
        </div>
      )}

      <div className="form-group">
        <label>Verification Code</label>
        <input 
          type="text" 
          value={code} 
          onChange={(e) => setCode(e.target.value)} 
          placeholder="Enter 6-digit code"
          maxLength={6}
        />
      </div>

      <button onClick={handleVerifyOTP} disabled={loading || !code}>
        Verify OTP
      </button>

      {msg && (
        <div className={msg.type === 'error' ? 'error-msg' : 'success-msg'}>
          {msg.text}
        </div>
      )}

      {status?.auditLogs && status.auditLogs.length > 0 && (
        <div className="audit-log">
          <div style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Audit History</div>
          {status.auditLogs.map((log, i) => {
            const date = new Date(log.timestamp).toLocaleTimeString();
            return (
              <div key={i} className="audit-entry">
                <span>[{date}] {log.action.toUpperCase()}</span>
                <span className={`audit-result result-${log.result}`}>
                  {log.result}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
