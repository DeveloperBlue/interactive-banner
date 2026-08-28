const API = '/editor/api'

const form = document.getElementById('form')
const textsEl = document.getElementById('texts')
const preview = document.getElementById('preview')
const previewEndcap = document.getElementById('preview-endcap')
const previewDivider = document.getElementById('preview-divider')
const status = document.getElementById('status')
const snippet = document.getElementById('snippet')

const NUMBER_FIELDS = [
  'width',
  'height',
  'canvasRadius',
  'endCapHeight',
  'dividerHeight',
  'bannerHeight',
  'bannerFocusY',
  'endCapFocusY',
  'dividerFocusY',
  'bannerGap',
  'bannerRadius',
  'blur',
  'featherTop',
  'featherRight',
  'featherBottom',
  'featherLeft',
  'shatterSeed',
  'shatterPieces',
  'avatarPadding',
  'avatarY',
  'avatarDiameter',
  'avatarOutline',
  'avatarBackdropBlur',
]

const DEFAULT_FOCUS_Y = 50

/** @type {'light' | 'dark'} */
let previewTheme = 'dark'

function setStatus(msg) {
  status.textContent = msg
}

function pictureSnippet(origin) {
  const profileEl = form.elements.namedItem('profileUrl')
  const profile =
    (profileEl && 'value' in profileEl && String(profileEl.value).trim()) || 'https://github.com/you'
  const cb = encodeURIComponent(profile)
  return `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="${origin}/banner-dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="${origin}/banner-light.png" />
  <img src="${origin}/banner-light.png" alt="banner" />
</picture>
<p>
  <a href="${origin}/prev-banner?callback=${cb}">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="${origin}/nav-back-dark.png" />
      <img src="${origin}/nav-back-light.png" alt="Previous banner" width="36" height="36" />
    </picture>
  </a>
  <a href="${origin}/next-banner?callback=${cb}">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="${origin}/nav-forward-dark.png" />
      <img src="${origin}/nav-forward-light.png" alt="Next banner" width="36" height="36" />
    </picture>
  </a>
</p>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="${origin}/divider-dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="${origin}/divider-light.png" />
  <img src="${origin}/divider-light.png" alt="" />
</picture>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="${origin}/endcap-dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="${origin}/endcap-light.png" />
  <img src="${origin}/endcap-light.png" alt="" />
</picture>`
}

function setPreviewTheme(theme) {
  previewTheme = theme
  document.documentElement.setAttribute('data-theme', theme)
  for (const btn of document.querySelectorAll('.theme-toggle button')) {
    btn.classList.toggle('active', btn.getAttribute('data-theme') === theme)
  }
  refreshPreview()
}

function refreshPreview() {
  const bust = Date.now()
  preview.src = `/banner.png?theme=${previewTheme}&t=${bust}`
  if (previewDivider) {
    previewDivider.src = `/divider.png?theme=${previewTheme}&t=${bust}`
  }
  if (previewEndcap) {
    previewEndcap.src = `/endcap.png?theme=${previewTheme}&t=${bust}`
  }
  const back = document.getElementById('nav-back-preview')
  const fwd = document.getElementById('nav-forward-preview')
  if (back) back.src = `/nav-back.png?theme=${previewTheme}&t=${bust}`
  if (fwd) fwd.src = `/nav-forward.png?theme=${previewTheme}&t=${bust}`
  snippet.textContent = pictureSnippet(window.location.origin)
}

