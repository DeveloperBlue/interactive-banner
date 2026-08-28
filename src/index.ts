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

  await app.register(configRoutes)
  await app.register(bannerRoutes)
  await app.register(setBannerRoutes)
  await app.register(localBannerRoutes)
  await app.register(starredRoutes)
  await app.register(cycleBannerRoutes)

  await app.register(fastifyStatic, {
    root: path.resolve(process.cwd(), 'banners'),
    prefix: '/banners/',
    decorateReply: false,
  })

  await app.register(fastifyStatic, {
    root: path.resolve(process.cwd(), 'public'),
    prefix: '/',
  })

  await app.listen({ port: PORT, host: HOST })
  console.log(`Banner generator listening on http://${HOST}:${PORT}`)
  if (process.env.DASHBOARD_PASSWORD) {
    console.log('Dashboard is protected with HTTP Basic Auth')
  } else {
    console.log('Dashboard is open — set DASHBOARD_PASSWORD before public deploy')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
