import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  bannerConfigSchema,
  defaultConfig,
  focusForBannerUrl,
  type BannerConfig,
} from '../schemas.js'

const DATA_DIR = path.resolve(process.cwd(), 'data')
const CONFIG_PATH = path.join(DATA_DIR, 'config.json')

let cache: BannerConfig | null = null

async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
}

export async function loadConfig(): Promise<BannerConfig> {
  if (cache) return cache
  await ensureDataDir()
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8')
    const stored = JSON.parse(raw) as Record<string, unknown>
    // Merge so newly added schema fields get defaults without wiping user data
    cache = bannerConfigSchema.parse({
      ...defaultConfig,
      ...stored,
      texts: stored.texts ?? defaultConfig.texts,
      bannerFocusByUrl:
        stored.bannerFocusByUrl && typeof stored.bannerFocusByUrl === 'object'
          ? stored.bannerFocusByUrl
          : defaultConfig.bannerFocusByUrl,
    })
  } catch {
    cache = structuredClone(defaultConfig)
    await writeFile(CONFIG_PATH, JSON.stringify(cache, null, 2), 'utf8')
  }
  return cache
}

/** Drop in-memory cache (e.g. after schema upgrades in dev). */
export function clearConfigCache(): void {
  cache = null
}

function stampFocusForUrl(config: BannerConfig): BannerConfig {
  const url = config.bannerUrl.trim()
  if (!url) return config
  return {
    ...config,
    bannerFocusByUrl: {
      ...config.bannerFocusByUrl,
      [url]: {
        bannerFocusY: config.bannerFocusY,
        endCapFocusY: config.endCapFocusY,
        dividerFocusY: config.dividerFocusY,
      },
    },
  }
}

export async function saveConfig(input: unknown): Promise<BannerConfig> {
  const current = await loadConfig()
  const patch = input && typeof input === 'object' ? (input as Record<string, unknown>) : null
  const merged = patch ? { ...current, ...patch } : input

  let parsed = bannerConfigSchema.parse(merged)

  const nextUrl = typeof patch?.bannerUrl === 'string' ? patch.bannerUrl.trim() : null
  const urlChanged = nextUrl != null && nextUrl !== current.bannerUrl

  if (urlChanged) {
    // Switching banners: restore that URL's saved shifts (or defaults)
    const focus = focusForBannerUrl(parsed, nextUrl)
    parsed = { ...parsed, ...focus }
  } else {
    // Same banner (or no URL in patch): persist current shifts for the active URL
    parsed = stampFocusForUrl(parsed)
  }

  await ensureDataDir()
  await writeFile(CONFIG_PATH, JSON.stringify(parsed, null, 2), 'utf8')
  cache = parsed
  return cache
}

export async function updateBannerUrl(url: string): Promise<BannerConfig> {
  const current = await loadConfig()
  // Ensure the outgoing banner's focus is stamped before switching
  const stamped = stampFocusForUrl(current)
  cache = stamped
  return saveConfig({ bannerUrl: url })
}