function textRowTemplate(item = {}, { open = true } = {}) {
  const row = document.createElement('details')
  row.className = 'fold text-row'
  if (open) row.open = true

  const label = item.content?.trim() || ''
  row.innerHTML = `
    <summary><span class="text-summary-label"${label ? '' : ' data-empty="1"'}>${escapeHtml(label)}</span></summary>
    <div class="fold-body">
      <label class="full">Content <input data-k="content" type="text" /></label>
      <label>Align
        <select data-k="align">
          <option value="left">left</option>
          <option value="center">center</option>
          <option value="right">right</option>
        </select>
      </label>
      <label>X <input data-k="x" type="number" /></label>
      <label>Y <input data-k="y" type="number" /></label>
      <label>Font <input data-k="fontFamily" type="text" /></label>
      <label>Weight <input data-k="fontWeight" type="text" /></label>
      <label>Size <input data-k="fontSize" type="number" min="1" /></label>
      <label>Color <input data-k="color" type="text" /></label>
      <div class="row-actions"><button type="button" data-remove>Remove</button></div>
    </div>
  `

  for (const el of row.querySelectorAll('[data-k]')) {
    const k = el.getAttribute('data-k')
    if (item[k] != null) el.value = item[k]
  }

  const summaryLabel = row.querySelector('.text-summary-label')
  const contentInput = row.querySelector('[data-k="content"]')
  const syncSummary = () => {
    const text = contentInput.value.trim()
    summaryLabel.textContent = text
    summaryLabel.dataset.empty = text ? '0' : '1'
  }
  contentInput.addEventListener('input', syncSummary)

  row.querySelector('[data-remove]').addEventListener('click', (e) => {
    e.preventDefault()
    row.remove()
  })
  return row
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function readTexts() {
  return [...textsEl.querySelectorAll('.text-row')].map((row) => {
    const get = (k) => row.querySelector(`[data-k="${k}"]`).value
    const weightRaw = get('fontWeight')
    const fontWeight = /^\d+$/.test(weightRaw) ? Number(weightRaw) : weightRaw
    return {
      content: get('content'),
      align: get('align'),
      x: Number(get('x')),
      y: Number(get('y')),
      fontFamily: get('fontFamily') || 'Inter',
      fontWeight,
      fontSize: Number(get('fontSize')),
      color: get('color') || '#ffffff',
    }
  })
}

function fillForm(config) {
  for (const name of [
    ...NUMBER_FIELDS,
    'bannerUrl',
    'avatarUrl',
    'avatarPosition',
    'avatarOutlineColor',
    'bottomEdgeStyle',
    'profileUrl',
  ]) {
    const el = form.elements.namedItem(name)
    if (!el || !('value' in el)) continue
    const value = config[name]
    // Keep existing input if the server omitted a new field
    if (value === undefined || value === null) continue
    el.value = value
  }
  const flipEl = form.elements.namedItem('endCapFlipVertical')
  if (flipEl && 'checked' in flipEl && config.endCapFlipVertical != null) {
    flipEl.checked = Boolean(config.endCapFlipVertical)
  }
  textsEl.replaceChildren()
  for (const t of config.texts ?? []) {
    textsEl.appendChild(textRowTemplate(t))
  }
  if (!(config.texts ?? []).length) {
    textsEl.appendChild(textRowTemplate())
  }
  syncCurrentBannerUrl()
}

function readForm() {
  const data = {}
  for (const name of NUMBER_FIELDS) {
    data[name] = Number(form.elements.namedItem(name).value)
  }
  data.bannerUrl = form.elements.namedItem('bannerUrl').value.trim()
  data.avatarUrl = form.elements.namedItem('avatarUrl').value.trim()
  data.profileUrl = form.elements.namedItem('profileUrl').value.trim()
  data.avatarPosition = form.elements.namedItem('avatarPosition').value
  data.avatarOutlineColor = form.elements.namedItem('avatarOutlineColor').value.trim() || '#d1d9e0'
  data.bottomEdgeStyle = form.elements.namedItem('bottomEdgeStyle').value
  const flipEl = form.elements.namedItem('endCapFlipVertical')
  data.endCapFlipVertical = Boolean(flipEl && 'checked' in flipEl && flipEl.checked)
  data.texts = readTexts()
  return data
}

async function load() {
  setStatus('Loading…')
  const res = await fetch(`${API}/config`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to load config')
  const config = await res.json()
  fillForm(config)
  setPreviewTheme(previewTheme)
  setStatus('')
}

async function saveForm({ refill = true } = {}) {
  const res = await fetch(`${API}/config`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(readForm()),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || res.statusText)
  }
  const saved = await res.json()
  if (refill) fillForm(saved)
  refreshPreview()
  return saved
}

let saveTimer = null
function scheduleSave({ refill = false } = {}) {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    try {
      await saveForm({ refill })
    } catch (err) {
      setStatus(err.message || 'Save failed')
    }
  }, 160)
}

