import { z } from 'zod';

export const PlatformId = z.enum([
  'SPOTIFY',
  'APPLE_MUSIC',
  'YOUTUBE_MUSIC',
  'AMAZON_MUSIC',
  'TIDAL',
  'DEEZER',
  'SOUNDCLOUD',
  'PANDORA',
  'QOBUZ',
  'NAPSTER',
  'LASTFM',
  'CSV',
  'ITUNES_XML',
]);
export type PlatformId = z.infer<typeof PlatformId>;

export const PLATFORM_META: Record<
  PlatformId,
  { displayName: string; brandColor: string; tier: 1 | 2 | 3 }
> = {
  SPOTIFY: { displayName: 'Spotify', brandColor: '#1DB954', tier: 1 },
  APPLE_MUSIC: { displayName: 'Apple Music', brandColor: '#FC3C44', tier: 1 },
  YOUTUBE_MUSIC: { displayName: 'YouTube Music', brandColor: '#FF0000', tier: 1 },
  AMAZON_MUSIC: { displayName: 'Amazon Music', brandColor: '#00A8E1', tier: 1 },
  TIDAL: { displayName: 'Tidal', brandColor: '#000000', tier: 1 },
  DEEZER: { displayName: 'Deezer', brandColor: '#EF5466', tier: 2 },
  SOUNDCLOUD: { displayName: 'SoundCloud', brandColor: '#FF5500', tier: 2 },
  PANDORA: { displayName: 'Pandora', brandColor: '#3668FF', tier: 2 },
  QOBUZ: { displayName: 'Qobuz', brandColor: '#1D8FE1', tier: 2 },
  NAPSTER: { displayName: 'Napster', brandColor: '#000000', tier: 2 },
  LASTFM: { displayName: 'Last.fm', brandColor: '#D51007', tier: 3 },
  CSV: { displayName: 'CSV / M3U File', brandColor: '#6B7280', tier: 3 },
  ITUNES_XML: { displayName: 'iTunes XML', brandColor: '#FB5BC5', tier: 3 },
};

export const OAuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: z.date(),
  tokenType: z.string().default('Bearer'),
  scope: z.string().optional(),
});
export type OAuthTokens = z.infer<typeof OAuthTokensSchema>;
