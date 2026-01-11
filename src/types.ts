export type PasteKind = 'text' | 'file'

export type PasteMeta = {
  id: string
  kind: PasteKind
  filename: string
  contentType: string
  language?: string
  sizeBytes: number
  createdAt: string
  expiresAt?: string
}

export type Env = {
  R2: R2Bucket
  ASSETS: Fetcher
  MAX_UPLOAD_BYTES: string
  DEFAULT_EXPIRES_SECONDS: string
  MAX_EXPIRES_SECONDS: string
  // Optional: when set, Cloudflare Turnstile verification is enforced on writes.
  TURNSTILE_SECRET?: string
}