function nudgeFocusY(field, delta, label) {
  const el = form.elements.namedItem(field)
  if (!el || !('value' in el)) return
  const current = Number(el.value)
  const base = Number.isFinite(current) ? current : DEFAULT_FOCUS_Y
  const next = Math.max(0, Math.min(100, Math.round(base + delta)))
  if (next === base) return
  el.value = String(next)
  setStatus(`${label} Y ${next}%`)
  scheduleSave({ refill: false })
}

function resetFocusShifts() {
  const main = form.elements.namedItem('bannerFocusY')
  const endcap = form.elements.namedItem('endCapFocusY')
  const divider = form.elements.namedItem('dividerFocusY')
  if (main && 'value' in main) main.value = String(DEFAULT_FOCUS_Y)
  if (endcap && 'value' in endcap) endcap.value = String(DEFAULT_FOCUS_Y)
  if (divider && 'value' in divider) divider.value = String(DEFAULT_FOCUS_Y)
  setStatus('Image shifts reset to 50%')
  scheduleSave({ refill: false })
}

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  setStatus('Saving…')
  try {
    await saveForm({ refill: true })
    setStatus('Saved')
  } catch (err) {
    setStatus(err.message || 'Save failed')
  }
})

document.getElementById('add-text').addEventListener('click', () => {
  textsEl.appendChild(
    textRowTemplate(
      {
        content: '',
        align: 'left',
        x: 40,
        y: 40,
        fontFamily: 'Inter',
        fontWeight: 400,
        fontSize: 28,
        color: '#ffffff',
      },
      { open: true },
    ),
  )
})

document.getElementById('refresh').addEventListener('click', refreshPreview)

document.getElementById('theme-light').addEventListener('click', () => setPreviewTheme('light'))
document.getElementById('theme-dark').addEventListener('click', () => setPreviewTheme('dark'))

// —— Picsum picker + starred cache ——
const PICSUM_COUNT = 18
const STARRED_KEY = 'banner-generator:starred-picsum'
const picsumGrid = document.getElementById('picsum-grid')
const localGrid = document.getElementById('local-grid')
const starredGrid = document.getElementById('starred-grid')
const starredEmpty = document.getElementById('starred-empty')
const starredPrevBtn = document.getElementById('starred-prev')
const starredNextBtn = document.getElementById('starred-next')
const starredIndexEl = document.getElementById('starred-index')
const currentBannerUrlEl = document.getElementById('current-banner-url')
const starCurrentBtn = document.getElementById('star-current')

/** @type {number} */
let picsumPage = Math.floor(Math.random() * 20) + 1
/** @type {number} */
let starredCursor = -1
/** Prevent overlapping applies while cycling */
let cyclingStarred = false
/** @type {Array<{ id: number | null, url: string, author?: string }>} */
let starredList = []

function loadStarred() {
  return starredList
}

async function fetchStarred() {
  const res = await fetch(`${API}/starred`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to load starred')
  const data = await res.json()
  starredList = Array.isArray(data.entries) ? data.entries : []
}

async function persistStarred(list) {
  const res = await fetch(`${API}/starred`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries: list }),
  })
  if (!res.ok) throw new Error('Failed to save starred')
  const data = await res.json().catch(() => ({}))
  starredList = Array.isArray(data.entries) ? data.entries : list
}

async function migrateLocalStarred() {
  if (starredList.length > 0) {
    localStorage.removeItem(STARRED_KEY)
    return
  }
  try {
    const raw = localStorage.getItem(STARRED_KEY)
    const list = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list) || !list.length) return
    await persistStarred(list)
    localStorage.removeItem(STARRED_KEY)
  } catch {
    // keep going with server list
  }
}

