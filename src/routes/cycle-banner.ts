import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { themeSchema, type Theme } from '../schemas.js'
import { isAllowedCallback } from '../callback.js'
import { renderNavButtonPng, type NavDirection } from '../compose/nav-button.js'
import { cycleStarredBanner } from '../state/cycle-banner.js'

const cycleQuery = z.object({
  callback: z.string().url(),
})

function parseTheme(raw: unknown): Theme {
  const q = typeof raw === 'object' && raw && 'theme' in raw ? (raw as { theme?: unknown }).theme : raw
  const parsed = themeSchema.safeParse(q ?? 'dark')
  return parsed.success ? parsed.data : 'dark'
}

async function sendNavButton(direction: NavDirection, theme: Theme, reply: FastifyReply) {
  const png = await renderNavButtonPng(direction, theme)
  return reply
    .header('Content-Type', 'image/png')
    .header('Cache-Control', 'public, max-age=86400')
    .send(png)
}

async function cycleAndRedirect(delta: 1 | -1, req: FastifyRequest, reply: FastifyReply) {
  const parsed = cycleQuery.safeParse(req.query)
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Invalid query', details: parsed.error.flatten() })
  }
  const { callback } = parsed.data
  if (!isAllowedCallback(callback)) {
    return reply.status(400).send({ error: 'callback host not allowed' })
  }
  await cycleStarredBanner(delta)
  return reply.redirect(callback, 302)
}

export async function cycleBannerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/prev-banner', async (req, reply) => cycleAndRedirect(-1, req, reply))
  app.get('/next-banner', async (req, reply) => cycleAndRedirect(1, req, reply))

  app.get('/nav-back.png', async (req, reply) => sendNavButton('back', parseTheme(req.query), reply))
  app.get('/nav-forward.png', async (req, reply) =>
    sendNavButton('forward', parseTheme(req.query), reply),
  )
  app.get('/nav-back-light.png', async (_req, reply) => sendNavButton('back', 'light', reply))
  app.get('/nav-back-dark.png', async (_req, reply) => sendNavButton('back', 'dark', reply))
  app.get('/nav-forward-light.png', async (_req, reply) => sendNavButton('forward', 'light', reply))
  app.get('/nav-forward-dark.png', async (_req, reply) => sendNavButton('forward', 'dark', reply))
}
