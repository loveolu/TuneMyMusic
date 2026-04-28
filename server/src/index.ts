import { buildApp } from './app.js';
import { config } from './config.js';
import { prisma } from './prisma.js';
import { startTransferWorker, transferQueue } from './workers/transfer.worker.js';
import { startSyncWorker, syncQueue } from './workers/sync.worker.js';
import { startEmailWorker, emailQueue } from './workers/email.worker.js';
import { closeRedisProbe } from './services/redis-health.js';
import type { Worker } from 'bullmq';

/**
 * Graceful-shutdown timeout. After this many ms we give up draining workers
 * and exit anyway. Tuned for transfer jobs which can legitimately take 1–2
 * minutes per playlist; if you push past 30s the orchestrator will SIGKILL
 * us anyway. Override via SHUTDOWN_TIMEOUT_MS env.
 */
const SHUTDOWN_TIMEOUT_MS = parseInt(process.env.SHUTDOWN_TIMEOUT_MS ?? '30000', 10);

let shuttingDown = false;

async function main() {
  const app = await buildApp();
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`Server listening on http://${config.host}:${config.port}`);

  // Start BullMQ workers. Capture the Worker instances so we can drain them
  // cleanly on shutdown. Each worker.close() finishes any in-flight job
  // before resolving, which is exactly what we want here.
  const transferWorker = startTransferWorker();
  app.log.info('Transfer worker started');

  const syncWorker = startSyncWorker();
  app.log.info('Sync worker started');

  const emailWorker = startEmailWorker();
  app.log.info('Email worker started');

  // Single shutdown handler used by SIGTERM / SIGINT and unhandled rejection.
  // Idempotent: a second signal during shutdown is a no-op.
  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) {
      app.log.warn({ signal }, 'shutdown already in progress, ignoring');
      return;
    }
    shuttingDown = true;
    app.log.info({ signal }, 'graceful shutdown initiated');

    // Hard ceiling — if we're stuck draining a long job, exit anyway after
    // the configured timeout so the orchestrator doesn't escalate to SIGKILL.
    const killTimer = setTimeout(() => {
      app.log.error(
        { timeoutMs: SHUTDOWN_TIMEOUT_MS },
        'shutdown timeout exceeded, forcing exit',
      );
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    killTimer.unref();

    try {
      // 1. Stop accepting new HTTP requests. In-flight requests get to finish.
      await app.close();
      app.log.info('HTTP server closed');

      // 2. Drain BullMQ workers in parallel. `worker.close()` waits for any
      //    actively-running job to finish before resolving. Any job still
      //    waiting in the queue stays there for the next process to pick up
      //    — DO NOT delete the queue itself.
      await drainWorkers([transferWorker, syncWorker, emailWorker], app.log);

      // 3. Disconnect the queue clients (they hold their own Redis sockets
      //    separate from each Worker's blocking client).
      await Promise.allSettled([transferQueue.close(), syncQueue.close(), emailQueue.close()]);
      app.log.info('BullMQ queues closed');

      // 4. Tear down Postgres + the Redis health-probe socket.
      await Promise.allSettled([prisma.$disconnect(), closeRedisProbe()]);
      app.log.info('Database and Redis probe disconnected');

      clearTimeout(killTimer);
      app.log.info('graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'error during shutdown');
      clearTimeout(killTimer);
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    app.log.error({ reason }, 'unhandledRejection');
  });

  process.on('uncaughtException', (err) => {
    app.log.fatal({ err }, 'uncaughtException — shutting down');
    void shutdown('uncaughtException');
  });
}

async function drainWorkers(workers: Worker[], log: { info: (...a: unknown[]) => void }): Promise<void> {
  log.info({ count: workers.length }, 'draining BullMQ workers (waiting for in-flight jobs)');
  // Pass `false` to NOT force-close — let active jobs finish.
  await Promise.allSettled(workers.map((w) => w.close(false)));
  log.info('all workers drained');
}

main().catch((err) => {
  console.error('fatal startup error:', err);
  process.exit(1);
});
