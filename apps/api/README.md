# VaultX API

Express + TypeScript backend for VaultX. Handles authentication, session
management, vault item storage (encrypted blobs only), and supporting
features (OTP, card PIN, breach checking, sharing).

## Stack

- **Runtime**: Node.js (tsx for dev, compiled for prod)
- **Framework**: Express
- **Database**: PostgreSQL via `pg` + Knex (migrations only — no ORM)
- **Cache**: Redis (`ioredis`)
- **Auth**: JWT (access + refresh), Argon2id password hashing
- **Email**: Resend
- **Validation**: Zod

## Project Structure

```
src/
├── index.ts                 # App entry — middleware, route mounting
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts   # HTTP handlers
│   │   ├── auth.service.ts      # business logic
│   │   ├── auth.validation.ts   # Zod schemas
│   │   ├── auth.routes.ts
│   │   ├── auth.google.ts       # Google OAuth (web flow)
│   │   └── auth.otp.ts          # email OTP for sensitive actions
│   ├── vault/
│   │   ├── vault.controller.ts
│   │   ├── vault.service.ts
│   │   ├── vault.validation.ts
│   │   └── vault.routes.ts
│   ├── user/
│   │   ├── user.controller.ts   # profile get/update
│   │   └── user.routes.ts
│   └── share/                    # one-time share links
├── db/
│   ├── pool.ts                   # pg Pool
│   ├── redis.ts
│   └── migrations/                # Knex migration files
├── middleware/
│   ├── authenticate.ts            # JWT verification
│   ├── rateLimiter.ts
│   ├── emailValidator.ts
│   └── hibp.ts                     # breach check on registration
└── utils/
├── jwt.ts                       # sign/verify access & refresh tokens
├── hash.ts                       # Argon2 hash/verify
├── mailer.ts                     # Resend wrapper
├── emailTemplates.ts
└── audit.ts                       # audit log writer
```

## Environment Variables

Create `apps/api/.env`:

```bash
# Server
PORT=5000
NODE_ENV=development

# Database (Neon connection string)
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=<random 64-char hex>
JWT_REFRESH_SECRET=<random 64-char hex>

# Argon2 tuning
ARGON2_MEMORY_COST=65536
ARGON2_TIME_COST=3
ARGON2_PARALLELISM=1

# Email (Resend)
RESEND_API_KEY=<your key>

# Google OAuth
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<...>
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Frontend URL (for redirects/CORS)
WEB_ORIGIN=http://localhost:5173
```

## Database Schema (key tables)

| Table         | Purpose                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `users`       | email, auth_hash, kdf_salt, kdf_params, vault_key_enc/iv, recovery_key_enc/iv, card_pin_hash, google_id, profile fields |
| `vaults`      | one per user (currently 1:1), `name`                                                                                    |
| `vault_items` | `vault_id`, `type` (login/note/card), `encrypted_data`, `iv`, `category`, timestamps                                    |
| `sessions`    | refresh token hashes, device info, expiry                                                                               |
| `audit_logs`  | login/register/password-change events                                                                                   |

Run migrations:

```bash
npm run migrate        # apply pending
npm run migrate:rollback
```

## API Endpoints

### Auth (`/api/auth`)

| Method          | Path                             | Auth      | Description                                                  |
| --------------- | -------------------------------- | --------- | ------------------------------------------------------------ |
| POST            | `/register`                      | —         | Create account, returns tokens                               |
| POST            | `/login`                         | —         | Returns accessToken + vault_key_enc/iv                       |
| POST            | `/prelogin`                      | —         | Returns kdfSalt/kdfParams for an email                       |
| POST            | `/refresh`                       | cookie    | Rotate refresh token                                         |
| POST            | `/logout`                        | JWT       | Invalidate session                                           |
| PUT             | `/change-password`               | JWT + OTP | Change master password                                       |
| DELETE          | `/account`                       | JWT       | Delete account (emails export first)                         |
| GET             | `/google`                        | —         | Start Google OAuth (web)                                     |
| GET             | `/google/callback`               | —         | OAuth callback                                               |
| POST            | `/google/extension`              | —         | Extension OAuth code exchange                                |
| POST            | `/google/unlock-session`         | —         | Re-issue session for Google user after master password entry |
| POST            | `/forgot-password/send-otp`      | —         | Send 6-digit reset code                                      |
| POST            | `/forgot-password/reset`         | —         | Reset via OTP (clears vault)                                 |
| POST            | `/forgot-password/recovery-key`  | —         | Reset via recovery key (preserves vault)                     |
| GET             | `/forgot-password/recovery-data` | —         | Fetch `recovery_key_enc/iv` for an email                     |
| POST            | `/otp/send`, `/otp/verify`       | JWT       | General OTP for sensitive settings actions                   |
| GET/DELETE      | `/sessions`                      | JWT       | List/terminate active sessions                               |
| POST/GET/DELETE | `/card-pin/*`                    | JWT       | Card PIN management                                          |

### Vault (`/api/vault`)

| Method | Path            | Description                                        |
| ------ | --------------- | -------------------------------------------------- |
| GET    | `/items`        | List all encrypted items for the user              |
| POST   | `/items`        | Create item `{type, encryptedData, iv, category?}` |
| PUT    | `/items/:id`    | Update item                                        |
| DELETE | `/items/:id`    | Soft-delete                                        |
| POST   | `/breach-alert` | Log breached-site notification                     |

### User (`/api/user`)

| Method | Path       | Description                                          |
| ------ | ---------- | ---------------------------------------------------- |
| GET    | `/profile` | email, display_name, profile_photo, vault_key_enc/iv |
| PUT    | `/profile` | Update display name / photo                          |

## Important Implementation Notes

- **All vault item bodies are opaque ciphertext** — the API never parses
  `encrypted_data`. Validation only checks shape (`type`, base64-ish strings,
  optional `category`).
- **`category` field is `.optional()` in Zod**, not `.nullable()` — never send
  `category: null`, omit the key instead.
- **`kdf_params` is stored as TEXT (JSON string)** — always
  `JSON.parse`/`JSON.stringify` when reading/writing.
- **Argon2id** is applied server-side on top of the client's PBKDF2 output —
  this is intentional defense-in-depth, not redundant.
