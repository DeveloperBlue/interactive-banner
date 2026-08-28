import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'

const BANNERS_DIR = path.resolve(process.cwd(), 'banners')
const MAX_BYTES = 8 * 1024 * 1024
const LIST_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif'])
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function fileUrl(name: string): string {
  return `/banners/${encodeURIComponent(name).replace(/%2F/gi, '/')}`
}

function sniffPngOrJpeg(buf: Buffer): 'png' | 'jpeg' | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIG)) return 'png'
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg'
  return null
}

function safeBasename(original: string): string {
  const base = path
    .basename(original || 'banner')
    .replace(path.extname(original || ''), '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 80)
  return base || 'banner'
}

function savedName(original: string, kind: 'png' | 'jpeg'): string {
  const origExt = path.extname(original).toLowerCase()
  const ext = kind === 'png' ? '.png' : origExt === '.jpeg' ? '.jpeg' : '.jpg'
  return `${safeBasename(original)}${ext}`
}

function resolveBannerFile(name: string): string | null {
  const base = path.basename(String(name || ''))
  if (!base || base.startsWith('.')) return null
  if (!LIST_EXT.has(path.extname(base).toLowerCase())) return null
  const dir = path.resolve(BANNERS_DIR)
  const full = path.resolve(dir, base)
  const prefix = dir.endsWith(path.sep) ? dir : dir + path.sep
  if (!full.startsWith(prefix)) return null
  return full
}

export async function localBannerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(multipart, {
    limits: { fileSize: MAX_BYTES, files: 1, fields: 0 },
  })

  app.get('/api/local-banners', async (_req, reply) => {
    try {
      const names = await readdir(BANNERS_DIR)
      const files = names
        .filter((name) => {
          if (name.startsWith('.')) return false
          return LIST_EXT.has(path.extname(name).toLowerCase())
        })
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
        .map((name) => ({
          name,
          url: fileUrl(name),
        }))
      return { files }
    } catch {
      return reply.status(200).send({ files: [] })
    }
  })

  app.post('/api/local-banners', async (req, reply) => {
    let file
    try {
      file = await req.file()
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : ''
      if (code === 'FST_REQ_FILE_TOO_LARGE' || code === 'FST_PARTS_LIMIT') {
        return reply.status(413).send({ error: 'File too large (max 8MB)' })
      }
      throw err
    }
    if (!file) {
      return reply.status(400).send({ error: 'Expected a file field named file' })
    }

    let buf: Buffer
    try {
      buf = await file.toBuffer()
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : ''
      if (code === 'FST_REQ_FILE_TOO_LARGE') {
        return reply.status(413).send({ error: 'File too large (max 8MB)' })
      }
      throw err
    }
    if (!buf.byteLength) {
      return reply.status(400).send({ error: 'Empty file' })
    }
    if (buf.byteLength > MAX_BYTES) {
      return reply.status(413).send({ error: 'File too large (max 8MB)' })
    }

    const kind = sniffPngOrJpeg(buf)
    if (!kind) {
      return reply.status(400).send({ error: 'Only PNG and JPEG are allowed' })
    }

    const name = savedName(file.filename, kind)
    await mkdir(BANNERS_DIR, { recursive: true })
    await writeFile(path.join(BANNERS_DIR, name), buf)

    return reply.status(201).send({ name, url: fileUrl(name) })
  })

  app.delete('/api/local-banners/:name', async (req, reply) => {
    const name = String((req.params as { name?: string }).name ?? '')
    const full = resolveBannerFile(name)
    if (!full) {
      return reply.status(400).send({ error: 'Invalid file name' })
    }
    try {
      await unlink(full)
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : ''
      if (code === 'ENOENT') {
        return reply.status(404).send({ error: 'File not found' })
      }
      throw err
    }
    return { ok: true, name: path.basename(full) }
  })
}
