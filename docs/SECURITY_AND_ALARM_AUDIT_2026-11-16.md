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


### Critical — additional administrative and medical-data endpoints are unguarded
Further route-by-route inspection found:
- `GET /api/users` and `PUT /api/users/:id/status` (around lines 650–665) have no visible admin authorization check.
- `POST /api/admin/backup` (around lines 1070–1075) has no visible admin authorization check.
- `GET /api/users/:patientId` (around lines 1078–1081) accepts an arbitrary patient identifier.
- Consent endpoints accept caller-supplied user IDs (around lines 1035–1066) without a visible identity/ownership check.
- Prescription scan and approval endpoints accept caller-supplied `patientId` values (around lines 1359–1375 and 1786–1793); approval can write medications against that identity.
- `POST /api/tick` (around lines 2215 onward) is an operational state-changing endpoint with no visible authentication or scheduler secret check.
- These findings reinforce the need for route-level authorization, not just token parsing.

### High — database outage can silently degrade persistence/security
- `backend/database/db.js` describes a PostgreSQL plus durable fallback mode and sets `isPostgres = false` when PostgreSQL setup/connection fails (around lines 88–151).
- Many database operations fall back to in-memory collections when PostgreSQL is unavailable.
- Required remediation: make production startup fail closed when required database configuration/connection is absent; restrict in-memory fallback to explicit local development/test mode; return controlled service-unavailable errors instead of silently accepting writes that may not persist.

### High — demo password exceptions remain in server database layer
- The normal database registration path uses PBKDF2, but the verifier still contains hard-coded legacy exceptions (around lines 36–54). A server-side fallback accepting fixed passwords defeats the normal per-user hash check.

### High — sensitive health data and uploads need further review
- The server accepts large JSON/base64 prescription payloads in addition to multipart uploads. Combined with a 100 MB global body parser limit, this creates avoidable memory/availability risk.
- Prescription scan/approval routes must authenticate the patient and bind uploaded document ownership to the authenticated user before OCR or approval.
- Audit logs should avoid unnecessary sensitive health details and must not be treated as a substitute for authorization.


## Remediation progress on this branch

The following changes have since been committed to `security/medremind-audit-2026-11-16` (not merged to `main`):

- Removed the built-in `ADMIN / 123456` authentication path. Administrator sign-in now requires `ADMIN_EMAIL` and a PBKDF2 `ADMIN_PASSWORD_HASH` configured outside the repository.
- Removed client-side demo/admin login and local password-based authentication. Login and registration now require the backend; cached profile data is not treated as authentication.
- Removed client persistence of plaintext passwords and sanitized cached registered-user records.
- Session restoration now validates the bearer token with `/api/auth/me`; expired/invalid sessions are cleared.
- Removed universal legacy password exceptions from the PBKDF2 verifier and hardened token signature, algorithm, and expiration validation.
- Supplied invalid bearer tokens are rejected instead of being silently treated as anonymous.
- Added explicit admin guards to user directory/status, admin account-deletion, and backup routes.
- Added authenticated patient-access guards to medication, schedule, dose, food, nutrition, consent, chat, and prescription workflows. Patient IDs for writes are bound to the authenticated identity for the covered routes.
- Medication update/delete database methods now constrain operations by both resource ID and patient owner.
- Medication and schedule upserts reject cross-patient ID collisions.
- Removed the server's "first registered user" fallback from patient lookup and made unknown patient IDs return not found.
- Added a scheduler shared-secret guard for `POST /api/tick`.
- Restricted CORS to exact configured origins (plus local development origins outside production), reduced global JSON/urlencoded body limits to 10 MB, and made production startup refuse to run without a healthy PostgreSQL connection.
- Added `backend/SECURITY_SETUP.md` with deployment configuration guidance and `backend/security.test.js` with regression tests for password/JWT validation and key authorization boundaries.

## Remaining work / limitations

