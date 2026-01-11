import { nanoid } from 'nanoid'
import type { Env, PasteMeta } from './types'
import { dataKey, deletePaste, getMeta, listMetaKeys, putMeta } from './r2'

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(data), { ...init, headers })
}

function badRequest(message: string) {
  return json({ error: message }, { status: 400 })
}

function notFound() {
  return json({ error: 'Not found' }, { status: 404 })
}

function gone() {
  return json({ error: 'Expired' }, { status: 410 })
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function parseExpiresSeconds(input: unknown, env: Env): number | undefined {
  const def = Number(env.DEFAULT_EXPIRES_SECONDS)
  const max = Number(env.MAX_EXPIRES_SECONDS)

  if (input === undefined || input === null || input === '') return def
  if (input === 'never') return undefined

  const n = typeof input === 'string' ? Number(input) : typeof input === 'number' ? input : NaN
  if (!Number.isFinite(n) || n <= 0) return def
  return clampInt(Math.floor(n), 60, max)
}

function safeFilename(name: string | undefined | null) {
  const raw = (name ?? '').trim()
  const fallback = 'snippet.txt'
  if (!raw) return fallback
  return raw.replace(/[\\/\0]/g, '_').slice(0, 180) || fallback
}

function isExpired(meta: PasteMeta) {
  if (!meta.expiresAt) return false
  return Date.now() >= Date.parse(meta.expiresAt)
}

async function handleCreatePaste(req: Request, env: Env) {
  const maxBytes = Number(env.MAX_UPLOAD_BYTES)
  const contentType = req.headers.get('content-type') ?? ''

  const id = nanoid(10)
  const now = new Date()
  const baseMeta: Omit<PasteMeta, 'filename' | 'contentType' | 'sizeBytes' | 'kind'> = {
    id,
    createdAt: now.toISOString()
  }

  if (contentType.includes('application/json')) {
    const body = (await req.json().catch(() => null)) as null | {
      content?: unknown
      filename?: unknown
      language?: unknown
      expiresInSeconds?: unknown
    }
    if (!body || typeof body.content !== 'string') return badRequest('`content` must be a string')

    const encoder = new TextEncoder()
    const bytes = encoder.encode(body.content)
    if (bytes.byteLength > maxBytes) return badRequest('Payload too large')

    const expiresSeconds = parseExpiresSeconds(body.expiresInSeconds, env)
    const expiresAt = expiresSeconds ? new Date(Date.now() + expiresSeconds * 1000).toISOString() : undefined

    const meta: PasteMeta = {
      ...baseMeta,
      kind: 'text',
      filename: safeFilename(typeof body.filename === 'string' ? body.filename : 'snippet.txt'),
      contentType: 'text/plain; charset=utf-8',
      language: typeof body.language === 'string' ? body.language : undefined,
      sizeBytes: bytes.byteLength,
      expiresAt
    }

    await env.R2.put(dataKey(id), bytes, {
      httpMetadata: { contentType: meta.contentType }
    })
    await putMeta(env.R2, meta)

    return json({ id, url: new URL(`/p/${id}`, req.url).toString(), expiresAt })
  }

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return badRequest('`file` field is required')

    const arrayBuffer = await file.arrayBuffer()
    if (arrayBuffer.byteLength > maxBytes) return badRequest('Payload too large')

    const expiresSeconds = parseExpiresSeconds(form.get('expiresInSeconds'), env)
    const expiresAt = expiresSeconds ? new Date(Date.now() + expiresSeconds * 1000).toISOString() : undefined
    const language = typeof form.get('language') === 'string' ? (form.get('language') as string) : undefined
    const filenameOverride = typeof form.get('filename') === 'string' ? (form.get('filename') as string) : undefined

    const meta: PasteMeta = {
      ...baseMeta,
      kind: 'file',
      filename: safeFilename(filenameOverride ?? file.name),
      contentType: file.type || 'application/octet-stream',
      language,
      sizeBytes: arrayBuffer.byteLength,
      expiresAt
    }

    await env.R2.put(dataKey(id), arrayBuffer, {
      httpMetadata: { contentType: meta.contentType }
    })
    await putMeta(env.R2, meta)
    return json({ id, url: new URL(`/p/${id}`, req.url).toString(), expiresAt })
  }

  return badRequest('Unsupported content-type')
}

