import { mkdir, access, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { GlobalFonts } from '@napi-rs/canvas'

const FONTS_DIR = path.resolve(process.cwd(), 'fonts')
const CACHE_DIR = path.resolve(process.cwd(), 'cache', 'fonts')

const registered = new Set<string>()

function weightKey(weight: number | string): string {
  const n = Number(weight)
  return Number.isFinite(n) ? String(Math.round(n)) : '400'
}

function cacheFileName(family: string, weight: number | string): string {
  const safe = family.replace(/[^a-zA-Z0-9_-]+/g, '_')
  return `${safe}-${weightKey(weight)}.ttf`
}

function fontsourceSlug(family: string): string {
  return family.toLowerCase().replace(/\s+/g, '-')
}

/** Family name only — never a URL. Blocks path/host injection into fetch builders. */
function normalizeFamily(family: string): string {
  const name = family.trim()
  if (!name || name.length > 80) {
    throw new Error('Invalid font family name')
  }
  if (/[/\\:]/.test(name) || /^https?:/i.test(name)) {
    throw new Error('Font family must be a name (e.g. Caveat), not a URL')
  }
  return name
}

export async function registerBundledFonts(): Promise<void> {
  const bundled = [
    { file: 'Inter-Variable.ttf', alias: 'Inter' },
    { file: 'Inter-Regular.otf', alias: 'Inter' },
    { file: 'Inter-Regular.ttf', alias: 'Inter' },
  ]
  for (const { file, alias } of bundled) {
    const full = path.join(FONTS_DIR, file)
    try {
      await access(full)
      GlobalFonts.registerFromPath(full, alias)
      registered.add(`${alias}:400`)
      registered.add(`${alias}:700`)
      registered.add(alias)
    } catch {
      // optional file missing
    }
  }
}

function assertAllowedFontHost(url: string): void {
  const host = new URL(url).hostname.toLowerCase()
  const ok =
    host === 'fonts.gstatic.com' ||
    host === 'fonts.googleapis.com' ||
    host === 'cdn.jsdelivr.net'
  if (!ok) throw new Error(`Refusing font host: ${host}`)
}

async function downloadFromGoogleCss(family: string, weight: number | string): Promise<Buffer | null> {
  const cssUrl = new URL('https://fonts.googleapis.com/css2')
  cssUrl.searchParams.set('family', `${family}:wght@${weightKey(weight)}`)

  // curl UA still receives TTF links from the CSS API
  const cssRes = await fetch(cssUrl, {
    headers: { 'User-Agent': 'curl/7.68.0' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!cssRes.ok) return null
  const css = await cssRes.text()

  const urls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1]!)
  const ttfUrl = urls.find((u) => u.includes('.ttf')) ?? urls.find((u) => !u.includes('.woff'))
  if (!ttfUrl || ttfUrl.includes('.woff')) return null

  assertAllowedFontHost(ttfUrl)
  const bin = await fetch(ttfUrl, { signal: AbortSignal.timeout(30_000) })
  if (!bin.ok) return null
  return Buffer.from(await bin.arrayBuffer())
}

async function downloadFromFontsource(family: string, weight: number | string): Promise<Buffer | null> {
  const slug = fontsourceSlug(family)
  const w = weightKey(weight)
  const url = `https://cdn.jsdelivr.net/fontsource/fonts/${encodeURIComponent(slug)}@latest/latin-${w}-normal.ttf`
  assertAllowedFontHost(url)
  const bin = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!bin.ok) return null
  return Buffer.from(await bin.arrayBuffer())
}

async function downloadFontFile(family: string, weight: number | string): Promise<string> {
  await mkdir(CACHE_DIR, { recursive: true })
  const outPath = path.join(CACHE_DIR, cacheFileName(family, weight))
  try {
    await access(outPath)
    return outPath
  } catch {
    // need download
  }

  const buf =
    (await downloadFromGoogleCss(family, weight).catch(() => null)) ??
    (await downloadFromFontsource(family, weight).catch(() => null))

  if (!buf) {
    throw new Error(`Could not download TTF for "${family}" weight ${weight}`)
  }

  await writeFile(outPath, buf)
  return outPath
}

export async function ensureFont(family: string, weight: number | string = 400): Promise<void> {
  const name = normalizeFamily(family)
  const key = `${name}:${weightKey(weight)}`
  if (registered.has(key)) return

  // Bundled Inter covers common weights via variable font
  if (name === 'Inter' && registered.has('Inter')) {
    registered.add(key)
    return
  }

  const filePath = await downloadFontFile(name, weight)
  const registeredKey = GlobalFonts.registerFromPath(filePath, name)
  if (!registeredKey && !GlobalFonts.has(name)) {
    console.warn(`[fonts] registerFromPath returned null for ${name}`)
  }
  registered.add(key)
  registered.add(name)
}

export async function ensureFontsForConfig(
  families: Array<{ family: string; weight: number | string }>,
): Promise<void> {
  for (const { family, weight } of families) {
    try {
      await ensureFont(family, weight)
    } catch (err) {
      console.warn(`[fonts] ${err instanceof Error ? err.message : err}`)
    }
  }
}
