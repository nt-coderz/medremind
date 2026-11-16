# MedRemind Security & Alarm Reliability Audit

**Audit date:** 2026-11-16  
**Repository:** `nt-coderz/medremind`  
**Audited ref:** `main` (commit `79045165aa26ae79e56caaf094c6b70c82d249b8`)  
**Status:** Initial static review; no production changes applied and no runtime tests executed.

## Executive summary

The repository contains meaningful security controls (Helmet, rate limiting, PBKDF2 password hashing, Supabase RLS migrations, and Android notification permissions), but several critical paths bypass or weaken those controls. The app must not be considered production-safe until the issues below are fixed and verified.

## Confirmed findings

### Critical — hardcoded administrator credentials
- `backend/server.js` around lines 498–513 accepts `ADMIN / 123456` and issues an administrator JWT.
- `src/context/AuthContext.jsx` around lines 99–125 independently grants a local administrator session for the same credentials, even if the backend is unavailable.
- Impact: anyone who knows or discovers the shipped credentials can obtain administrator access.
- Required remediation: remove the universal credential path from client and server; provision admins through a controlled, environment-backed or managed identity flow; require role checks on every admin endpoint; rotate/revoke existing admin credentials and tokens.

### Critical — local authentication bypasses server verification
- `src/context/AuthContext.jsx` around lines 150–200 authenticates against browser-stored user records when the API is unreachable.
- The comparison accepts universal fallback values `123456` and `password123`, rather than requiring an exact account-specific credential.
- The initial local demo record includes a plaintext password; registration also writes the submitted password into `medremind_registered_users` and the active user object in localStorage (around lines 26–48 and 213–289).
- Impact: account impersonation and exposure of credentials through browser storage or device compromise.
- Required remediation: remove local password authentication and plaintext credential persistence. Use a properly scoped server-issued session; for offline mode, permit only previously authenticated, locally protected data with explicit limitations, never arbitrary login by local fallback.

### Critical — optional authentication middleware
- `backend/server.js` around lines 111–122 calls `next()` when no token is supplied and also continues when a supplied token is invalid.
- This means route handlers must independently enforce authentication; a global middleware currently does not provide a fail-closed boundary.
- Required remediation: make token parsing reject malformed/invalid bearer tokens, add explicit `requireAuth` and `requireAdmin` middleware, and apply them to every private route. Keep only deliberate public endpoints unauthenticated.

### Critical — patient ownership is not consistently enforced at route boundary
- `backend/server.js` routes for medications, schedules, dose logs, food logs, nutrition targets, and user/profile data accept patient identifiers from request bodies or query parameters (for example around lines 826–1018).
- Schedule create/update passes `req.body` directly to `db.saveSchedule`; medication deletion passes the URL id directly to the database.
- The route review shows no uniform authenticated-user ownership guard on these handlers.
- Impact: cross-account reads or writes if endpoints are reachable without robust per-resource checks.
- Required remediation: derive patient identity from the authenticated principal for patient operations; verify resource ownership for every read/update/delete; reserve cross-patient access for explicitly authorized admin/caregiver flows.

### High — CORS policy allows arbitrary origins
- `backend/server.js` around lines 66–89 returns success for all origins in the CORS callback, including origins not in the allowlist.
- Required remediation: reject unapproved browser origins; keep native no-origin requests only where needed; configure exact production origins through environment configuration.

### High — password verifier contains legacy universal password exceptions
- `backend/database/db.js` around lines 36–54 accepts hard-coded legacy passwords (`123456`, `demo123`, `password123`) in addition to PBKDF2 verification.
- Required remediation: remove universal exceptions; migrate legacy accounts via a forced password reset or a one-time secure migration; retain constant-time comparison after validating hash format and lengths.

### High — alarm scheduling claims exceed what the implementation guarantees
- `src/services/notificationService.js` around lines 118–180 schedules a repeating daily notification and describes it as guaranteed to ring while the app is closed. Android exact-alarm behavior is permission-, OS-, and OEM-dependent; a local notification is not a full alarm-clock service.
- Notification channel initialization swallows errors and can leave channel/action setup incomplete without exposing a recoverable state.
- The action listener handles snooze only; TAKE and SKIP are logged but do not update dose records in this service.
- Required remediation: check notification permission and exact-alarm capability where supported; surface disabled/denied states; reconcile pending notifications against persisted schedules on app startup and after schedule edits; implement TAKE/SKIP actions through authenticated dose logging; test reboot, timezone/DST, app update, battery restrictions, denied permissions, duplicate schedule IDs, and Android 12–16 devices.

### High — broad body-size limits
- `backend/server.js` around lines 108–109 configures JSON and URL-encoded bodies up to 100 MB globally.
- Required remediation: use small global limits and route-specific upload limits for image/document endpoints.

### Medium — Android backup and cleartext configuration need review
- `android/app/src/main/AndroidManifest.xml` enables `allowBackup=true` and `usesCleartextTraffic=true`.
- Required remediation: disable or explicitly configure backup exclusions for sensitive app data; restrict cleartext traffic to development-only network security configuration and use HTTPS in production.

## Positive controls observed

- Backend uses Helmet and express-rate-limit.
- Patient passwords are hashed using PBKDF2 in the database layer for the normal server registration path.
- Supabase migrations enable RLS and revoke direct privileges from `anon` and `authenticated`.
- Android manifest declares notification, vibration, boot-receive, and exact-alarm permissions.
- Database SSL helper enforces certificate verification for remote PostgreSQL connections.

These controls do not neutralize the bypasses described above.

## Verification still required

1. Review every route and all admin/caregiver authorization paths, including prescription scanning/approval, consent, backups, and user directory endpoints.
2. Inspect database fallback behavior and ensure a database outage cannot silently switch production into an insecure in-memory or local-auth mode.
3. Run backend test suite, frontend lint/build, migration checks against a disposable Supabase project, and Android alarm instrumentation/manual matrix.
4. Add automated negative tests: no token, malformed token, expired token, patient A accessing patient B, patient invoking admin routes, and credential fallback attempts.
5. Validate notification scheduling and action handling on real Android devices with app killed/rebooted and exact-alarm permission denied/granted.

## Change policy

This audit branch intentionally contains documentation only. No security behavior has been changed yet, because safely fixing authorization requires reviewing all route consumers and data ownership semantics first. Do not merge this audit document as a substitute for the remediation work.
