import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { updateBannerUrl } from '../state/config-store.js'
import { isAllowedCallback } from '../callback.js'

const querySchema = z.object({
  image: z.string().url(),
  callback: z.string().url(),
})

export async function setBannerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/set-banner', async (req, reply) => {
    const parsed = querySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query', details: parsed.error.flatten() })
    }
    const { image, callback } = parsed.data
    if (!isAllowedCallback(callback)) {
      return reply.status(400).send({ error: 'callback host not allowed' })
    }
    try {
      const imgUrl = new URL(image)
      if (imgUrl.protocol !== 'http:' && imgUrl.protocol !== 'https:') {
        return reply.status(400).send({ error: 'image must be http(s)' })
      }
    } catch {
      return reply.status(400).send({ error: 'invalid image URL' })
    }

    await updateBannerUrl(image)
    return reply.redirect(callback, 302)
  })
}
