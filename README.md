# 🔒 Secure OTP Auth & Rate Limiter

A state-of-the-art, secure single-page application for One-Time Password (OTP) request and verification. Built with **Next.js (App Router)** and **TypeScript**, utilizing high-performance server-side actions, in-memory state tracking, and a sliding-window rate limiter, all with **zero third-party libraries for core logic**.

The interface is styled using custom, modern **Vanilla CSS**, featuring a premium glassmorphic dashboard, micro-animations, active visual timers, and dynamic audit history tracking.

---

## 🚀 Key Features

### Core Requirements
1. **Request OTP Server Action**
   - Implements a server-side **sliding-window rate limiter** restricting requests to a maximum of **3 requests per 60 seconds**.
   - Generates a cryptographically randomized 6-digit OTP code with a 2-minute server-side expiration window.
2. **Verify OTP Server Action**
   - Validates OTP submission against the server-side store.
   - Rejects expired codes, already-used codes, or incorrect codes with precise, descriptive error messages.
3. **Status Tracking & Live Sync**
   - Fetches and displays current user status (attempts used, remaining attempts, block cooldown seconds).
4. **Premium Vanilla CSS Interface**
   - Sleek dashboard design with fluid states, glow effects, responsive spacing, and loading indicators.
5. **Full PWA Support**
   - Designed to be fully installable as a mobile or desktop Progressive Web App (PWA).
   - Features standard manifest profiles, theme colors matching the app styling, and app shortcut icons.

### 🌟 Bonus Achievements Implemented
- **Bonus 1 — Live Client-Side Expiry Countdown**: A real-time visual countdown using the server's `expiresAt` timestamp as the single source of truth.
- **Bonus 2 — Self-Cleaning In-Memory Store**: A garbage collector routine (`clearExpired`) runs automatically before each request to prune old rate-limit timestamps and stale/used OTPs to prevent memory leaks.
- **Bonus 3 — Per-Attempt Audit Log**: Records a detailed trail of actions (`request`, `verify`) and their results (`allowed`, `blocked`, `success`, `expired`, `not_found`, etc.), rendered as an interactive history log in the UI.
- **Bonus 4 — Max Verification Fail-Safe**: Automatically invalidates an OTP after **3 failed verification attempts**, immediately transitioning its state to `max_attempts_exceeded` to block brute-force attacks.
- **Bonus 5 — Unit Test Suite**: Comprehensive tests built with **Vitest** utilizing mock timers to validate edge cases (expiration, rate limits, audit logging, incorrect codes, brute-force invalidation).

---

## 📂 Project Structure

- [`src/store.ts`](./src/store.ts): Server-side in-memory singleton storing rate limit stamps, active OTPs, and the audit logs.
- [`src/actions/otp.ts`](./src/actions/otp.ts): Server Actions managing request authorization, sliding-window rate checks, verification logic, and status loaders.
- [`src/app/page.tsx`](./src/app/page.tsx): Main interactive client dashboard utilizing real-time countdown hooks, polling, action calls, and PWA registration.
- [`src/app/layout.tsx`](./src/app/layout.tsx): App shell configuration injecting dynamic viewport values and PWA web manifest.
- [`src/app/globals.css`](./src/app/globals.css): Premium CSS stylesheet defining variables, layout grids, glassmorphism card styling, responsive design rules, and micro-animations.
- [`public/manifest.json`](./public/manifest.json): The web application manifest detailing metadata, standalone displays, orientation, and colors.
- [`public/sw.js`](./public/sw.js): The Service Worker implementing caching strategies (stale-while-revalidate for assets) to handle offline states.
- [`__tests__/otp.test.ts`](./__tests__/otp.test.ts): Unit test coverage using Vitest.

---

## 🛠️ Tech Stack & Setup

- **Core**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Vanilla CSS (CSS Variables, Flexbox/Grid layouts, Glassmorphic effects, CSS Transitions)
- **Testing**: Vitest

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### Installation & Run

1. Clone or navigate to the project root:
   ```bash
   cd otp_task
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the application in your browser.

4. Run the unit test suite:
   ```bash
   npx vitest run
   ```

---

## ⚙️ Technical Details & Constraints

### Sliding Window Rate Limiter
The rate limiter operates by tracking the Unix timestamps of successful requests. When a request is received:
1. `clearExpired(userId)` cleans timestamps older than 60 seconds from the memory store.
2. If the count of remaining timestamps in the current window is $\ge 3$, the request is blocked, and the `waitSeconds` are calculated as:
   $$\text{waitSeconds} = \left\lceil \frac{\text{oldestAttempt} + 60\,000 - \text{now}}{1,000} \right\rceil$$
3. Otherwise, the current timestamp is appended, and a new OTP is issued.

### Bruteforce Prevention
Each OTP generated tracks `failedAttempts: number`. If verification fails, we increment this counter on the active OTP. Once it reaches 3, the OTP is instantly locked out and marked as `max_attempts_exceeded`.

### Server-Side Isolation
The `store` object inside `store.ts` is a module-level variable that is never exported or serialized. All data mutations and validations occur strictly server-side inside Next.js Server Actions, keeping the OTP and validation status hidden from client injection.
