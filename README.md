# VaultX — Zero-Knowledge Password Manager

VaultX is a full-stack password manager built around a zero-knowledge
architecture: the server never sees your master password or any unencrypted
vault data. All encryption and decryption happens in the browser using the
Web Crypto API.

This is a monorepo containing three applications:

| App               | Path              | Stack                                                  |
| ----------------- | ----------------- | ------------------------------------------------------ |
| API               | `apps/api`        | Node.js, Express, TypeScript, PostgreSQL (Neon), Redis |
| Web App           | `apps/web`        | React 18, TypeScript, Vite, Tailwind                   |
| Browser Extension | `apps/extensions` | React, TypeScript, Vite, Chrome MV3                    |

Each app has its own detailed README — see:

- [`apps/api/README.md`](apps/api/README.md)
- [`apps/web/README.md`](apps/web/README.md)
- [`apps/extensions/README.md`](apps/extensions/README.md)

---

## 1. High-Level Architecture

```mermaid
graph TB
    subgraph Clients
        WEB["Web App<br/>(React + Vite)<br/>localhost:5173"]
        EXT["Browser Extension<br/>(Chrome MV3)"]
    end

    subgraph Server["Backend — apps/api (port 5000)"]
        API[Express API]
        AUTH[Auth Module]
        VAULT[Vault Module]
        USER[User Module]
    end

    subgraph Data
        PG[("PostgreSQL<br/>Neon")]
        REDIS[("Redis<br/>Sessions, OTP")]
    end

    subgraph External
        HIBP["Have I Been Pwned<br/>(breach check)"]
        RESEND["Resend<br/>(emails)"]
        GOOGLE["Google OAuth"]
    end

    WEB -- "HTTPS + JWT" --> API
    EXT -- "HTTPS + JWT" --> API
    API --> AUTH
    API --> VAULT
    API --> USER
    AUTH --> PG
    AUTH --> REDIS
    VAULT --> PG
    AUTH --> HIBP
    AUTH --> RESEND
    AUTH --> GOOGLE
```

**Key principle**: the API stores only _encrypted blobs_ for vault data
(`encrypted_data`, `iv`) and _encrypted keys_ (`vault_key_enc`,
`recovery_key_enc`). It has no way to read passwords, notes, or card details —
even with full database access.

---

## 2. The Zero-Knowledge Key Hierarchy

This is the most important concept in the codebase. Three keys exist, each
derived/encrypted differently:

```mermaid
graph TD
    PW["Master Password<br/>(never sent to server)"]
    RK["Recovery Key<br/>(random 32 bytes, shown once)"]
    MK["Master Key<br/>(random 32 bytes, generated at registration)"]
    VAULT_ITEMS["Vault Items<br/>(logins, notes, cards)"]

    PW -- "PBKDF2 (600k iter)<br/>+ kdfSalt" --> DK["Derived Key<br/>(64 bytes: authKey + vaultKey)"]
    DK -- "vaultKey encrypts" --> MK
    RK -- "encrypts" --> MK
    MK -- "encrypts/decrypts" --> VAULT_ITEMS

    DK -.->|"vault_key_enc + vault_key_iv<br/>(stored in DB)"| PG1[(DB)]
    RK -.->|"recovery_key_enc + recovery_key_iv<br/>(stored in DB)"| PG2[(DB)]
```

- **Master Key** is the _root secret_. It's generated once at registration and
  encrypts every vault item directly. It never changes unless an OTP-based
  reset occurs.
- **Master Password** never leaves the device. `PBKDF2(password, kdfSalt,
600000 iterations)` produces 64 bytes, split into `authKey` (sent to server,
  hashed again with Argon2, used for login verification) and `vaultKey` (stays
  client-side, decrypts `vault_key_enc` to reveal the Master Key).
- **Recovery Key** is a second, independent "lock" on the Master Key. It's
  shown once at registration (downloadable `.txt` + emailed) and lets a user
  reset their password **without losing vault data** — see the reset flows
  below.

### Why AES-GCM doubles as verification

AES-GCM includes an authentication tag. If you try to decrypt
`recovery_key_enc` with the wrong recovery key, `subtle.decrypt()` throws —
there's no separate "is this key correct" check needed. Wrong key = throw =
caught and shown as "Invalid recovery key".

---

## 3. Authentication & Reset Flows

### Registration

```mermaid
sequenceDiagram
    participant U as User (browser)
    participant API as API
    participant DB as PostgreSQL

    U->>U: Generate kdfSalt, authSalt
    U->>U: deriveKeys(password, kdfSalt) -> authKey, vaultKey
    U->>U: masterKey = random(32 bytes)
    U->>U: vaultKeyEnc = AES-GCM(masterKey, vaultKey)
    U->>U: recoveryKey = random(32 bytes)
    U->>U: recoveryKeyEnc = AES-GCM(masterKey, recoveryKey)
    U->>API: POST /api/auth/register<br/>{authKey, kdfSalt, vaultKeyEnc, recoveryKeyEnc, recoveryKeyDisplay, ...}
    API->>API: authHash = Argon2(authKey)
    API->>DB: INSERT user (auth_hash, kdf_salt, vault_key_enc, recovery_key_enc, ...)
    API-->>U: accessToken, refreshToken (cookie)
    U->>U: Download recovery-key .txt file
    API->>U: Email recovery key (via Resend)
```

### Login

