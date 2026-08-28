import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { loadConfig, saveConfig } from '../state/config-store.js'

export async function configRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/config', async () => loadConfig())

  app.put('/api/config', async (req, reply) => {
    try {
      const saved = await saveConfig(req.body)
      return saved
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: 'Invalid config', details: err.flatten() })
      }
      throw err
    }
  })
}
