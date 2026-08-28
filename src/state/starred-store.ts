import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { starredListSchema, type StarredEntry } from '../schemas.js'

const DATA_DIR = path.resolve(process.cwd(), 'data')
const STARRED_PATH = path.join(DATA_DIR, 'starred.json')

let cache: StarredEntry[] | null = null

async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
}

export async function loadStarred(): Promise<StarredEntry[]> {
  if (cache) return cache
  await ensureDataDir()
  try {
    const raw = await readFile(STARRED_PATH, 'utf8')
    cache = starredListSchema.parse(JSON.parse(raw))
  } catch {
    cache = []
    await writeFile(STARRED_PATH, JSON.stringify(cache, null, 2), 'utf8')
  }
  return cache
}

export async function saveStarred(input: unknown): Promise<StarredEntry[]> {
  const parsed = starredListSchema.parse(input)
  await ensureDataDir()
  await writeFile(STARRED_PATH, JSON.stringify(parsed, null, 2), 'utf8')
  cache = parsed
  return cache
}