function bannerUrlForId(id) {
  return `https://picsum.photos/id/${id}/1200/400`
}

function thumbUrlForId(id) {
  return `https://picsum.photos/id/${id}/480/160`
}

function parsePicsumId(url) {
  const m = String(url).match(/picsum\.photos\/(?:id\/)?(\d+)/i)
  return m ? Number(m[1]) : null
}

function entryKey(entry) {
  if (entry.id != null) return `id:${entry.id}`
  return `url:${entry.url}`
}

function getCurrentBannerUrl() {
  const el = form.elements.namedItem('bannerUrl')
  return el && 'value' in el ? String(el.value).trim() : ''
}

function findStarredIndex(list, entry) {
  const key = entryKey(entry)
  return list.findIndex((item) => entryKey(item) === key)
}

function entryFromUrl(url) {
  const id = parsePicsumId(url)
  if (id != null) return { id, url: bannerUrlForId(id), author: '' }
  return { id: null, url, author: '' }
}

function isStarredEntry(entry) {
  return findStarredIndex(loadStarred(), entry) >= 0
}

function syncCurrentBannerUrl() {
  const url = getCurrentBannerUrl()
  currentBannerUrlEl.textContent = url
  const entry = url ? entryFromUrl(url) : null
  const starred = entry ? isStarredEntry(entry) : false
  starCurrentBtn.disabled = !url
  starCurrentBtn.textContent = starred ? '★ Starred' : '☆ Star'
  starCurrentBtn.setAttribute('aria-pressed', starred ? 'true' : 'false')
  syncStarredNav()
}

function syncStarredNav() {
  const list = loadStarred()
  const url = getCurrentBannerUrl()
  if (url) {
    const idx = findStarredIndex(list, entryFromUrl(url))
    if (idx >= 0) starredCursor = idx
  }

  const has = list.length > 0
  starredPrevBtn.disabled = !has
  starredNextBtn.disabled = !has
  if (!has) {
    starredIndexEl.textContent = ''
    starredCursor = -1
  } else {
    if (starredCursor < 0 || starredCursor >= list.length) starredCursor = 0
    starredIndexEl.textContent = `${starredCursor + 1} / ${list.length}`
  }

  for (const card of starredGrid.querySelectorAll('.thumb-card')) {
    const i = Number(card.dataset.index)
    card.classList.toggle('is-active', i === starredCursor)
  }
}

async function cycleStarred(delta) {
  const list = loadStarred()
  if (!list.length || cyclingStarred) return

  let next = starredCursor
  const url = getCurrentBannerUrl()
  if (url) {
    const currentIdx = findStarredIndex(list, entryFromUrl(url))
    if (currentIdx >= 0) next = currentIdx
  }
  if (next < 0) next = 0
  else next = (next + delta + list.length) % list.length

  starredCursor = next
  syncStarredNav()
  cyclingStarred = true
  try {
    await applyBannerUrl(resolveBannerSrc(list[next]))
  } finally {
    cyclingStarred = false
    syncStarredNav()
  }
}

