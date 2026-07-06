export const PLATFORM_CONFIG: Record<string, { name: string; color: string; emoji: string }> = {
  SPOTIFY: { name: 'Spotify', color: '#1DB954', emoji: '🎵' },
  APPLE_MUSIC: { name: 'Apple Music', color: '#FC3C44', emoji: '🍎' },
  YOUTUBE_MUSIC: { name: 'YouTube Music', color: '#FF0000', emoji: '▶' },
  AMAZON_MUSIC: { name: 'Amazon Music', color: '#00A8E1', emoji: '📦' },
  TIDAL: { name: 'Tidal', color: '#00FFFF', emoji: '🌊' },
  DEEZER: { name: 'Deezer', color: '#EF5466', emoji: '🎧' },
  SOUNDCLOUD: { name: 'SoundCloud', color: '#FF5500', emoji: '☁' },
  PANDORA: { name: 'Pandora', color: '#3668FF', emoji: '📻' },
  QOBUZ: { name: 'Qobuz', color: '#1D8FE1', emoji: '🎼' },
  NAPSTER: { name: 'Napster', color: '#888888', emoji: '🐱' },
  LASTFM: { name: 'Last.fm', color: '#D51007', emoji: '📊' },
  CSV: { name: 'CSV / M3U File', color: '#6B7280', emoji: '📄' },
  ITUNES_XML: { name: 'iTunes XML', color: '#FB5BC5', emoji: '🎹' },
};

export const TIER_1_PLATFORMS = ['SPOTIFY', 'APPLE_MUSIC', 'YOUTUBE_MUSIC', 'AMAZON_MUSIC', 'TIDAL'];
export const TIER_2_PLATFORMS = ['DEEZER', 'SOUNDCLOUD', 'PANDORA', 'QOBUZ', 'NAPSTER'];
export const TIER_3_PLATFORMS = ['LASTFM', 'CSV', 'ITUNES_XML'];

export const ALL_PLATFORMS = [...TIER_1_PLATFORMS, ...TIER_2_PLATFORMS, ...TIER_3_PLATFORMS];

export const PLANS = {
  FREE: { name: 'Free', price: 0, transfers: 3, color: '#8A8A8F' },
  PRO: { name: 'Pro', price: 4.99, transfers: 50, color: '#E8FF47' },
  UNLIMITED: { name: 'Unlimited', price: 9.99, transfers: -1, color: '#4ADE80' },
};
