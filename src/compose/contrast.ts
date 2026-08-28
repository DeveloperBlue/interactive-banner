import type { SKRSContext2D } from '@napi-rs/canvas'
import type { BannerConfig } from '../schemas.js'

/** Readable on light sampled backgrounds (GitHub-ish ink) */
export const CONTRAST_DARK_TEXT = '#1f2328'
/** Readable on dark sampled backgrounds */
export const CONTRAST_LIGHT_TEXT = '#ffffff'

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

/** WCAG relative luminance 0–1 */
export function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function samplePixel(
  ctx: SKRSContext2D,
  x: number,
  y: number,
): [number, number, number] | null {
  const w = ctx.canvas.width
  const h = ctx.canvas.height
  const px = clamp(Math.round(x), 0, w - 1)
  const py = clamp(Math.round(y), 0, h - 1)
  const d = ctx.getImageData(px, py, 1, 1).data
  if (d[3]! < 16) return null
  return [d[0]!, d[1]!, d[2]!]
}

/**
 * Sample the composed canvas near text anchors and across the banner band,
 * then pick dark vs light text for contrast.
 */
export function contrastTextColorFromCanvas(
  ctx: SKRSContext2D,
  config: BannerConfig,
): string {
  const samples: Array<[number, number, number]> = []
  const w = config.width
  const h = config.height

  // Text anchor neighborhoods
  for (const t of config.texts) {
    for (const [dx, dy] of [
      [0, 0],
      [-24, 0],
      [24, 0],
      [0, -12],
      [0, 12],
      [-40, -8],
      [40, 8],
    ] as const) {
      const s = samplePixel(ctx, t.x + dx, t.y + dy)
      if (s) samples.push(s)
    }
  }

  // Banner band grid (top portion of canvas where imagery usually sits)
  const bandH = Math.min(config.bannerHeight + config.bannerGap, h)
  for (let yi = 0; yi < 4; yi++) {
    for (let xi = 0; xi < 6; xi++) {
      const s = samplePixel(
        ctx,
        (xi + 0.5) * (w / 6),
        config.bannerGap + (yi + 0.5) * (bandH / 4),
      )
      if (s) samples.push(s)
    }
  }

  // Fallback: remaining opaque pixels (banner / avatar), skipping transparency
  if (!samples.length) {
    for (const [x, y] of [
      [w / 2, h / 2],
      [w * 0.2, h * 0.5],
      [w * 0.8, h * 0.5],
    ] as const) {
      const s = samplePixel(ctx, x, y)
      if (s) samples.push(s)
    }
  }

  if (!samples.length) return CONTRAST_LIGHT_TEXT

  const avgL =
    samples.reduce((sum, [r, g, b]) => sum + relativeLuminance(r, g, b), 0) /
    samples.length

  // Mid-gray threshold — bias slightly toward dark ink on mid tones
  return avgL > 0.45 ? CONTRAST_DARK_TEXT : CONTRAST_LIGHT_TEXT
}
