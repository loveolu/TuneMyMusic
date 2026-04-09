import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/require-auth.js';
import { prisma } from '../prisma.js';
import { adapterRegistry } from '../services/adapter-registry.js';
import { getValidTokens } from '../services/token-service.js';
import type { Track } from '@tunemymusic/types';

export interface UserStats {
  totalTransfers: number;
  totalTracksTransferred: number;
  avgMatchRate: number;
  platforms: PlatformStats[];
  recentlyPlayed: RecentTrack[];
  transferStatusBreakdown: Record<string, number>;
}

export interface PlatformStats {
  platform: string;
  transferCount: number;
  tracksTransferred: number;
}

export interface RecentTrack {
  platform: string;
  track: Track;
}

export async function statsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET /api/user/stats
  app.get('/stats', async (request, reply) => {
    const userId = request.userId;

    // Aggregate transfer stats from DB
    const [transfers, transfersByStatus] = await Promise.all([
      prisma.transfer.findMany({
        where: { userId },
        select: {
          sourcePlatform: true,
          destinationPlatform: true,
          status: true,
          totalTracks: true,
          matchedTracks: true,
          matchRate: true,
        },
      }),
      prisma.transfer.groupBy({
        by: ['status'],
        where: { userId },
        _count: { _all: true },
      }),
    ]);

    const totalTransfers = transfers.length;
    const totalTracksTransferred = transfers.reduce((sum, t) => sum + (t.matchedTracks ?? 0), 0);
    const matchRates = transfers.filter((t) => t.matchRate > 0).map((t) => t.matchRate);
    const avgMatchRate =
      matchRates.length > 0 ? matchRates.reduce((a, b) => a + b, 0) / matchRates.length : 0;

    // Per-platform breakdown
    const platformMap = new Map<string, { transferCount: number; tracksTransferred: number }>();

    for (const t of transfers) {
      for (const platform of [t.sourcePlatform, t.destinationPlatform]) {
        const p = platform as string;
        if (!platformMap.has(p)) platformMap.set(p, { transferCount: 0, tracksTransferred: 0 });
        const entry = platformMap.get(p)!;
        entry.transferCount++;
        entry.tracksTransferred += t.matchedTracks ?? 0;
      }
    }

    const platforms: PlatformStats[] = Array.from(platformMap.entries()).map(
      ([platform, data]) => ({ platform, ...data }),
    );

    // Status breakdown
    const transferStatusBreakdown: Record<string, number> = {};
    for (const row of transfersByStatus) {
      transferStatusBreakdown[row.status] = row._count._all;
    }

    // Recently played (Spotify only for now — only platform with reliable recent-plays API)
    const recentlyPlayed: RecentTrack[] = [];

    const spotifyConn = await prisma.platformConnection.findFirst({
      where: { userId, platform: 'SPOTIFY', isActive: true },
    });

    if (spotifyConn) {
      try {
        const adapter = adapterRegistry.getAdapter('SPOTIFY');
        const token = await getValidTokens(spotifyConn.id);

        // Fetch recently played via direct API call through the Spotify adapter
        // The base adapter doesn't expose recently-played, so we call it via the raw HTTP approach
        const resp = await fetch(
          'https://api.spotify.com/v1/me/player/recently-played?limit=20',
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (resp.ok) {
          const data = (await resp.json()) as any;
          const items: any[] = data?.items ?? [];

          for (const item of items) {
            const t = item?.track;
            if (!t) continue;
            recentlyPlayed.push({
              platform: 'SPOTIFY',
              track: {
                id: t.id ?? '',
                name: t.name ?? '',
                artists: (t.artists ?? []).map((a: any) => a.name ?? ''),
                album: t.album?.name,
                durationMs: t.duration_ms,
                isrc: t.external_ids?.isrc,
                platformId: 'SPOTIFY',
                platformTrackId: t.id,
              },
            });
          }
        }
      } catch {
        // Non-fatal – stats still work without recently played
      }
    }

    const stats: UserStats = {
      totalTransfers,
      totalTracksTransferred,
      avgMatchRate: Math.round(avgMatchRate * 10) / 10,
      platforms,
      recentlyPlayed,
      transferStatusBreakdown,
    };

    return reply.send({ stats });
  });
}
