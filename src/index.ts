import path from 'node:path'
import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { registerBundledFonts } from './fonts/registry.js'
import { loadConfig } from './state/config-store.js'
import { loadStarred } from './state/starred-store.js'
import { bannerRoutes } from './routes/banner.js'
import { setBannerRoutes } from './routes/set-banner.js'
import { configRoutes } from './routes/config.js'
import { localBannerRoutes } from './routes/local-banners.js'
import { starredRoutes } from './routes/starred.js'
import { cycleBannerRoutes } from './routes/cycle-banner.js'
import { assertDashboardAuthConfigured, dashboardAuthHook } from './dashboard-auth.js'

const PORT = Number(process.env.PORT ?? 3000)
const HOST = process.env.HOST ?? '0.0.0.0'

async function main() {
  assertDashboardAuthConfigured()
  await registerBundledFonts()
  await loadConfig()
  await loadStarred()

  const app = Fastify({ logger: true })
  app.addHook('onRequest', dashboardAuthHook)

  app.get('/health', async () => ({ ok: true }))
  app.get('/', async (_req, reply) => reply.redirect('/editor/'))
  app.get('/editor', async (_req, reply) => reply.redirect('/editor/'))

  await app.register(bannerRoutes)
  await app.register(setBannerRoutes)
  await app.register(cycleBannerRoutes)

  await app.register(fastifyStatic, {
    root: path.resolve(process.cwd(), 'banners'),
    prefix: '/banners/',
    decorateReply: false,
  })

  await app.register(
    async (editorApp) => {
      await editorApp.register(configRoutes)
      await editorApp.register(starredRoutes)
      await editorApp.register(localBannerRoutes)
      await editorApp.register(fastifyStatic, {
        root: path.resolve(process.cwd(), 'public/editor'),
        prefix: '/',
      })
    },
    { prefix: '/editor' },
  )

  await app.listen({ port: PORT, host: HOST })
  console.log(`Banner generator listening on http://${HOST}:${PORT}`)
  console.log(`Editor at http://${HOST}:${PORT}/editor/`)
  if (process.env.DASHBOARD_PASSWORD) {
    console.log('/editor is protected with HTTP Basic Auth')
  } else {
    console.log('/editor is open — set DASHBOARD_PASSWORD before public deploy')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
