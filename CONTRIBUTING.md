# Contributing to VaultX

## Project Principles

1. **Zero-knowledge is non-negotiable.** Any change that causes plaintext
   passwords, master keys, or vault contents to be sent to or stored on the
   server is a critical bug, not a feature request.
2. **Crypto code stays in sync.** `lib/crypto.ts` and `lib/kdf.ts` in
   `apps/web` and `apps/extensions` must remain functionally identical — both
   must produce the same ciphertext for the same inputs.
3. **Validation matches reality.** Backend Zod schemas should use
   `.optional()` for fields the client may omit, not `.nullable()` — clients
   should omit keys rather than send `null`, unless a schema explicitly
   supports `null`.

## Development Setup

See the root `README.md` "Quick Start" section. You'll need:

- Node.js 20+
- A Neon (or any Postgres) database
- A Redis instance (local or Upstash)
- Resend API key (for email features — optional for basic dev)

## Workflow

1. Branch from `main`: `git checkout -b feat/short-description`
2. Make changes within the relevant `apps/*` package
3. Run the build for any package you touched:

```bash
   cd apps/api && npm run build
   cd apps/web && npm run build
   cd apps/extensions && npm run build
```

4. Test manually against the checklist below (no automated test suite yet)
5. Commit with a descriptive message (conventional-commit style preferred:
   `feat:`, `fix:`, `chore:`, `docs:`)

## Manual Test Checklist (run before any auth/crypto change)

1. Register a new account → recovery key downloads + email arrives
2. Add a login, note, and card item
3. Logout → login again → items decrypt correctly
4. Forgot password → Recovery Key path → vault items survive
5. Forgot password → Email OTP path → vault appears empty (expected)
6. Extension: login, add item via a real site's form, confirm it appears in
   web dashboard
7. Extension: close browser fully, reopen → re-unlock screen (not full login)
8. Extension: visit a site with a saved login → autofill suggestion appears

## Code Style

- TypeScript strict mode — no `any` unless genuinely necessary (extension
  message payloads sometimes require it for `chrome.runtime` typing)
- Prefer full-file rewrites over fragile partial edits when a file has many
  interdependent changes
- Tailwind via CSS variables (`var(--accent)`, `var(--bg-surface)`, etc.) —
  don't hardcode colors

## Reporting Issues

Include:

- Which app (`api` / `web` / `extensions`)
- Steps to reproduce
- Browser console output (for extension issues, check the service worker
  console via `chrome://extensions` → "service worker" link)