function isTypingTarget(el) {
  if (!el || !(el instanceof Element)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return el.isContentEditable
}

function syncPicsumStarButtons() {
  for (const btn of document.querySelectorAll('.thumb-star')) {
    let entry
    if (btn.dataset.id) {
      const id = Number(btn.dataset.id)
      entry = { id, url: bannerUrlForId(id) }
    } else if (btn.dataset.url) {
      entry = entryFromUrl(btn.dataset.url)
    } else continue
    const on = isStarredEntry(entry)
    btn.setAttribute('aria-pressed', on ? 'true' : 'false')
    btn.textContent = on ? '★' : '☆'
  }
}

async function applyBannerUrl(url) {
  clearTimeout(saveTimer)
  setStatus('Applying banner…')
  try {
    // Persist current shifts under the outgoing URL before switching
    await saveForm({ refill: false })
    const el = form.elements.namedItem('bannerUrl')
    if (el && 'value' in el) el.value = url
    syncCurrentBannerUrl()
    await saveForm({ refill: true })
    syncCurrentBannerUrl()
    setStatus('Banner updated')
  } catch (err) {
    setStatus(err.message || 'Failed to apply banner')
  }
}

async function toggleStar(entry) {
  const list = [...loadStarred()]
  const idx = findStarredIndex(list, entry)
  if (idx >= 0) list.splice(idx, 1)
  else {
    const normalized =
      entry.id != null
        ? { id: entry.id, url: bannerUrlForId(entry.id), author: entry.author || '' }
        : { id: null, url: entry.url, author: entry.author || '' }
    list.unshift(normalized)
  }
  try {
    await persistStarred(list)
  } catch (err) {
    setStatus(err.message || 'Failed to save starred')
    return
  }
  renderStarred()
  syncPicsumStarButtons()
  syncCurrentBannerUrl()
}

function resolveThumbSrc(entry) {
  if (entry.id != null) return thumbUrlForId(entry.id)
  return entry.url
}

function resolveBannerSrc(entry) {
  if (entry.id != null) return bannerUrlForId(entry.id)
  return entry.url
}

function makeThumb(entry, { starredSection = false, localSection = false, index = -1 } = {}) {
  const wrap = document.createElement('div')
  wrap.className = 'thumb-card'
  if (starredSection && index >= 0) wrap.dataset.index = String(index)
  const label =
    entry.author ? `Photo by ${entry.author}` : entry.id != null ? `Picsum #${entry.id}` : entry.url
  wrap.title = label

  const imgBtn = document.createElement('button')
  imgBtn.type = 'button'
  imgBtn.className = 'thumb-pick'
  imgBtn.innerHTML = `<img src="${resolveThumbSrc(entry)}" alt="${escapeHtml(label)}" loading="lazy" />`
  imgBtn.addEventListener('click', () => {
    if (starredSection && index >= 0) starredCursor = index
    applyBannerUrl(resolveBannerSrc(entry))
  })
  wrap.appendChild(imgBtn)

  if (starredSection) {
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'thumb-remove'
    remove.title = 'Remove from starred'
    remove.textContent = '✕'
    remove.addEventListener('click', (e) => {
      e.stopPropagation()
      toggleStar(entry)
    })
    wrap.appendChild(remove)
  } else {
    const star = document.createElement('button')
    star.type = 'button'
    star.className = 'thumb-star'
    if (entry.id != null) star.dataset.id = String(entry.id)
    if (entry.url) star.dataset.url = entry.url
    const on = isStarredEntry(entry)
    star.setAttribute('aria-pressed', on ? 'true' : 'false')
    star.title = on ? 'Unstar' : 'Star / cache'
    star.textContent = on ? '★' : '☆'
    star.addEventListener('click', (e) => {
      e.stopPropagation()
      toggleStar(entry)
    })
    wrap.appendChild(star)
    if (localSection) {
      const del = document.createElement('button')
      del.type = 'button'
      del.className = 'thumb-remove'
      del.title = 'Delete from banners/'
      del.textContent = '✕'
      del.addEventListener('click', (e) => {
        e.stopPropagation()
        deleteLocalBanner(entry)
      })
      wrap.appendChild(del)
    }
  }

  return wrap
}

function renderStarred() {
  const list = loadStarred()
  starredGrid.replaceChildren()
  starredEmpty.hidden = list.length > 0
  for (let i = 0; i < list.length; i++) {
    starredGrid.appendChild(makeThumb(list[i], { starredSection: true, index: i }))
  }
  syncStarredNav()
}

async function loadLocalBanners() {
  localGrid.textContent = 'Loading…'
  try {
    const res = await fetch(`${API}/local-banners`, { credentials: 'include' })
    if (!res.ok) throw new Error(`Local banners ${res.status}`)
    const data = await res.json()
    const files = data.files ?? []
    localGrid.replaceChildren()
    if (!files.length) {
      localGrid.textContent = 'No images in banners/ yet'
      return
    }
    for (const file of files) {
      const url = new URL(file.url, window.location.origin).href
      localGrid.appendChild(
        makeThumb(
          {
            id: null,
            url,
            author: file.name,
          },
          { localSection: true },
        ),
      )
    }
  } catch (err) {
    localGrid.textContent = err.message || 'Failed to load local banners'
  }
}

function isPngOrJpegFile(file) {
  const type = String(file.type || '').toLowerCase()
  if (type === 'image/png' || type === 'image/jpeg') return true
  return /\.(png|jpe?g)$/i.test(file.name || '')
}

async function uploadLocalBanner(file) {
  const body = new FormData()
  body.append('file', file, file.name)
  const res = await fetch(`${API}/local-banners`, {
    method: 'POST',
    credentials: 'include',
    body,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Upload failed (${res.status})`)
  }
  return res.json()
}

async function deleteLocalBanner(entry) {
  const name = entry.author
  if (!name) return
  if (!confirm(`Delete ${name} from banners/?`)) return
  setStatus(`Deleting ${name}…`)
  try {
    const res = await fetch(`${API}/local-banners/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Delete failed (${res.status})`)
    }
    if (isStarredEntry(entry)) await toggleStar(entry)
    await loadLocalBanners()
    setStatus(`Deleted ${name}`)
  } catch (err) {
    setStatus(err.message || 'Delete failed')
  }
}

async function uploadLocalFiles(fileList) {
  const files = [...fileList].filter(isPngOrJpegFile)
  if (!files.length) {
    setStatus('Only PNG and JPEG can be uploaded')
    return
  }
  if (files.length < fileList.length) {
    setStatus('Skipped non-PNG/JPEG files')
  }
  let last = null
  for (const file of files) {
    setStatus(`Uploading ${file.name}…`)
    last = await uploadLocalBanner(file)
  }
  await loadLocalBanners()
  if (last?.url) {
    await applyBannerUrl(new URL(last.url, window.location.origin).href)
  }
  setStatus(files.length > 1 ? `Uploaded ${files.length} images` : `Uploaded ${last?.name || 'image'}`)
}

async function loadPicsum() {
  picsumGrid.textContent = 'Loading…'
  try {
    const res = await fetch(`https://picsum.photos/v2/list?page=${picsumPage}&limit=${PICSUM_COUNT}`)
    if (!res.ok) throw new Error(`Picsum ${res.status}`)
    const photos = await res.json()
    picsumGrid.replaceChildren()
    for (const photo of photos) {
      picsumGrid.appendChild(makeThumb({ id: photo.id, author: photo.author }))
    }
    if (!photos.length) picsumGrid.textContent = 'No images'
  } catch (err) {
    picsumGrid.textContent = err.message || 'Failed to load Picsum'
  }
}

document.getElementById('local-refresh').addEventListener('click', () => {
  loadLocalBanners()
})

const localUpload = document.getElementById('local-upload')
localUpload.addEventListener('change', async () => {
  const files = localUpload.files
  if (!files?.length) return
  try {
    await uploadLocalFiles(files)
  } catch (err) {
    setStatus(err.message || 'Upload failed')
  } finally {
    localUpload.value = ''
  }
})

const localDrop = document.getElementById('local-drop')
;['dragenter', 'dragover'].forEach((type) => {
  localDrop.addEventListener(type, (e) => {
    e.preventDefault()
    localDrop.classList.add('is-dragover')
  })
})
;['dragleave', 'drop'].forEach((type) => {
  localDrop.addEventListener(type, (e) => {
    e.preventDefault()
    if (type === 'dragleave' && localDrop.contains(e.relatedTarget)) return
    localDrop.classList.remove('is-dragover')
  })
})
localDrop.addEventListener('drop', async (e) => {
  const files = e.dataTransfer?.files
  if (!files?.length) return
  try {
    await uploadLocalFiles(files)
  } catch (err) {
    setStatus(err.message || 'Upload failed')
  }
})

document.getElementById('picsum-refresh').addEventListener('click', () => {
  picsumPage = Math.floor(Math.random() * 30) + 1
  loadPicsum()
})

starredPrevBtn.addEventListener('click', () => cycleStarred(-1))
starredNextBtn.addEventListener('click', () => cycleStarred(1))

document.addEventListener('keydown', (e) => {
  if (isTypingTarget(e.target)) return
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    if (e.altKey || e.shiftKey || e.metaKey || e.ctrlKey) return
    e.preventDefault()
    cycleStarred(e.key === 'ArrowLeft' ? -1 : 1)
    return
  }
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    if (e.metaKey) return
    e.preventDefault()
    const step = e.shiftKey ? 10 : 2
    const delta = e.key === 'ArrowDown' ? step : -step
    if (e.ctrlKey) nudgeFocusY('dividerFocusY', delta, 'Divider')
    else if (e.altKey) nudgeFocusY('endCapFocusY', delta, 'End-cap')
    else nudgeFocusY('bannerFocusY', delta, 'Image')
  }
})

