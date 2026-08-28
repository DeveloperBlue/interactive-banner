import { createCanvas } from '@napi-rs/canvas'
import {
  getBannerRect,
  getDividerBannerRect,
  getEndCapBannerRect,
  type BannerConfig,
} from '../schemas.js'
import { ensureFontsForConfig } from '../fonts/registry.js'
import {
  renderBannerLayer,
  renderDividerBannerLayer,
  renderEndCapBannerLayer,
} from './banner.js'
import { drawAvatar, drawAvatarBackdrop } from './avatar.js'
import { drawTexts } from './text.js'
import { loadRemoteImage } from './load-remote.js'
import { clipToRoundedRect } from './clip.js'
import { contrastTextColorFromCanvas } from './contrast.js'

export async function renderBannerPng(config: BannerConfig): Promise<Buffer> {
  await ensureFontsForConfig(
    config.texts.map((t) => ({ family: t.fontFamily, weight: t.fontWeight })),
  )

  const [bannerImage, avatarImage] = await Promise.all([
    loadRemoteImage(config.bannerUrl),
    loadRemoteImage(config.avatarUrl),
  ])

  const canvas = createCanvas(config.width, config.height)
  const ctx = canvas.getContext('2d')

  const bannerLayer = renderBannerLayer(config, bannerImage)
  const bannerRect = getBannerRect(config)
  if (bannerLayer) {
    ctx.drawImage(bannerLayer, bannerRect.x, bannerRect.y)
  }

  const textColor = contrastTextColorFromCanvas(ctx, config)

  drawAvatarBackdrop(ctx, config, bannerLayer, { x: bannerRect.x, y: bannerRect.y })
  drawAvatar(ctx, config, avatarImage, { outlineColor: textColor })
  drawTexts(ctx, config.texts, { colorOverride: textColor })

  clipToRoundedRect(ctx, 0, 0, config.width, config.height, config.canvasRadius)

  return canvas.encode('png')
}

/** Visual end-cap strip: flipped banner, top shatter, bottom corners match main canvas top. */
export async function renderEndCapPng(config: BannerConfig): Promise<Buffer> {
  const h = config.endCapHeight
  const canvas = createCanvas(config.width, Math.max(1, h))
  const ctx = canvas.getContext('2d')

  if (h <= 0) {
    return canvas.encode('png')
  }

  const bannerImage = await loadRemoteImage(config.bannerUrl)

  const layer = renderEndCapBannerLayer(config, bannerImage)
  const rect = getEndCapBannerRect(config)
  if (layer) {
    ctx.drawImage(layer, rect.x, rect.y)
  }

  clipToRoundedRect(ctx, 0, 0, config.width, h, {
    topLeft: 0,
    topRight: 0,
    bottomRight: config.canvasRadius,
    bottomLeft: config.canvasRadius,
  })

  return canvas.encode('png')
}

/** Middle divider strip: shatter on top and bottom. */
export async function renderDividerPng(config: BannerConfig): Promise<Buffer> {
  const h = config.dividerHeight
  const canvas = createCanvas(config.width, Math.max(1, h))
  const ctx = canvas.getContext('2d')

  if (h <= 0) {
    return canvas.encode('png')
  }

  const bannerImage = await loadRemoteImage(config.bannerUrl)

  const layer = renderDividerBannerLayer(config, bannerImage)
  const rect = getDividerBannerRect(config)
  if (layer) {
    ctx.drawImage(layer, rect.x, rect.y)
  }

  return canvas.encode('png')
}
