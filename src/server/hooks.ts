import { FastifyInstance } from 'fastify';

// Attach common headers to avoid browser caching API responses (prevents 304 confusion)
export async function registerNoCacheHook(app: FastifyInstance) {
  app.addHook('onSend', (request, reply, payload, done) => {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
    done(null, payload);
  });
}