document.getElementById('reset-focus')?.addEventListener('click', () => {
  resetFocusShifts()
})

starCurrentBtn.addEventListener('click', () => {
  const url = getCurrentBannerUrl()
  if (!url) return
  toggleStar(entryFromUrl(url))
})

document.getElementById('copy-banner-url').addEventListener('click', async () => {
  const url = getCurrentBannerUrl()
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    setStatus('Banner URL copied')
  } catch {
    setStatus('Could not copy URL')
  }
})

const bannerUrlInput = form.elements.namedItem('bannerUrl')
if (bannerUrlInput) {
  bannerUrlInput.addEventListener('input', syncCurrentBannerUrl)
  bannerUrlInput.addEventListener('change', syncCurrentBannerUrl)
}

const profileUrlInput = form.elements.namedItem('profileUrl')
if (profileUrlInput) {
  profileUrlInput.addEventListener('input', () => {
    snippet.textContent = pictureSnippet(window.location.origin)
  })
  profileUrlInput.addEventListener('change', () => scheduleSave({ refill: false }))
}

const endCapHeightInput = form.elements.namedItem('endCapHeight')
if (endCapHeightInput) {
  endCapHeightInput.addEventListener('change', () => scheduleSave({ refill: false }))
  endCapHeightInput.addEventListener('input', () => scheduleSave({ refill: false }))
}

