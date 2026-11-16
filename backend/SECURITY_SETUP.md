# MedRemind security configuration

This branch removes the built-in administrator password and requires server-validated sessions.

## Required production environment

Set these values in the backend hosting provider's secret/environment settings. Do not commit real values or share them in support messages.

- `NODE_ENV=production`
- `DATABASE_URL`: the production PostgreSQL/Supabase connection string.
- `AUTH_SECRET`: a cryptographically random secret of at least 32 bytes (for example, generate with `openssl rand -hex 32`). Keep it stable across restarts and instances.
- `ADMIN_EMAIL`: the dedicated administrator sign-in email.
- `ADMIN_PASSWORD_HASH`: PBKDF2-SHA512 hash in the exact `salt:hash` format described below. Never use a plaintext password here.
- `CRON_SECRET`: a separate high-entropy secret. The scheduler must send it as the `X-Cron-Secret` request header to `POST /api/tick`.
- `ALLOWED_ORIGINS`: comma-separated exact production web origins (for example, `https://app.example.com,https://admin.example.com`). Do not include wildcards or broad hosting-provider suffixes.

## Generate an administrator password hash

Run this locally in a trusted terminal, replacing the example password with a unique strong password. Do not paste the password into GitHub, source code, tickets, or chat.

```bash
node -e "const c=require('crypto'); const p=process.argv[1]; const s=c.randomBytes(16).toString('hex'); console.log(s+':'+c.pbkdf2Sync(p,s,100000,64,'sha512').toString('hex'))" 'REPLACE_WITH_A_UNIQUE_STRONG_PASSWORD'
```

Copy only the generated `salt:hash` output into the backend host's `ADMIN_PASSWORD_HASH` secret. Set the matching administrator email in `ADMIN_EMAIL`. The password is never stored in this repository.

## Important deployment notes

1. Configure the environment variables before deploying this branch. Admin login will intentionally fail until `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` are set.
2. Configure `ALLOWED_ORIGINS` with exact origins for the production public and admin frontends.
3. Configure the scheduled job to send `X-Cron-Secret: <CRON_SECRET>` to `POST /api/tick`.
4. Use HTTPS for all deployed clients and API endpoints.
5. Rotate any previously used demo/admin passwords. Existing sessions signed with the old auth secret will need to sign in again after the secret is rotated.
6. This change intentionally removes local-only registration and login fallbacks. Users must be able to reach the backend to create or authenticate an account. Cached local profile data is not treated as proof of identity.
7. The global JSON body limit is now 10 MB. Large prescription images should use the multipart upload endpoint rather than oversized base64 JSON payloads.

## Verification checklist before production

- [ ] Set all required environment variables in the hosting provider.
- [ ] Verify administrator login succeeds with the configured email/password and fails with the old `ADMIN / 123456` pair.
- [ ] Verify patient login fails when the API is unreachable; no local password fallback is allowed.
- [ ] Verify invalid/expired bearer tokens are rejected.
- [ ] Verify non-admin users cannot call admin endpoints.
- [ ] Verify a patient cannot request another patient's ID in patient data endpoints.
- [ ] Verify the scheduler receives 401 without the correct `X-Cron-Secret`.
- [ ] Run backend and frontend tests/builds and perform Android notification testing on physical devices.