- The changes are static code edits only at this point. The backend test suite, frontend lint/build, migration checks, and Android alarm tests have **not yet been executed** in a project runtime.
- Complete route-by-route review is still required for every prescription upload/approval path, admin feature, notification API, and all database fallback methods.
- Some resource-level ownership checks still need review, especially schedules, dose logs, nutrition targets, consent records, and any legacy JSON-store routes. Route middleware binds the caller-supplied patient identifier, but not every resource ID has a dedicated owner-scoped database operation yet.
- Existing local JSON/demo records and previously issued tokens should be reviewed and rotated/migrated as part of deployment; these code changes do not retroactively erase old data.
- Android exact-alarm permission handling, reboot reconciliation, notification action persistence, snooze, and Take/Skip integration remain unimplemented pending focused review and device testing.
- Do not merge/deploy until the required environment variables are set and all automated/manual verification passes.


### Additional alarm and Android hardening committed

- Replaced the daily repeating local notification with a rolling 14-day queue of one-shot reminders. On Android, one-shot alarms can use exact scheduling when the user has granted exact-alarm access; repeating alarms in the Capacitor Android implementation are inexact.
- Added notification permission and Android exact-alarm status checks, plus a Profile screen control to request notification permission or open Android's exact-alarm settings.
- The app now rebuilds its rolling queue at startup and when returning to the foreground, preserving snooze notifications during queue refresh.
- Wired notification actions back into the app's dose ledger: Take and Skip update the same local dose status used by the Schedule screen; Snooze schedules a new reminder. All actions foreground the app so the handler can execute.
- Matched notification action slot labels to the Schedule screen's dose keys.
- Disabled Android app backup and production cleartext traffic. Cleartext is enabled only in the debug manifest for local development.
- Removed `USE_EXACT_ALARM` from the manifest; the app uses user-controlled `SCHEDULE_EXACT_ALARM` access instead.
- Production startup now also requires strong externally configured `AUTH_SECRET`, `CRON_SECRET`, a configured admin email/hash, exact CORS origins, and a healthy PostgreSQL database.

### Alarm limitations that remain

- The rolling reminder queue covers 14 days and is refreshed when the app launches or resumes. If a user leaves the app unopened beyond that horizon, reminders after the queued window will not be present until the app resumes and refreshes the queue.
- Android exact-alarm permission is user-controlled. If it is denied, reminders are scheduled as inexact notifications and may be delayed; the app displays the permission state rather than claiming exact delivery.
- Take/Skip currently update the app's local dose ledger. Server-side dose-log synchronization, conflict handling, and multi-device consistency still need implementation and verification.
- Device-specific battery optimization, force-stop behavior, OEM background restrictions, reboot restoration, timezone/DST changes, and notification sound/channel behavior have not yet been validated on physical Android devices.


### Local account data isolation

- Medication lists, dose history, patient profile, and in-app notifications are now stored under per-user localStorage keys based on the authenticated account ID.
- The app no longer reads unscoped legacy global health-data keys because those records do not have a trustworthy owner and could be exposed after switching accounts.
- Explicit logout or an invalidated session clears in-memory health data and cancels pending local notifications. Offline startup does not cancel a previously queued reminder set merely because the API is temporarily unavailable.
- Existing data in the old unscoped localStorage keys is intentionally not migrated automatically. A safe migration requires an authenticated ownership check; do not assume the old records belong to the current account.


- Nutrition food logs and nutrition targets were also moved to per-patient localStorage namespaces. Nutrition API requests now rely on the authenticated session rather than the legacy `USR-patient` fallback identity.
- As with the medication store, old unscoped nutrition cache entries are not automatically migrated because their ownership cannot be established safely.


### Additional ownership hardening

- Removed remaining `USR-patient` fallback identities from backend patient/nutrition routes and the nutrition UI/service.
- Nutrition requests now derive ownership from the validated session; food logs and nutrition targets are cached per patient.
- Database food-log create/update and delete operations now require a patient ID and constrain updates/deletes by both record ID and patient ownership.
- Food-log ID collisions across different patients are rejected rather than updating another patient's record.
- Administrator user-directory loading and status changes now use the protected backend endpoints rather than local-only status updates.


### Sensitive-data minimization

- Medication notification channels now use private lock-screen visibility rather than public content display.
- Notification action logs no longer print the notification's medication metadata.
- Backend batch-scan logs no longer print patient names or IDs; registration, medication, food-log, and prescription-mismatch audit records have been reduced to operational identifiers and non-content metadata where possible.


- Frontend API URL overrides now reject non-HTTPS remote origins. Plain HTTP is allowed only for localhost during non-production development, preventing the app from attaching bearer tokens to an insecure remote API URL.
