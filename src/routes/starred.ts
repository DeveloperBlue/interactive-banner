import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { loadStarred, saveStarred } from '../state/starred-store.js'

export async function starredRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/starred', async () => ({ entries: await loadStarred() }))

  app.put('/api/starred', async (req, reply) => {
    try {
      const body = req.body
      const list =
        body && typeof body === 'object' && 'entries' in body
          ? (body as { entries: unknown }).entries
          : body
      const entries = await saveStarred(list)
      return { entries }
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: 'Invalid starred list', details: err.flatten() })
      }
      throw err
    }
  })
}
