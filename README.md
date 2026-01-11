# paste.orcax (Cloudflare Worker Pastebin)

English | 中文

## English

Minimal pastebin built on **Cloudflare Workers** + **R2**. Anyone can upload a text snippet or a file with an expiration time and get a shareable link.

### Architecture

- Worker entry: `src/index.ts`
- Storage (R2):
  - `meta/<id>.json` (metadata)
  - `data/<id>` (raw content)
- UI: static SPA assets in `public/` served via Workers Assets binding

### API

- `POST /api/paste`
  - JSON: `{"content":"...","filename":"...","language":"javascript","expiresInSeconds":86400}`
  - multipart: `file=<File>` + optional `filename`, `language`, `expiresInSeconds`
- `GET /api/paste/:id/meta`
- `GET /api/paste/:id/raw`
- `GET /api/paste/:id/download`
- `GET /api/health`

### Local development

Prereqs: Node.js + Wrangler.

- Install: `npm install`
- Run locally (mocked + persisted): `npm run dev`
  - Uses `wrangler dev --local --persist-to .wrangler/state`

### Deploy

- Deploy: `npm run deploy`
- Route is configured in `wrangler.toml` (expects the `orcax.net` zone and `paste.orcax.net/*` route)

### Cloudflare resources

- R2 buckets expected by `wrangler.toml`:
  - `paste-orcax` (production)
  - `paste-orcax-dev` (preview/dev)

### Expiration cleanup

- Expired pastes are deleted on access.
- A cron trigger runs periodically for best-effort cleanup (configured in `wrangler.toml`).

---

## 中文

这是一个基于 **Cloudflare Workers** + **R2** 的极简 Pastebin：任何人都可以上传代码片段或文件（带过期时间），并生成可分享的唯一链接。

### 架构

- Worker 入口：`src/index.ts`
- 存储（R2）：
  - `meta/<id>.json`（元信息）
  - `data/<id>`（原始内容）
- UI：`public/` 下的静态 SPA 资源，通过 Workers Assets binding 提供

### API

- `POST /api/paste`
  - JSON：`{"content":"...","filename":"...","language":"javascript","expiresInSeconds":86400}`
  - multipart：`file=<File>`，可选 `filename` / `language` / `expiresInSeconds`
- `GET /api/paste/:id/meta`
- `GET /api/paste/:id/raw`
- `GET /api/paste/:id/download`
- `GET /api/health`

### 本地开发

依赖：Node.js + Wrangler。

- 安装：`npm install`
- 本地运行（mock R2 且持久化）：`npm run dev`
  - 使用 `wrangler dev --local --persist-to .wrangler/state`

### 部署

- 部署：`npm run deploy`
- 路由在 `wrangler.toml` 中配置（假设 `orcax.net` zone 已存在，并绑定 `paste.orcax.net/*`）

### Cloudflare 资源

- `wrangler.toml` 期望存在的 R2 buckets：
  - `paste-orcax`（生产）
  - `paste-orcax-dev`（预览/开发）

### 过期清理

- 访问时会对过期内容进行删除。
- 另外配置了定时 cron 触发器进行 best-effort 清理（见 `wrangler.toml`）。
