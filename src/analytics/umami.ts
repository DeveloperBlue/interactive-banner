import type { FastifyRequest } from 'fastify'

type UmamiConfig = {
  hostUrl: string
  websiteId: string
}

export type UmamiEvent = {
  name: string
  url?: string
  data?: Record<string, string | number | boolean>
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function getUmamiConfig(): UmamiConfig | null {
  const hostUrl = process.env.UMAMI_HOST_URL?.trim()
  const websiteId = process.env.UMAMI_WEBSITE_ID?.trim()
  if (!hostUrl || !websiteId) return null
  return { hostUrl: trimSlash(hostUrl), websiteId }
}

function headerValue(req: FastifyRequest, name: string): string | undefined {
  const raw = req.headers[name]
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  if (Array.isArray(raw) && raw[0]?.trim()) return raw[0].trim()
  return undefined
}

function visitorIp(req: FastifyRequest): string | undefined {
  return headerValue(req, 'cf-connecting-ip') || headerValue(req, 'x-real-ip') || req.ip
}

function language(req: FastifyRequest): string | undefined {
  const accept = headerValue(req, 'accept-language')
  if (!accept) return undefined
  return accept.split(',')[0]?.trim().slice(0, 35)
}

async function send(config: UmamiConfig, req: FastifyRequest, event: UmamiEvent): Promise<void> {
  const userAgent = headerValue(req, 'user-agent')
  if (!userAgent) return

  const ip = visitorIp(req)
  const payload: Record<string, unknown> = {
    website: config.websiteId,
    hostname: req.hostname,
    url: event.url ?? req.url.split('?')[0],
    name: event.name,
    language: language(req),
    referrer: headerValue(req, 'referer') || headerValue(req, 'referrer'),
  }
  if (event.data && Object.keys(event.data).length > 0) {
    payload.data = event.data
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': userAgent,
  }
  if (ip) {
    headers['X-Forwarded-For'] = ip
    headers['X-Real-IP'] = ip
  }

  const res = await fetch(`${config.hostUrl}/api/send`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type: 'event', payload }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`umami ${res.status} ${body.slice(0, 200)}`)
  }
}

/** Fire-and-forget. No-ops when Umami env is unset. Never delays the request. */
export function trackUmamiEvent(req: FastifyRequest, event: UmamiEvent): void {
  const config = getUmamiConfig()
  if (!config) return
  void send(config, req, event).catch((err) => {
    req.log.warn({ err }, 'umami track failed')
  })
}
