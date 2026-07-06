/**
 * Lightweight Redis health-check connection.
 *
 * Kept on a SEPARATE ioredis instance from the BullMQ workers (which require
 * `maxRetriesPerRequest: null` to enable blocking commands like BLPOP). The
 * workers' connection mode would mask Redis outages here — a `PING` would
 * just queue forever instead of failing fast — so we use a default-config
 * client for probes.
 *
 * Lazy-connects on first call. Reused across `/healthz` probes so we don't
 * thrash TCP sockets.
 */
import Redis from 'ioredis';
import { config } from '../config.js';

let probe: Redis | null = null;

function getProbe(): Redis {
  if (probe) return probe;
  probe = new Redis(config.redisUrl, {
    // Default retry strategy — keep it short so /healthz fails fast on outage.
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 1500,
    lazyConnect: true,
  });
  // Swallow connection errors — they'll surface on the next pingRedis() call
  // and the unhandled error would otherwise crash the process.
  probe.on('error', () => {});
  return probe;
}

export async function pingRedis(): Promise<'PONG'> {
  const client = getProbe();
  const reply = await client.ping();
  if (reply !== 'PONG') {
    throw new Error(`Unexpected PING reply: ${reply}`);
  }
  return reply;
}

export async function closeRedisProbe(): Promise<void> {
  if (!probe) return;
  try {
    await probe.quit();
  } catch {
    // ignore — we're shutting down anyway
  } finally {
    probe = null;
  }
}
