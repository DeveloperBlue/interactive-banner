import { createCanvas, type Canvas, type Image, type SKRSContext2D } from '@napi-rs/canvas'
import {
  getBannerRect,
  getDividerBannerRect,
  getEndCapBannerRect,
  type BannerConfig,
} from '../schemas.js'
import { clipToRoundedRect } from './clip.js'

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

function drawCover(
  ctx: SKRSContext2D,
  image: Image,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  focusX = 0.5,
  focusY = 0.5,
): void {
  const ir = image.width / image.height
  const tr = dw / dh
  const fx = clamp01(focusX)
  const fy = clamp01(focusY)
  let sw = image.width
  let sh = image.height
  let sx = 0
  let sy = 0
  if (ir > tr) {
    sw = image.height * tr
    sx = (image.width - sw) * fx
  } else {
    sh = image.width / tr
    sy = (image.height - sh) * fy
  }
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)
}

/** Seeded RNG for stable shatter patterns across renders */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function applySideFeathers(
  m: SKRSContext2D,
  w: number,
  h: number,
  config: BannerConfig,
): void {
  const { featherTop, featherRight, featherLeft } = config
  m.globalCompositeOperation = 'destination-out'

  if (featherTop > 0) {
    const g = m.createLinearGradient(0, 0, 0, featherTop)
    g.addColorStop(0, 'rgba(0,0,0,1)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    m.fillStyle = g
    m.fillRect(0, 0, w, featherTop)
  }
  if (featherLeft > 0) {
    const g = m.createLinearGradient(0, 0, featherLeft, 0)
    g.addColorStop(0, 'rgba(0,0,0,1)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    m.fillStyle = g
    m.fillRect(0, 0, featherLeft, h)
  }
  if (featherRight > 0) {
    const g = m.createLinearGradient(w - featherRight, 0, w, 0)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(0,0,0,1)')
    m.fillStyle = g
    m.fillRect(w - featherRight, 0, featherRight, h)
  }

  m.globalCompositeOperation = 'source-over'
}

function buildShatterMask(
  w: number,
  h: number,
  config: BannerConfig,
  edge: 'top' | 'bottom' = 'bottom',
  depthOverride?: number,
): Canvas {
  const depth = Math.min(depthOverride ?? config.featherBottom, h)
  const mask = createCanvas(w, h)
  const m = mask.getContext('2d')

  if (depth <= 0) {
    m.fillStyle = '#ffffff'
    m.fillRect(0, 0, w, h)
    return mask
  }

  const pieces = Math.max(3, Math.floor(config.shatterPieces))
  // Offset seed on top edge so dual-edge dividers don't mirror identically
  const rand = mulberry32(config.shatterSeed + (edge === 'top' ? 7919 : 0))

  const baseY: number[] = []
  for (let i = 0; i <= pieces; i++) {
    if (edge === 'bottom') {
      baseY.push(h - depth + rand() * depth * 0.22)
    } else {
      baseY.push(depth - rand() * depth * 0.22)
    }
  }

  m.fillStyle = '#ffffff'
  m.beginPath()
  if (edge === 'bottom') {
    m.moveTo(0, 0)
    m.lineTo(w, 0)
    m.lineTo(w, baseY[pieces]!)
    for (let i = pieces; i >= 0; i--) {
      m.lineTo((i / pieces) * w, baseY[i]!)
    }
  } else {
    m.moveTo(0, h)
    m.lineTo(w, h)
    m.lineTo(w, baseY[pieces]!)
    for (let i = pieces; i >= 0; i--) {
      m.lineTo((i / pieces) * w, baseY[i]!)
    }
  }
  m.closePath()
  m.fill()

  for (let i = 0; i < pieces; i++) {
    const x0 = (i / pieces) * w
    const x1 = ((i + 1) / pieces) * w
    const y0 = baseY[i]!
    const y1 = baseY[i + 1]!
    const span = x1 - x0

    let tipX: number
    let tipY: number
    let baseMidY: number
    let remaining: number

    if (edge === 'bottom') {
      baseMidY = Math.min(y0, y1)
      remaining = h - Math.max(y0, y1)
      tipX = (x0 + x1) / 2 + (rand() - 0.5) * span * 0.55
      tipY = Math.min(h, Math.max(y0, y1) + (0.2 + rand() * 0.35) * remaining)
    } else {
      baseMidY = Math.max(y0, y1)
      remaining = Math.min(y0, y1)
      tipX = (x0 + x1) / 2 + (rand() - 0.5) * span * 0.55
      tipY = Math.max(0, Math.min(y0, y1) - (0.2 + rand() * 0.35) * remaining)
    }

    const g = m.createLinearGradient((x0 + x1) / 2, baseMidY, tipX, tipY)
    g.addColorStop(0, 'rgba(255,255,255,0.98)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.5)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    m.fillStyle = g
    m.beginPath()
    m.moveTo(x0, y0)
    m.lineTo(x1, y1)
    m.lineTo(tipX, tipY)
    m.closePath()
    m.fill()

    const micros = 1 + (rand() > 0.4 ? 1 : 0)
    for (let s = 0; s < micros; s++) {
      const side = rand() > 0.5 ? x0 : x1
      const sy = side === x0 ? y0 : y1
      const t2x = side + (rand() - 0.5) * span * 0.55
      const t2y =
        edge === 'bottom'
          ? Math.min(h, sy + (0.12 + rand() * 0.28) * depth)
          : Math.max(0, sy - (0.12 + rand() * 0.28) * depth)
      const g2 = m.createLinearGradient(side, sy, t2x, t2y)
      g2.addColorStop(0, 'rgba(255,255,255,0.75)')
      g2.addColorStop(1, 'rgba(255,255,255,0)')
      m.fillStyle = g2
      m.beginPath()
      m.moveTo(side, sy)
      m.lineTo(side + (rand() > 0.5 ? span * 0.28 : -span * 0.28), sy + (edge === 'bottom' ? rand() * 4 : -rand() * 4))
      m.lineTo(t2x, t2y)
      m.closePath()
      m.fill()
    }
  }

  m.globalCompositeOperation = 'destination-in'
  const fade =
    edge === 'bottom'
      ? m.createLinearGradient(0, h - depth, 0, h)
      : m.createLinearGradient(0, depth, 0, 0)
  fade.addColorStop(0, 'rgba(255,255,255,1)')
  fade.addColorStop(0.4, 'rgba(255,255,255,0.9)')
  fade.addColorStop(1, 'rgba(255,255,255,0)')
  m.fillStyle = fade
  m.fillRect(0, 0, w, h)
  m.globalCompositeOperation = 'source-over'

  return mask
}

function applyFeatherMask(
  ctx: SKRSContext2D,
  w: number,
  h: number,
  config: BannerConfig,
  options: { shatterEdge?: 'top' | 'bottom' | 'both' } = {},
): void {
  const { featherTop, featherRight, featherBottom, featherLeft, bottomEdgeStyle } = config
  const shatterEdge = options.shatterEdge ?? 'bottom'
  const hasSides = featherTop > 0 || featherRight > 0 || featherLeft > 0
  const hasPrimary = featherBottom > 0

  if (!hasSides && !hasPrimary) return

  if (bottomEdgeStyle === 'shatter' && hasPrimary) {
    const edgeDepth =
      shatterEdge === 'both' ? Math.min(featherBottom, Math.floor(h / 2)) : undefined
    const mask =
      shatterEdge === 'both'
        ? (() => {
            const top = buildShatterMask(w, h, config, 'top', edgeDepth)
            const bottom = buildShatterMask(w, h, config, 'bottom', edgeDepth)
            const combined = createCanvas(w, h)
            const c = combined.getContext('2d')
            c.drawImage(top, 0, 0)
            c.globalCompositeOperation = 'destination-in'
            c.drawImage(bottom, 0, 0)
            c.globalCompositeOperation = 'source-over'
            return combined
          })()
        : buildShatterMask(w, h, config, shatterEdge)

    const m = mask.getContext('2d')
    if (hasSides) applySideFeathers(m, w, h, config)

    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(mask, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    return
  }

  ctx.globalCompositeOperation = 'destination-in'

  const mask = createCanvas(w, h)
  const m = mask.getContext('2d')
  m.fillStyle = '#ffffff'
  m.fillRect(0, 0, w, h)

  m.globalCompositeOperation = 'destination-out'

  const primaryFeather = featherBottom
  if ((shatterEdge === 'top' || shatterEdge === 'both') && primaryFeather > 0) {
    const depth = shatterEdge === 'both' ? Math.min(primaryFeather, Math.floor(h / 2)) : primaryFeather
    const g = m.createLinearGradient(0, 0, 0, depth)
    g.addColorStop(0, 'rgba(0,0,0,1)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    m.fillStyle = g
    m.fillRect(0, 0, w, depth)
  }
  if ((shatterEdge === 'bottom' || shatterEdge === 'both') && primaryFeather > 0) {
    const depth = shatterEdge === 'both' ? Math.min(primaryFeather, Math.floor(h / 2)) : primaryFeather
    const g = m.createLinearGradient(0, h - depth, 0, h)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(0,0,0,1)')
    m.fillStyle = g
    m.fillRect(0, h - depth, w, depth)
  }

  if (featherTop > 0 && shatterEdge === 'bottom') {
    const g = m.createLinearGradient(0, 0, 0, featherTop)
    g.addColorStop(0, 'rgba(0,0,0,1)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    m.fillStyle = g
    m.fillRect(0, 0, w, featherTop)
  }
  if (featherLeft > 0) {
    const g = m.createLinearGradient(0, 0, featherLeft, 0)
    g.addColorStop(0, 'rgba(0,0,0,1)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    m.fillStyle = g
    m.fillRect(0, 0, featherLeft, h)
  }
  if (featherRight > 0) {
    const g = m.createLinearGradient(w - featherRight, 0, w, 0)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(0,0,0,1)')
    m.fillStyle = g
    m.fillRect(w - featherRight, 0, featherRight, h)
  }

  ctx.drawImage(mask, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
}

export function renderBannerLayer(config: BannerConfig, image: Image | null): Canvas | null {
  const { width: w, height: h } = getBannerRect(config)
  if (w <= 0 || h <= 0) return null

  const layer = createCanvas(w, h)
  const ctx = layer.getContext('2d')

  if (image) {
    if (config.blur > 0) {
      ctx.filter = `blur(${config.blur}px)`
    }
    drawCover(ctx, image, 0, 0, w, h, 0.5, config.bannerFocusY / 100)
    ctx.filter = 'none'
  } else {
    const grad = ctx.createLinearGradient(0, 0, w, h)
    grad.addColorStop(0, '#1e293b')
    grad.addColorStop(1, '#0f172a')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  }

  applyFeatherMask(ctx, w, h, config)
  clipToRoundedRect(ctx, 0, 0, w, h, config.bannerRadius)
  return layer
}

/**
 * End-cap image band: optional vertical flip, shatter on the top edge,
 * bottom corners rounded to mirror the main banner's top corners.
 */
export function renderEndCapBannerLayer(config: BannerConfig, image: Image | null): Canvas | null {
  const { width: w, height: h } = getEndCapBannerRect(config)
  if (w <= 0 || h <= 0) return null

  const layer = createCanvas(w, h)
  const ctx = layer.getContext('2d')

  if (image) {
    if (config.blur > 0) {
      ctx.filter = `blur(${config.blur}px)`
    }
    if (config.endCapFlipVertical) {
      ctx.save()
      ctx.translate(0, h)
      ctx.scale(1, -1)
      drawCover(ctx, image, 0, 0, w, h, 0.5, config.endCapFocusY / 100)
      ctx.restore()
    } else {
      drawCover(ctx, image, 0, 0, w, h, 0.5, config.endCapFocusY / 100)
    }
    ctx.filter = 'none'
  } else {
    const grad = ctx.createLinearGradient(0, h, w, 0)
    grad.addColorStop(0, '#1e293b')
    grad.addColorStop(1, '#0f172a')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  }

  applyFeatherMask(ctx, w, h, config, { shatterEdge: 'top' })
  clipToRoundedRect(ctx, 0, 0, w, h, {
    topLeft: 0,
    topRight: 0,
    bottomRight: config.bannerRadius,
    bottomLeft: config.bannerRadius,
  })
  return layer
}

/** Middle divider strip: shatter on both top and bottom edges. */
export function renderDividerBannerLayer(config: BannerConfig, image: Image | null): Canvas | null {
  const { width: w, height: h } = getDividerBannerRect(config)
  if (w <= 0 || h <= 0) return null

  const layer = createCanvas(w, h)
  const ctx = layer.getContext('2d')

  if (image) {
    if (config.blur > 0) {
      ctx.filter = `blur(${config.blur}px)`
    }
    drawCover(ctx, image, 0, 0, w, h, 0.5, config.dividerFocusY / 100)
    ctx.filter = 'none'
  } else {
    const grad = ctx.createLinearGradient(0, 0, w, h)
    grad.addColorStop(0, '#1e293b')
    grad.addColorStop(1, '#0f172a')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  }

  applyFeatherMask(ctx, w, h, config, { shatterEdge: 'both' })
  return layer
}
