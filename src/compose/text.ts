import type { SKRSContext2D } from '@napi-rs/canvas'
import type { TextItem } from '../schemas.js'

export function drawTexts(
  ctx: SKRSContext2D,
  texts: TextItem[],
  options: { colorOverride?: string } = {},
): void {
  ctx.textBaseline = 'middle'
  for (const item of texts) {
    const weight = item.fontWeight
    ctx.font = `${weight} ${item.fontSize}px "${item.fontFamily}"`
    ctx.fillStyle = options.colorOverride ?? item.color
    ctx.textAlign = item.align
    ctx.fillText(item.content, item.x, item.y)
  }
}
