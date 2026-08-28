import { createCanvas, type Image, type SKRSContext2D, type Canvas } from '@napi-rs/canvas'
import type { BannerConfig } from '../schemas.js'

export function getAvatarLayout(config: BannerConfig): { cx: number; cy: number; r: number } {
  const d = config.avatarDiameter
  const r = d / 2
  let cx: number
  if (config.avatarPosition === 'left') {
    cx = config.avatarPadding + r
  } else if (config.avatarPosition === 'right') {
    cx = config.width - config.avatarPadding - r
  } else {
    cx = config.width / 2
  }
  return { cx, cy: config.avatarY, r }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function sampleColorsAround(
  ctx: SKRSContext2D,
  cx: number,
  cy: number,
  r: number,
  count: number,
): Array<[number, number, number]> {
  const w = ctx.canvas.width
  const h = ctx.canvas.height
  const colors: Array<[number, number, number]> = []

  const points: Array<[number, number]> = [[cx, cy]]
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    const dist = r * (0.35 + (i % 3) * 0.2)
    points.push([cx + Math.cos(a) * dist, cy + Math.sin(a) * dist])
  }

  for (const [px, py] of points) {
    const x = clamp(Math.round(px), 0, w - 1)
    const y = clamp(Math.round(py), 0, h - 1)
    const d = ctx.getImageData(x, y, 1, 1).data
    if (d[3]! > 16) colors.push([d[0]!, d[1]!, d[2]!])
  }
  return colors
}

/**
 * Soft circular disc behind the avatar, colored from samples of the banner
 * (and nearby canvas) and blurred.
 */
export function drawAvatarBackdrop(
  ctx: SKRSContext2D,
  config: BannerConfig,
  bannerLayer: Canvas | null,
  bannerOffset: { x: number; y: number },
): void {
  const blur = config.avatarBackdropBlur
  if (blur <= 0 || !config.avatarUrl) return

  const { cx, cy, r } = getAvatarLayout(config)
  const R = r * 1.14
  const pad = Math.ceil(blur * 2.2)
  const size = Math.ceil((R + pad) * 2)
  const mid = size / 2

  const off = createCanvas(size, size)
  const o = off.getContext('2d')

  // 1) Prefer a blurred crop of the banner under the avatar
  if (bannerLayer) {
    const srcX = cx - bannerOffset.x - R
    const srcY = cy - bannerOffset.y - R
    o.save()
    o.beginPath()
    o.arc(mid, mid, R + pad * 0.5, 0, Math.PI * 2)
    o.clip()
    o.filter = `blur(${blur}px)`
    o.drawImage(bannerLayer, srcX, srcY, R * 2, R * 2, mid - R, mid - R, R * 2, R * 2)
    o.filter = 'none'
    o.restore()
  }

  // 2) Sample colors from the composed canvas and paint soft blobs (fills gaps / transparent areas)
  const samples = sampleColorsAround(ctx, cx, cy, Math.max(R, 40), 10)
  if (samples.length) {
    o.save()
    o.filter = `blur(${blur}px)`
    o.globalAlpha = bannerLayer ? 0.55 : 1
    for (let i = 0; i < samples.length; i++) {
      const [cr, cg, cb] = samples[i]!
      const a = (i / samples.length) * Math.PI * 2
      const bx = mid + Math.cos(a) * R * 0.32
      const by = mid + Math.sin(a) * R * 0.32
      const g = o.createRadialGradient(bx, by, 0, bx, by, R * 0.9)
      g.addColorStop(0, `rgba(${cr},${cg},${cb},0.9)`)
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`)
      o.fillStyle = g
      o.beginPath()
      o.arc(bx, by, R * 0.9, 0, Math.PI * 2)
      o.fill()
    }
    o.filter = 'none'
    o.restore()
  }

  // Circular mask
  o.globalCompositeOperation = 'destination-in'
  o.fillStyle = '#ffffff'
  o.beginPath()
  o.arc(mid, mid, R, 0, Math.PI * 2)
  o.fill()
  o.globalCompositeOperation = 'source-over'

  ctx.drawImage(off, cx - mid, cy - mid)
}

export function drawAvatar(
  ctx: SKRSContext2D,
  config: BannerConfig,
  image: Image | null,
  options: { outlineColor?: string } = {},
): void {
  if (!image) return

  const { cx, cy, r } = getAvatarLayout(config)
  const d = r * 2

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()

  const ir = image.width / image.height
  let dw = d
  let dh = d
  let dx = cx - r
  let dy = cy - r
  if (ir > 1) {
    dw = d * ir
    dx = cx - dw / 2
  } else {
    dh = d / ir
    dy = cy - dh / 2
  }
  ctx.drawImage(image, dx, dy, dw, dh)
  ctx.restore()

  if (config.avatarOutline > 0) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.closePath()
    ctx.strokeStyle = options.outlineColor ?? config.avatarOutlineColor
    ctx.lineWidth = config.avatarOutline
    ctx.stroke()
    ctx.restore()
  }
}
