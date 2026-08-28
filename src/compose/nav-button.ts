import { createCanvas } from '@napi-rs/canvas'
import type { Theme } from '../schemas.js'

const SIZE = 48

const THEME = {
  light: {
    fill: '#ffffff',
    border: '#d0d7de',
    icon: '#1f2328',
    shadow: 'rgba(31, 35, 40, 0.12)',
  },
  dark: {
    fill: '#21262d',
    border: '#3d444d',
    icon: '#f0f6fc',
    shadow: 'rgba(0, 0, 0, 0.35)',
  },
} as const

export type NavDirection = 'back' | 'forward'

/** Small circular chevron button for README embeds. */
export async function renderNavButtonPng(direction: NavDirection, theme: Theme = 'dark'): Promise<Buffer> {
  const canvas = createCanvas(SIZE, SIZE)
  const ctx = canvas.getContext('2d')
  const colors = THEME[theme]
  const cx = SIZE / 2
  const cy = SIZE / 2
  const r = SIZE / 2 - 3

  ctx.save()
  ctx.shadowColor = colors.shadow
  ctx.shadowBlur = 3
  ctx.shadowOffsetY = 1
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = colors.fill
  ctx.fill()
  ctx.restore()

  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = colors.border
  ctx.lineWidth = 1.25
  ctx.stroke()

  const dir = direction === 'back' ? -1 : 1
  const tip = 7
  const spread = 8
  ctx.beginPath()
  ctx.moveTo(cx - dir * 4, cy - spread)
  ctx.lineTo(cx + dir * tip, cy)
  ctx.lineTo(cx - dir * 4, cy + spread)
  ctx.strokeStyle = colors.icon
  ctx.lineWidth = 2.75
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()

  return canvas.encode('png')
}