```mermaid
sequenceDiagram
    participant U as User
    participant API as API

    U->>API: POST /api/auth/prelogin {email}
    API-->>U: kdfSalt, kdfParams
    U->>U: deriveKeys(password, kdfSalt) -> authKey, vaultKey
    U->>API: POST /api/auth/login {authKey}
    API->>API: verify Argon2(authKey) == auth_hash
    API-->>U: accessToken, vaultKeyEnc, vaultKeyIv
    U->>U: masterKey = AES-GCM-Decrypt(vaultKeyEnc, vaultKey)
    Note over U: masterKey now decrypts all vault items
```

### Forgot Password — Recovery Key (vault preserved)

```mermaid
sequenceDiagram
    participant U as User
    participant API as API

    U->>U: Enter/upload recoveryKey
    U->>API: GET /api/auth/forgot-password/recovery-data?email=...
    API-->>U: recovery_key_enc, recovery_key_iv
    U->>U: masterKey = AES-GCM-Decrypt(recovery_key_enc, recoveryKey)
    Note over U: throws if recoveryKey wrong -> "Invalid recovery key"
    U->>U: newKdfSalt, derive newVaultKey from new password
    U->>U: newVaultKeyEnc = AES-GCM(masterKey, newVaultKey)
    U->>API: POST /api/auth/forgot-password/recovery-key<br/>{newAuthKey, newKdfSalt, newVaultKeyEnc, ...}
    API->>API: UPDATE users SET auth_hash, kdf_salt, vault_key_enc...
    API->>API: DELETE all sessions
    Note over U: masterKey unchanged -> vault items still decrypt
```

### Forgot Password — Email OTP (vault cleared)

Same shape, but `masterKey` is **regenerated** (new random 32 bytes) instead
of recovered. Old vault items, encrypted with the old masterKey, become
permanently unreadable — by design (zero-knowledge means the server can't
"migrate" them without the old key).

---

## 4. Monorepo Structure

```
pm/
├── apps/
│   ├── api/                  # Express backend
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/      # register, login, OAuth, password reset
│   │   │   │   ├── vault/      # vault items CRUD, sharing
│   │   │   │   ├── user/       # profile
│   │   │   │   └── share/      # one-time share links
│   │   │   ├── db/
│   │   │   │   ├── migrations/ # Knex migrations
│   │   │   │   ├── pool.ts      # PostgreSQL pool
│   │   │   │   └── redis.ts
│   │   │   ├── middleware/      # auth, rate limiting, HIBP check
│   │   │   ├── utils/            # jwt, hash, mailer, emailTemplates
│   │   │   └── index.ts
│   │   └── README.md
│   │
│   ├── web/                   # React web app
│   │   ├── src/
│   │   │   ├── pages/           # Login, Register, Dashboard, Settings, etc.
│   │   │   ├── components/       # VaultItemCard, modals
│   │   │   ├── lib/                # crypto.ts, kdf.ts, api.ts, storage.ts
│   │   │   └── store/              # Zustand state (useVaultStore)
│   │   └── README.md
│   │
│   └── extensions/             # Chrome/Edge extension (MV3)
│       ├── src/
│       │   ├── background/        # service-worker.ts (message router)
│       │   ├── content/             # content-script.ts (form capture/autofill)
│       │   ├── popup/                # Login, Vault, VaultItem, CardPinGate
│       │   └── lib/                   # crypto, kdf, api, message
│       └── README.md
│
├── README.md
└── CONTRIBUTING.md
```

---

## 5. Tech Stack Summary

| Layer                 | Choice                          | Why                                                           |
| --------------------- | ------------------------------- | ------------------------------------------------------------- |
| Backend framework     | Express + TypeScript            | Simple, well-understood, fast to iterate                      |
| Database              | PostgreSQL (Neon)               | Serverless Postgres, branching, generous free tier            |
| Cache/sessions        | Redis                           | Session storage, OTP codes, rate-limit counters               |
| Auth tokens           | JWT (access + refresh)          | Stateless access tokens, rotated refresh tokens in DB         |
| Password hashing      | Argon2id                        | Server-side hash of client-derived authKey (defense-in-depth) |
| Client key derivation | PBKDF2-SHA256, 600k iterations  | Web Crypto native, no WASM dependency                         |
| Encryption            | AES-256-GCM                     | Authenticated encryption, built into Web Crypto               |
| Frontend              | React 18 + Vite + Tailwind      | Fast dev loop, small bundle                                   |
| Extension             | Chrome MV3 (service worker)     | Required for current Chrome Web Store submissions             |
| Email                 | Resend                          | Simple API, good deliverability                               |
| Breach checking       | Have I Been Pwned (k-anonymity) | Passwords never leave the device                              |

---

## 6. Local Development Quick Start

```bash
# 1. Install dependencies (run from repo root — npm workspaces)
npm install

# 2. Set up environment variables (see each app's README for required vars)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 3. Run migrations
cd apps/api && npm run migrate

# 4. Start everything (3 terminals)
cd apps/api && npm run dev      # http://localhost:5000
cd apps/web && npm run dev      # http://localhost:5173
cd apps/extensions && npm run dev  # then load dist/ as unpacked extension
```

---

## 7. Security Notes

- **Zero-knowledge**: server stores only ciphertext + encrypted keys. Master
  password and Master Key never transit the network.
- **Defense in depth**: client sends `authKey` (derived via PBKDF2), server
  hashes it again with Argon2id before storing — so even a DB leak doesn't
  expose anything usable for offline cracking of the original password.
- **Session security**: refresh tokens are rotated on every use; reuse of an
  old refresh token triggers a "kill all sessions" response (token-theft
  protection).
- **Rate limiting**: login, registration, and refresh endpoints are rate
  limited.
- **HIBP checks**: passwords are checked against Have I Been Pwned using
  k-anonymity (only first 5 chars of SHA-1 hash sent).
