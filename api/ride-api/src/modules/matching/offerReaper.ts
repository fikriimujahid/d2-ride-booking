import type { FastifyInstance } from 'fastify';

export function startOfferReaper(app: FastifyInstance, intervalMs: number) {
  const handle = setInterval(async () => {
    try {
      await app.db.query(
        `update rides
            set status = 'requested',
                offered_driver_id = null,
                offer_expires_at = null,
                updated_at = now()
          where status = 'offered'
            and offer_expires_at is not null
            and offer_expires_at < now()`
      );
    } catch (err) {
      app.log.warn({ err }, 'offer reaper failed');
    }
  }, intervalMs);

  app.addHook('onClose', async () => {
    clearInterval(handle);
  });
}