async function handleGetMeta(req: Request, env: Env, id: string) {
  const meta = await getMeta(env.R2, id)
  if (!meta) return notFound()
  if (isExpired(meta)) {
    await deletePaste(env.R2, id)
    return gone()
  }
  return json(meta)
}

async function handleGetRaw(env: Env, id: string, download: boolean) {
  const meta = await getMeta(env.R2, id)
  if (!meta) return notFound()
  if (isExpired(meta)) {
    await deletePaste(env.R2, id)
    return gone()
  }

  const obj = await env.R2.get(dataKey(id))
  if (!obj) return notFound()

  const headers = new Headers()
  headers.set('content-type', meta.contentType)
  headers.set('cache-control', 'no-store')
  headers.set('x-content-type-options', 'nosniff')
  if (download) {
    headers.set('content-disposition', `attachment; filename="${meta.filename.replace(/"/g, '')}"`)
  }

  return new Response(obj.body, { headers })
}

async function handleSpaEntry(req: Request, env: Env) {
  // Serve SPA for dynamic routes like /p/:id
  const url = new URL(req.url)
  url.pathname = '/index.html'
  return env.ASSETS.fetch(new Request(url, req))
}

function withSecurityHeaders(res: Response) {
  const headers = new Headers(res.headers)
  headers.set('x-content-type-options', 'nosniff')
  headers.set('referrer-policy', 'no-referrer')
  headers.set('x-frame-options', 'DENY')
  headers.set(
    'content-security-policy',
    [
      "default-src 'self'",
      "img-src 'self' data:",
      "style-src 'self' https://cdnjs.cloudflare.com",
      "script-src 'self' https://cdnjs.cloudflare.com",
      "connect-src 'self'",
      "base-uri 'none'",
      "frame-ancestors 'none'"
    ].join('; ')
  )
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}

export default {
  async fetch(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)

    if (url.pathname === '/api/health') return json({ ok: true })

    if (url.pathname === '/api/paste' && req.method === 'POST') {
      return handleCreatePaste(req, env)
    }

    const metaMatch = url.pathname.match(/^\/api\/paste\/([a-zA-Z0-9_-]{6,32})\/meta$/)
    if (metaMatch && req.method === 'GET') {
      return handleGetMeta(req, env, metaMatch[1]!)
    }

    const rawMatch = url.pathname.match(/^\/api\/paste\/([a-zA-Z0-9_-]{6,32})\/(raw|download)$/)
    if (rawMatch && req.method === 'GET') {
      return handleGetRaw(env, rawMatch[1]!, rawMatch[2] === 'download')
    }

    // SPA routes
    if (url.pathname === '/' || url.pathname.startsWith('/p/')) {
      const res = await handleSpaEntry(req, env)
      return withSecurityHeaders(res)
    }

    // Static assets
    const res = await env.ASSETS.fetch(req)
    // If asset not found, avoid leaking internal errors; keep 404.
    if (res.status === 404) return res
    return withSecurityHeaders(res)
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    // Best-effort cleanup: list a limited number of meta entries and delete expired ones.
    // Keeps cost bounded; expiry enforcement is also done lazily on access.
    let cursor: string | undefined
    let checked = 0
    const limit = 200

    while (checked < limit) {
      const listing = await listMetaKeys(env.R2, cursor)
      for (const obj of listing.objects) {
        checked += 1
        const id = obj.key.replace(/^meta\//, '').replace(/\.json$/, '')
        const meta = await getMeta(env.R2, id)
        if (meta && isExpired(meta)) {
          await deletePaste(env.R2, id)
        }
        if (checked >= limit) break
      }
      if (!listing.truncated) break
      cursor = listing.cursor
    }
  }
}
