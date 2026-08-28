import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { loadConfig } from '../state/config-store.js'
import { renderBannerPng, renderDividerPng, renderEndCapPng } from '../compose/render.js'

async function sendPng(png: Buffer, reply: FastifyReply) {
  return reply
    .header('Content-Type', 'image/png')
    .header('Cache-Control', 'private, max-age=0, no-cache')
    .header('Pragma', 'no-cache')
    .send(png)
}

async function sendBanner(_req: FastifyRequest, reply: FastifyReply) {
  const config = await loadConfig()
  return sendPng(await renderBannerPng(config), reply)
}

async function sendEndCap(_req: FastifyRequest, reply: FastifyReply) {
  const config = await loadConfig()
  return sendPng(await renderEndCapPng(config), reply)
}

async function sendDivider(_req: FastifyRequest, reply: FastifyReply) {
  const config = await loadConfig()
  return sendPng(await renderDividerPng(config), reply)
}

export async function bannerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/banner.png', sendBanner)
  app.get('/banner', sendBanner)
  app.get('/banner-light.png', sendBanner)
  app.get('/banner-dark.png', sendBanner)

  app.get('/endcap.png', sendEndCap)
  app.get('/endcap', sendEndCap)
  app.get('/endcap-light.png', sendEndCap)
  app.get('/endcap-dark.png', sendEndCap)

  app.get('/divider.png', sendDivider)
  app.get('/divider', sendDivider)
  app.get('/divider-light.png', sendDivider)
  app.get('/divider-dark.png', sendDivider)
}
