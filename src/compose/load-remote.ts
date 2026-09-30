import { loadImage, type Image } from '@napi-rs/canvas'

const MAX_BYTES = 8 * 1024 * 1024

function isGithubHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return (
    host === 'github.com' ||
    host.endsWith('.github.com') ||
    host === 'githubusercontent.com' ||
    host.endsWith('.githubusercontent.com')
  )
}

function bodyPreview(buf: Buffer): string {
  const head = buf.subarray(0, 160)
  const text = head.every((b) => b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127))
  if (text && head.length > 0) return head.toString('utf8').replace(/\s+/g, ' ').trim()
  return `magic=${head.subarray(0, 8).toString('hex') || 'empty'}`
}

export async function loadRemoteImage(url: string): Promise<Image | null> {
  if (!url.trim()) return null
  let github = false
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Only http(s) image URLs are allowed')
    }
    github = isGithubHost(parsed.hostname)

    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'image/*,*/*;q=0.8' },
      redirect: 'follow',
    })
    const type = res.headers.get('content-type') ?? ''
    const buf = Buffer.from(await res.arrayBuffer())
    const detail = `status=${res.status} type=${type || 'none'} bytes=${buf.byteLength} final=${res.url}`

    if (!res.ok) throw new Error(`HTTP ${res.status} ${detail} ${bodyPreview(buf)}`)
    const len = Number(res.headers.get('content-length') ?? 0)
    if (len > MAX_BYTES || buf.byteLength > MAX_BYTES) throw new Error(`Image too large ${detail}`)
    if (buf.byteLength === 0) throw new Error(`Empty body ${detail}`)

    const image = await loadImage(buf)
    if (github) {
      console.info(`[image] loaded ${url} ${detail} decoded=${image.width}x${image.height}`)
    }
    return image
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[image] failed to load ${url}: ${message}`)
    return null
  }
}
