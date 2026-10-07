import type { FastifyRequest } from 'fastify'

type UmamiConfig = {
  hostUrl: string
  websiteId: string
}

export type UmamiEvent = {
  /** When set, recorded as a custom event. Pageviews omit this field. */
  name?: string
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

function buildPayload(
  config: UmamiConfig,
  req: FastifyRequest,
  event: UmamiEvent,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    website: config.websiteId,
    hostname: req.hostname,
    url: event.url ?? req.url.split('?')[0],
    language: language(req),
    referrer: headerValue(req, 'referer') || headerValue(req, 'referrer'),
  }
  if (event.name) payload.name = event.name
  if (event.data && Object.keys(event.data).length > 0) {
    payload.data = event.data
  }
  return payload
}

async function post(
  config: UmamiConfig,
  req: FastifyRequest,
  path: '/api/send' | '/api/batch',
  body: unknown,
): Promise<void> {
  const userAgent = headerValue(req, 'user-agent')
  if (!userAgent) return

  const ip = visitorIp(req)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': userAgent,
  }
  if (ip) {
    headers['X-Forwarded-For'] = ip
    headers['X-Real-IP'] = ip
  }

  const res = await fetch(`${config.hostUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`umami ${res.status} ${text.slice(0, 200)}`)
  }
}

/**
 * Fire-and-forget. No-ops when Umami env is unset. Never delays the request.
 * Named events also send a pageview (no `name`) so Views/Visitors update.
 */
export function trackUmamiEvent(req: FastifyRequest, event: UmamiEvent): void {
  const config = getUmamiConfig()
  if (!config) return

  const url = event.url ?? req.url.split('?')[0]
  const work = event.name
    ? post(config, req, '/api/batch', [
        { type: 'event', payload: buildPayload(config, req, { url }) },
        { type: 'event', payload: buildPayload(config, req, { ...event, url }) },
      ])
    : post(config, req, '/api/send', {
        type: 'event',
        payload: buildPayload(config, req, event),
      })

  void work.catch((err) => {
    req.log.warn({ err }, 'umami track failed')
  })
}
