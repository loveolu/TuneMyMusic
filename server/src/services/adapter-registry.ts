import {
  SpotifyAdapter,
  YouTubeMusicAdapter,
  AppleMusicAdapter,
  AmazonMusicAdapter,
  TidalAdapter,
  DeezerAdapter,
  SoundCloudAdapter,
  PandoraAdapter,
} from '@tunemymusic/core';
import type { MusicPlatformAdapter } from '@tunemymusic/core';
import type { PlatformId } from '@tunemymusic/types';

type SupportedPlatformId = Extract<
  PlatformId,
  'SPOTIFY' | 'YOUTUBE_MUSIC' | 'APPLE_MUSIC' | 'AMAZON_MUSIC' | 'TIDAL' | 'DEEZER' | 'SOUNDCLOUD' | 'PANDORA'
>;

class AdapterRegistry {
  private cache = new Map<SupportedPlatformId, MusicPlatformAdapter>();

  getAdapter(platform: PlatformId): MusicPlatformAdapter {
    const supported = platform as SupportedPlatformId;

    if (this.cache.has(supported)) {
      return this.cache.get(supported)!;
    }

    let adapter: MusicPlatformAdapter;

    switch (platform) {
      case 'SPOTIFY': {
        const clientId = process.env.SPOTIFY_CLIENT_ID;
        const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          throw new Error('Spotify adapter unavailable: missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET');
        }
        adapter = new SpotifyAdapter({ clientId, clientSecret });
        break;
      }
      case 'YOUTUBE_MUSIC': {
        const clientId = process.env.YOUTUBE_CLIENT_ID;
        const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          throw new Error('YouTube Music adapter unavailable: missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET');
        }
        adapter = new YouTubeMusicAdapter({ clientId, clientSecret });
        break;
      }
      case 'APPLE_MUSIC': {
        const keyId = process.env.APPLE_KEY_ID;
        const teamId = process.env.APPLE_TEAM_ID;
        const privateKey = process.env.APPLE_PRIVATE_KEY;
        if (!keyId || !teamId || !privateKey) {
          throw new Error('Apple Music adapter unavailable: missing APPLE_KEY_ID, APPLE_TEAM_ID, or APPLE_PRIVATE_KEY');
        }
        adapter = new AppleMusicAdapter({ keyId, teamId, privateKey });
        break;
      }
      case 'AMAZON_MUSIC': {
        const clientId = process.env.AMAZON_CLIENT_ID;
        const clientSecret = process.env.AMAZON_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          throw new Error('Amazon Music adapter unavailable: missing AMAZON_CLIENT_ID or AMAZON_CLIENT_SECRET');
        }
        adapter = new AmazonMusicAdapter({ clientId, clientSecret });
        break;
      }
      case 'TIDAL': {
        const clientId = process.env.TIDAL_CLIENT_ID;
        const clientSecret = process.env.TIDAL_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          throw new Error('Tidal adapter unavailable: missing TIDAL_CLIENT_ID or TIDAL_CLIENT_SECRET');
        }
        adapter = new TidalAdapter({ clientId, clientSecret });
        break;
      }
      case 'DEEZER': {
        const appId = process.env.DEEZER_APP_ID;
        const appSecret = process.env.DEEZER_APP_SECRET;
        if (!appId || !appSecret) {
          throw new Error('Deezer adapter unavailable: missing DEEZER_APP_ID or DEEZER_APP_SECRET');
        }
        adapter = new DeezerAdapter({ appId, appSecret });
        break;
      }
      case 'SOUNDCLOUD': {
        const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
        const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          throw new Error('SoundCloud adapter unavailable: missing SOUNDCLOUD_CLIENT_ID or SOUNDCLOUD_CLIENT_SECRET');
        }
        adapter = new SoundCloudAdapter({ clientId, clientSecret });
        break;
      }
      case 'PANDORA': {
        const clientId = process.env.PANDORA_CLIENT_ID;
        const clientSecret = process.env.PANDORA_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          throw new Error('Pandora adapter unavailable: missing PANDORA_CLIENT_ID or PANDORA_CLIENT_SECRET');
        }
        adapter = new PandoraAdapter({ clientId, clientSecret });
        break;
      }
      default:
        throw new Error(`Platform not supported: ${platform}`);
    }

    this.cache.set(supported, adapter);
    return adapter;
  }
}

export const adapterRegistry = new AdapterRegistry();
