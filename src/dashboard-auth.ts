import { createHash, timingSafeEqual } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'

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

export function isEditorPath(url: string): boolean {
  const pathOnly = (url.split('?')[0] ?? url) || '/'
  return pathOnly === '/editor' || pathOnly.startsWith('/editor/')
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
  if (!isEditorPath(req.url)) return
  if (checkBasicAuth(req.headers.authorization, creds.user, creds.password)) return
  reply.header('WWW-Authenticate', 'Basic realm="Banner dashboard", charset="UTF-8"')
  return reply.code(401).send({ error: 'Unauthorized' })
}