const dividerHeightInput = form.elements.namedItem('dividerHeight')
if (dividerHeightInput) {
  dividerHeightInput.addEventListener('change', () => scheduleSave({ refill: false }))
  dividerHeightInput.addEventListener('input', () => scheduleSave({ refill: false }))
}

const endCapFocusInput = form.elements.namedItem('endCapFocusY')
if (endCapFocusInput) {
  endCapFocusInput.addEventListener('change', () => scheduleSave({ refill: false }))
  endCapFocusInput.addEventListener('input', () => scheduleSave({ refill: false }))
}

const dividerFocusInput = form.elements.namedItem('dividerFocusY')
if (dividerFocusInput) {
  dividerFocusInput.addEventListener('change', () => scheduleSave({ refill: false }))
  dividerFocusInput.addEventListener('input', () => scheduleSave({ refill: false }))
}

const endCapFlipInput = form.elements.namedItem('endCapFlipVertical')
if (endCapFlipInput) {
  endCapFlipInput.addEventListener('change', () => scheduleSave({ refill: false }))
}

const bannerFocusInput = form.elements.namedItem('bannerFocusY')
if (bannerFocusInput) {
  bannerFocusInput.addEventListener('change', () => scheduleSave({ refill: false }))
  bannerFocusInput.addEventListener('input', () => scheduleSave({ refill: false }))
}

load()
  .then(async () => {
    syncCurrentBannerUrl()
    await fetchStarred()
    await migrateLocalStarred()
    renderStarred()
    await loadLocalBanners()
    return loadPicsum()
  })
  .catch((err) => setStatus(err.message || 'Load failed'))
