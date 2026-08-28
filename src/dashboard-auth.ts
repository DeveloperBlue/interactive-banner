import { createHash, timingSafeEqual } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'

const PUBLIC_EXACT = new Set([
  '/health',
  '/banner.png',
  '/banner',
  '/banner-light.png',
  '/banner-dark.png',
  '/endcap.png',
  '/endcap',
  '/endcap-light.png',
  '/endcap-dark.png',
  '/divider.png',
  '/divider',
  '/divider-light.png',
  '/divider-dark.png',
  '/set-banner',
  '/prev-banner',
  '/next-banner',
  '/nav-back.png',
  '/nav-forward.png',
  '/nav-back-light.png',
  '/nav-back-dark.png',
  '/nav-forward-light.png',
  '/nav-forward-dark.png',
])

const PUBLIC_PREFIXES = ['/banners/']

export function dashboardCredentials(): { user: string; password: string } | null {
  const password = process.env.DASHBOARD_PASSWORD
  if (!password) return null
  return {
    user: process.env.DASHBOARD_USER || 'admin',
    password,
  }
}

export function assertDashboardAuthConfigured(): void {
  if (process.env.NODE_ENV === 'production' && !process.env.DASHBOARD_PASSWORD) {
    throw new Error('DASHBOARD_PASSWORD is required in production so the editor is not public')
  }
}

export function isPublicPath(url: string): boolean {
  const pathOnly = (url.split('?')[0] ?? url) || '/'
  if (PUBLIC_EXACT.has(pathOnly)) return true
  return PUBLIC_PREFIXES.some((prefix) => pathOnly.startsWith(prefix))
}

function secretEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

export function checkBasicAuth(
  header: string | undefined,
  user: string,
  password: string,
): boolean {
  if (!header?.startsWith('Basic ')) return false
  let decoded: string
  try {
    decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
  } catch {
    return false
  }
  const i = decoded.indexOf(':')
  if (i < 0) return false
  return secretEqual(decoded.slice(0, i), user) && secretEqual(decoded.slice(i + 1), password)
}

export async function dashboardAuthHook(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const creds = dashboardCredentials()
  if (!creds) return
  if (isPublicPath(req.url)) return
  if (checkBasicAuth(req.headers.authorization, creds.user, creds.password)) return
  reply.header('WWW-Authenticate', 'Basic realm="Banner dashboard", charset="UTF-8"')
  return reply.code(401).send({ error: 'Unauthorized' })
}
