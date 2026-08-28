import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { themeSchema, type Theme } from '../schemas.js'
import { loadConfig } from '../state/config-store.js'
import { renderBannerPng, renderDividerPng, renderEndCapPng } from '../compose/render.js'

function parseTheme(raw: unknown): Theme {
  const q = typeof raw === 'object' && raw && 'theme' in raw ? (raw as { theme?: unknown }).theme : raw
  const parsed = themeSchema.safeParse(q ?? 'dark')
  return parsed.success ? parsed.data : 'dark'
}

async function sendPng(png: Buffer, reply: FastifyReply) {
  return reply
    .header('Content-Type', 'image/png')
    .header('Cache-Control', 'no-cache, no-store, must-revalidate')
    .header('Pragma', 'no-cache')
    .send(png)
}

async function sendBanner(theme: Theme, reply: FastifyReply) {
  const config = await loadConfig()
  return sendPng(await renderBannerPng(config, theme), reply)
}

async function sendEndCap(theme: Theme, reply: FastifyReply) {
  const config = await loadConfig()
  return sendPng(await renderEndCapPng(config, theme), reply)
}

async function sendDivider(theme: Theme, reply: FastifyReply) {
  const config = await loadConfig()
  return sendPng(await renderDividerPng(config, theme), reply)
}

export async function bannerRoutes(app: FastifyInstance): Promise<void> {
  const fromQuery = async (req: FastifyRequest, reply: FastifyReply) => {
    return sendBanner(parseTheme(req.query), reply)
  }

  const endCapFromQuery = async (req: FastifyRequest, reply: FastifyReply) => {
    return sendEndCap(parseTheme(req.query), reply)
  }

  const dividerFromQuery = async (req: FastifyRequest, reply: FastifyReply) => {
    return sendDivider(parseTheme(req.query), reply)
  }

  app.get('/banner.png', fromQuery)
  app.get('/banner', fromQuery)

  app.get('/banner-light.png', async (_req, reply) => sendBanner('light', reply))
  app.get('/banner-dark.png', async (_req, reply) => sendBanner('dark', reply))

  app.get('/endcap.png', endCapFromQuery)
  app.get('/endcap', endCapFromQuery)
  app.get('/endcap-light.png', async (_req, reply) => sendEndCap('light', reply))
  app.get('/endcap-dark.png', async (_req, reply) => sendEndCap('dark', reply))

  app.get('/divider.png', dividerFromQuery)
  app.get('/divider', dividerFromQuery)
  app.get('/divider-light.png', async (_req, reply) => sendDivider('light', reply))
  app.get('/divider-dark.png', async (_req, reply) => sendDivider('dark', reply))
}
