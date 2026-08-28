import { loadImage, type Image } from '@napi-rs/canvas'

const MAX_BYTES = 8 * 1024 * 1024

export async function loadRemoteImage(url: string): Promise<Image | null> {
  if (!url.trim()) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Only http(s) image URLs are allowed')
    }

    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'image/*,*/*;q=0.8' },
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const len = Number(res.headers.get('content-length') ?? 0)
    if (len > MAX_BYTES) throw new Error('Image too large')
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength > MAX_BYTES) throw new Error('Image too large')
    return await loadImage(buf)
  } catch (err) {
    console.warn(`[image] failed to load ${url}:`, err instanceof Error ? err.message : err)
    return null
  }
}
