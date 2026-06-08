# OTP Rate Limiter — Product Requirements Document

**Role:** Senior Fullstack Engineer  
**Type:** Coding Challenge  
**Duration:** 45 minutes  
**Language:** TypeScript  
**Constraint:** No third-party libraries required

---

## Overview

The candidate must build a working single-page OTP request and verification app using a React fullstack framework of their choice. All rate-limiting and OTP logic must live entirely server-side inside framework actions and loaders. No databases or external services are needed.

---

## Ground Rules

| Constraint | Requirement |
|---|---|
| Framework | Next.js, Remix, or React Router v7 (actions & loaders required) |
| Language | TypeScript — required throughout |
| External libraries | None for core logic — no Redis, no database, no auth SDK |
| Storage | In-memory only — module-level singleton on the server |
| Styling | No design or styling required — functionality only |

---

## In-Memory Store

A module-level singleton defined in `store.ts`. Must never be exposed to the client.

```ts
// store.ts
const store: Record<string, {
  attempts: number[]   // unix timestamps of OTP requests
  otps: { code: string; expiresAt: number; used: boolean }[]
}> = {}

export default store
```

---

## Timing Constraints

| Parameter | Value |
|---|---|
| Rate limit window | 60 seconds |
| Max requests per window | 3 |
| OTP expiry | 2 minutes |
| OTP length | 6 digits |

---

## Core Requirements

### 1 — Request OTP *(server action)*

- Accept a `userId` from a form submission.
- Apply a sliding window check: if the user has made 3 or more requests in the last 60 seconds, return a rate-limit response including how many seconds remain before retry.
- If allowed: generate a random 6-digit OTP, store it with a 2-minute expiry, and return it to the UI.

### 2 — Verify OTP *(server action)*

- Accept a `userId` and a `code` from a form submission.
- Reject if the OTP does not exist, is expired, or has already been used.
- On success: mark the OTP as used and return a success message.

### 3 — Status Display *(loader)*

On every page load, read current status for the given `userId` from the store and return:

- Attempts used in window
- Remaining attempts
- Cooldown in seconds (0 if not blocked)

### 4 — Minimal UI

1. A `userId` input and a "Request OTP" button
2. A status section showing attempts used, remaining, and cooldown
3. After requesting: the OTP code and time until expiry
4. An OTP input and a "Verify" button
5. A result message after verification — success or specific error reason

---

## Expected Function Signatures

Candidates do not need to follow these exactly — they represent expected shape and return types.

```ts
function requestOTP(userId: string):
  | { allowed: false; waitSeconds: number }
  | { allowed: true;  code: string; expiresAt: number }

function verifyOTP(userId: string, code: string):
  | { valid: true }
  | { valid: false; reason: "not_found" | "expired" | "already_used" }

function getStatus(userId: string): {
  attemptsInWindow:  number
  remainingAttempts: number
  isBlocked:         boolean
  waitSeconds:       number
}
```

---

## Bonus Tasks

Attempt only after all core requirements are complete.

### Bonus 1 — Client-side expiry countdown

Show a live countdown on the client using the `expiresAt` timestamp returned from the action. The server is the source of truth — the client must not invent its own expiry time.

### Bonus 2 — Stale data cleanup

Implement a `clearExpired(userId)` function that removes timestamps outside the 60-second window and OTPs that are expired or used. Call it at the start of `requestOTP` to prevent unbounded memory growth.

### Bonus 3 — Per-attempt audit log

Add an audit log to the store recording each attempt timestamp, result (allowed/blocked), and verify outcome. Expose this in the loader so the UI can render a simple history list.

### Bonus 4 — Max verify attempts per OTP

Invalidate an OTP after 3 failed verification attempts even if it has not expired. Return reason code: `"max_attempts_exceeded"`.

### Bonus 5 — Unit test coverage

Write unit tests covering the core logic: rate limiting, OTP generation, verification, and edge cases (expired, already used, not found).

---

## Acceptance Criteria

| Area | Expectation |
|---|---|
| Rate limiting | Sliding window enforced server-side; correct `waitSeconds` returned |
| OTP generation | 6-digit random code, stored with 2-min expiry, returned to UI |
| Verification | Correctly rejects expired, used, and not-found codes with specific reason |
| Status loader | Reflects live attempts, remaining, and cooldown on every page load |
| Server-side only | Store is never serialized or sent to the client |
| TypeScript | Strict types throughout — no implicit `any` |
