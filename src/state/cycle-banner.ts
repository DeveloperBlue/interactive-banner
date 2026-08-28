import type { StarredEntry } from '../schemas.js'
import { loadConfig, updateBannerUrl } from './config-store.js'
import { loadStarred } from './starred-store.js'

export function picsumIdFromUrl(url: string): number | null {
  const m = String(url).match(/picsum\.photos\/(?:id\/)?(\d+)/i)
  return m ? Number(m[1]) : null
}

export function starredEntryUrl(entry: StarredEntry): string {
  if (entry.id != null) return `https://picsum.photos/id/${entry.id}/1200/400`
  return entry.url
}

function bannersPath(url: string): string | null {
  try {
    const { pathname } = new URL(url)
    const idx = pathname.toLowerCase().indexOf('/banners/')
    if (idx < 0) return null
    return decodeURIComponent(pathname.slice(idx).toLowerCase())
  } catch {
    return null
  }
}

export function starredIndexForUrl(list: StarredEntry[], currentUrl: string): number {
  const curId = picsumIdFromUrl(currentUrl)
  const curBanners = bannersPath(currentUrl)
  return list.findIndex((entry) => {
    if (curId != null && entry.id === curId) return true
    const src = starredEntryUrl(entry)
    if (src === currentUrl) return true
    if (curBanners && bannersPath(src) === curBanners) return true
    return false
  })
}

/** Step the active banner through the starred list. Returns the new URL, or null if none. */
export async function cycleStarredBanner(delta: 1 | -1): Promise<string | null> {
  const list = await loadStarred()
  if (!list.length) return null
  const config = await loadConfig()
  let idx = starredIndexForUrl(list, config.bannerUrl)
  if (idx < 0) idx = delta > 0 ? -1 : 0
  const next = (idx + delta + list.length) % list.length
  const url = starredEntryUrl(list[next])
  await updateBannerUrl(url)
  return url
}
