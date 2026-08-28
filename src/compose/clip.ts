import type { SKRSContext2D } from '@napi-rs/canvas'

export type CornerRadii = {
  topLeft?: number
  topRight?: number
  bottomRight?: number
  bottomLeft?: number
}

function clampCorner(r: number, w: number, h: number): number {
  return Math.max(0, Math.min(r, w / 2, h / 2))
}

/** Clip current drawing target to a rounded rect (destination-in). */
export function clipToRoundedRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number | CornerRadii,
): void {
  if (w <= 0 || h <= 0) return

  let radii: [number, number, number, number]
  if (typeof radius === 'number') {
    const r = clampCorner(radius, w, h)
    if (r <= 0) return
    radii = [r, r, r, r]
  } else {
    radii = [
      clampCorner(radius.topLeft ?? 0, w, h),
      clampCorner(radius.topRight ?? 0, w, h),
      clampCorner(radius.bottomRight ?? 0, w, h),
      clampCorner(radius.bottomLeft ?? 0, w, h),
    ]
    if (radii.every((r) => r <= 0)) return
  }

  ctx.save()
  ctx.globalCompositeOperation = 'destination-in'
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, radii)
  ctx.fill()
  ctx.restore()
}
