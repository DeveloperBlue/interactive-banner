import { z } from 'zod'

export const textAlignSchema = z.enum(['left', 'center', 'right'])
export const avatarPositionSchema = z.enum(['left', 'center', 'right'])
export const themeSchema = z.enum(['light', 'dark'])
export const bottomEdgeStyleSchema = z.enum(['feather', 'shatter'])

export type Theme = z.infer<typeof themeSchema>
export type BottomEdgeStyle = z.infer<typeof bottomEdgeStyleSchema>

/** Card / canvas fill behind banner + gap */
export const THEME_CARD_COLOR: Record<Theme, string> = {
  light: '#ffffff',
  dark: '#0d1117',
}

export const textItemSchema = z.object({
  content: z.string(),
  align: textAlignSchema.default('left'),
  x: z.number(),
  y: z.number(),
  fontFamily: z.string().default('Inter'),
  fontWeight: z.union([z.number(), z.string()]).default(400),
  fontSize: z.number().positive().default(32),
  color: z.string().default('#ffffff'),
})

export const starredEntrySchema = z.object({
  id: z.number().int().nullable(),
  url: z.string().min(1),
  author: z.string().default(''),
})
export const starredListSchema = z.array(starredEntrySchema)
export type StarredEntry = z.infer<typeof starredEntrySchema>

export const bannerConfigSchema = z.object({
  width: z.number().int().positive().max(4000).default(1000),
  height: z.number().int().positive().max(4000).default(300),
  /** Clips the entire output PNG */
  canvasRadius: z.number().nonnegative().default(0),
  /** End-cap strip height (same width as canvas); 0 = disabled */
  endCapHeight: z.number().int().nonnegative().max(4000).default(40),
  /** Middle divider strip height; 0 = disabled */
  dividerHeight: z.number().int().nonnegative().max(4000).default(40),
  bannerUrl: z.string().default(''),
  bannerHeight: z.number().int().nonnegative().default(200),
  /** Inset (px) between canvas edges and the banner on top/left/right */
  bannerGap: z.number().nonnegative().default(0),
  /** Rounded clip on the banner layer only */
  bannerRadius: z.number().nonnegative().default(0),
  /** Cover-crop focus for main banner: 0 = top of photo, 50 = center, 100 = bottom */
  bannerFocusY: z.number().min(0).max(100).default(50),
  /** Cover-crop focus for end-cap (independent of main) */
  endCapFocusY: z.number().min(0).max(100).default(50),
  /** Cover-crop focus for middle divider */
  dividerFocusY: z.number().min(0).max(100).default(50),
  /** Vertically flip the end-cap cover image */
  endCapFlipVertical: z.boolean().default(true),
  /**
   * Per-banner focus overrides keyed by banner URL.
   * Active focus values are always the live values; this map
   * restores them when switching banners.
   */
  bannerFocusByUrl: z
    .record(
      z.string(),
      z.object({
        bannerFocusY: z.number().min(0).max(100).optional(),
        endCapFocusY: z.number().min(0).max(100).optional(),
        dividerFocusY: z.number().min(0).max(100).optional(),
      }),
    )
    .default({}),
  /** Bottom edge treatment; depth uses featherBottom */
  bottomEdgeStyle: bottomEdgeStyleSchema.default('shatter'),
  featherTop: z.number().nonnegative().default(0),
  featherRight: z.number().nonnegative().default(0),
  featherBottom: z.number().nonnegative().default(0),
  featherLeft: z.number().nonnegative().default(0),
  /** Shatter pattern seed (same seed = same cracks) */
  shatterSeed: z.number().int().default(42),
  /** Number of primary glass shards across the width */
  shatterPieces: z.number().int().min(3).max(96).default(36),
  blur: z.number().nonnegative().default(0),
  avatarUrl: z.string().default(''),
  avatarPosition: avatarPositionSchema.default('left'),
  avatarPadding: z.number().nonnegative().default(24),
  /** Vertical position of avatar center (px from top) */
  avatarY: z.number().default(150),
  avatarDiameter: z.number().positive().default(120),
  /** Circular outline stroke width (px); 0 = none */
  avatarOutline: z.number().nonnegative().default(0),
  avatarOutlineColor: z.string().default('#d1d9e0'),
  /** Blurred color disc behind avatar from banner samples; 0 = off */
  avatarBackdropBlur: z.number().nonnegative().default(28),
  /** GitHub profile URL used in README cycle-button callback links */
  profileUrl: z.string().default(''),
  texts: z.array(textItemSchema).default([]),
})

