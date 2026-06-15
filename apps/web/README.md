# VaultX Web App

React + Vite frontend for VaultX. All cryptography happens here — the
backend never receives plaintext passwords or vault data.

## Stack

- React 18 + TypeScript
- Vite
- React Router
- Tailwind CSS (CSS variables for theming — `--bg-base`, `--accent`, etc.)
- Zustand (`useVaultStore`) for in-memory session state

## Project Structure

```
src/
├── pages/
│   ├── Login.tsx
│   ├── Register.tsx
│   ├── ForgotPassword.tsx       # OTP + Recovery Key reset flows
│   ├── Unlock.tsx                 # re-enter password (token expired, masterKey lost)
│   ├── Dashboard.tsx
│   ├── HealthDashboard.tsx        # breach/weak/reused password analysis
│   ├── Settings.tsx                # Profile, Security, Appearance, Data tabs
│   ├── GoogleSetup.tsx              # new Google user — set master password
│   └── GoogleUnlock.tsx              # existing Google user — unlock vault
├── components/
│   └── VaultItemCard.tsx              # login/note/card display + actions
├── lib/
│   ├── crypto.ts        # AES-256-GCM encrypt/decrypt, recovery key helpers
│   ├── kdf.ts             # PBKDF2 key derivation
│   ├── api.ts              # axios instance, auto-refresh on 401
│   ├── storage.ts           # localStorage session cache
│   ├── csvImport.ts          # Chrome/Firefox/Bitwarden/1Password CSV parsing
│   ├── favicon.ts
│   ├── toast.ts
│   └── totp.ts                # TOTP code generation for saved 2FA secrets
└── store/
└── useVaultStore.ts          # masterKey, accessToken, userId (in-memory)
```

## Environment Variables

`apps/web/.env`:

```bash
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=<same as backend>
```

## Crypto Module Reference (`lib/crypto.ts`)

| Function                                            | Purpose                                         |
| --------------------------------------------------- | ----------------------------------------------- |
| `encrypt(plaintext, key)` / `decrypt(payload, key)` | AES-256-GCM on strings, base64 in/out           |
| `encryptBytes` / `decryptBytes`                     | Same, for raw `Uint8Array` (used for masterKey) |
| `generateVaultKey()`                                | Random 32 bytes — the Master Key                |
| `generateRecoveryKey()`                             | Random 32 bytes — the Recovery Key              |
| `recoveryKeyToString(key)`                          | Formats as `XXXX-XXXX-...` for display/download |
| `recoveryKeyFromString(str)`                        | Parses back to bytes (strips dashes)            |

## Key Derivation (`lib/kdf.ts`)

```typescript
deriveKeys(password, kdfSalt, kdfParams)
  -> { authKey: 32 bytes, vaultKey: 32 bytes }
```

PBKDF2-SHA256, 600,000 iterations, salt is hex-encoded in the DB and converted
to bytes before use. `authKey` is sent to the server (hex); `vaultKey` never
leaves the browser.

## Session State

- **`useVaultStore` (Zustand, in-memory only)**: `masterKey`, `accessToken`,
  `userId`. Cleared on tab close / logout. This is what actually decrypts
  vault items during the session.
- **`localStorage` (`lib/storage.ts`)**: `vx_session` — `email`, `userId`,
  `kdfSalt`, `kdfParams`, `vault_key_enc/iv`. NOT the master key. Used by
  `Unlock.tsx` to re-derive the master key after a page refresh without a full
  re-login (access token refreshed via httpOnly cookie).

## Page Flow Reference

- `Register.tsx` → generates masterKey + recoveryKey, downloads recovery file,
  calls `/api/auth/register`.
- `Login.tsx` → prelogin → deriveKeys → login → decrypt masterKey →
  `setVaultKey()`.
- `ForgotPassword.tsx` → two paths:
  - **Recovery key**: upload/paste key → decrypt `recovery_key_enc` →
    re-encrypt masterKey with new password → vault preserved.
  - **Email OTP**: verify code → generate NEW masterKey → vault cleared.
- `Dashboard.tsx` → fetches `/api/vault/items`, decrypts each with masterKey,
  renders `VaultItemCard`s.
- `Settings.tsx` → Security tab requires OTP before allowing password change
  (re-encrypts vault_key with new password, same masterKey).

## Running

```bash
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build
```
