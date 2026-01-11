import type { PasteMeta } from './types'

const META_PREFIX = 'meta/'
const DATA_PREFIX = 'data/'

export function metaKey(id: string) {
  return `${META_PREFIX}${id}.json`
}

export function dataKey(id: string) {
  return `${DATA_PREFIX}${id}`
}

export async function putMeta(bucket: R2Bucket, meta: PasteMeta) {
  await bucket.put(metaKey(meta.id), JSON.stringify(meta), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' }
  })
}

export async function getMeta(bucket: R2Bucket, id: string): Promise<PasteMeta | null> {
  const obj = await bucket.get(metaKey(id))
  if (!obj) return null
  const text = await obj.text()
  return JSON.parse(text) as PasteMeta
}

export async function deletePaste(bucket: R2Bucket, id: string) {
  await Promise.all([bucket.delete(metaKey(id)), bucket.delete(dataKey(id))])
}

export async function listMetaKeys(bucket: R2Bucket, cursor?: string) {
  return bucket.list({ prefix: META_PREFIX, cursor })
}