export type BannerConfig = z.infer<typeof bannerConfigSchema>
export type TextItem = z.infer<typeof textItemSchema>

export const DEFAULT_FOCUS_Y = 50

/** Resolve stored per-URL focus, falling back to centered defaults. */
export function focusForBannerUrl(
  config: Pick<BannerConfig, 'bannerFocusByUrl'>,
  url: string,
): { bannerFocusY: number; endCapFocusY: number; dividerFocusY: number } {
  const entry = url ? config.bannerFocusByUrl[url] : undefined
  return {
    bannerFocusY: entry?.bannerFocusY ?? DEFAULT_FOCUS_Y,
    endCapFocusY: entry?.endCapFocusY ?? DEFAULT_FOCUS_Y,
    dividerFocusY: entry?.dividerFocusY ?? DEFAULT_FOCUS_Y,
  }
}

export const defaultConfig: BannerConfig = bannerConfigSchema.parse({
  width: 1000,
  height: 300,
  canvasRadius: 0,
  endCapHeight: 40,
  dividerHeight: 40,
  bannerUrl: '',
  bannerHeight: 200,
  bannerGap: 0,
  bannerRadius: 0,
  bannerFocusY: 50,
  endCapFocusY: 50,
  dividerFocusY: 50,
  endCapFlipVertical: true,
  bannerFocusByUrl: {},
  bottomEdgeStyle: 'shatter',
  featherTop: 0,
  featherRight: 0,
  featherBottom: 22,
  featherLeft: 0,
  shatterSeed: 42,
  shatterPieces: 36,
  blur: 0,
  avatarUrl: '',
  avatarPosition: 'left',
  avatarPadding: 24,
  avatarY: 150,
  avatarDiameter: 120,
  avatarOutline: 0,
  avatarOutlineColor: '#d1d9e0',
  avatarBackdropBlur: 28,
  profileUrl: '',
  texts: [
    {
      content: 'Your Name',
      align: 'left',
      x: 160,
      y: 150,
      fontFamily: 'Inter',
      fontWeight: 700,
      fontSize: 42,
      color: '#ffffff',
    },
  ],
})

/** Banner draw rect inside the canvas (accounts for gap). */
export function getBannerRect(config: BannerConfig): {
  x: number
  y: number
  width: number
  height: number
} {
  const gap = config.bannerGap
  const width = Math.max(0, config.width - gap * 2)
  const height = Math.max(0, Math.min(config.bannerHeight, config.height - gap))
  return { x: gap, y: gap, width, height }
}

/**
 * End-cap banner band: mirrors the main banner's top inset —
 * gap on left/right/bottom, content flush to the top (shatter faces up).
 */
export function getEndCapBannerRect(config: BannerConfig): {
  x: number
  y: number
  width: number
  height: number
} {
  const gap = config.bannerGap
  const width = Math.max(0, config.width - gap * 2)
  const height = Math.max(0, Math.min(config.endCapHeight, config.endCapHeight - gap))
  return { x: gap, y: 0, width, height }
}

/** Middle divider band: full strip width (gap inset), fills divider height. */
export function getDividerBannerRect(config: BannerConfig): {
  x: number
  y: number
  width: number
  height: number
} {
  const gap = config.bannerGap
  const width = Math.max(0, config.width - gap * 2)
  const height = Math.max(0, config.dividerHeight)
  return { x: gap, y: 0, width, height }
}
