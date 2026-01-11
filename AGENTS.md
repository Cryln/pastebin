# Architecture Overview (paste.orcax)

## 1) Project Overview

This is a Cloudflare Worker application with a static single-page UI. It behaves like a minimal pastebin: anyone can upload a text snippet or a file with an expiration time and receive a unique shareable link.

- **Runtime:** Cloudflare Workers (TypeScript), entry at `src/index.ts`.
- **Storage:** Cloudflare R2 only. Each paste is stored as:
  - `meta/<id>.json` (metadata JSON)
  - `data/<id>` (raw bytes)
- **UI:** Static assets served from `public/` via Workers “assets” binding.

## 2) Build & Commands

Commands are defined in `package.json:6`.

- `npm run dev`: local Worker + local R2 persistence via Wrangler (`wrangler dev --local --persist-to .wrangler/state`).
- `npm run dev:remote`: run against Cloudflare (requires Wrangler auth and configured resources).
- `npm run deploy`: deploy to Cloudflare (`wrangler deploy`).
- `npm run typecheck`: TypeScript typecheck (`tsc --noEmit`).
- `npm run lint`: ESLint.

## 3) Code Style

- **TypeScript:** `strict` is enabled in `tsconfig.json:8`.
- **Linting:** ESLint + `typescript-eslint` config in `eslint.config.js:1`.
- **Notes:** The browser-side code in `public/` is intentionally excluded from linting (`eslint.config.js:6`).

## 4) Testing

- No automated test framework is currently configured.
- Validation today is via `npm run typecheck` / `npm run lint` and manual verification with `npm run dev`.

## 5) Security

The service is intentionally unauthenticated (anyone can create pastes).

- **Upload limits:** enforced by `MAX_UPLOAD_BYTES` (`wrangler.toml:15`) in `src/index.ts:47`.
- **Expiration:** checked on read; expired pastes are deleted lazily and also by a best-effort cron sweep (`src/index.ts:219`).
- **UI hardening:** security headers (CSP, XFO, etc.) are added in `src/index.ts:157`.
- **XSS defense:** the viewer renders content via `textContent` (not `innerHTML`) in `public/app.js:169`.

## 6) Configuration

Primary config is `wrangler.toml`:

- **Assets binding:** `[assets]` serves `public/` through `env.ASSETS.fetch(...)` (`wrangler.toml:5`, `src/index.ts:151`).
- **R2 binding:** `binding = "R2"` with `bucket_name`/`preview_bucket_name` (`wrangler.toml:9`).
- **Vars:** `MAX_UPLOAD_BYTES`, `DEFAULT_EXPIRES_SECONDS`, `MAX_EXPIRES_SECONDS` (`wrangler.toml:14`).
- **Cron:** every 6 hours for limited cleanup (`wrangler.toml:19`).

## Rules & Agent Instructions

- **Cursor rules:** none found under `.cursor/rules/`.
- **Copilot instructions:** none found at `.github/copilot-instructions.md`.
- **Trae rules:** none found under `.trae/rules/`.
