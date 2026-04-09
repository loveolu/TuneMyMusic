import { describe, it, expect } from 'vitest';
import { parseItunesXml } from '../src/adapters/itunes-xml.adapter.js';

// Minimal iTunes XML Library helper
function buildItunesXml(tracks: Array<{
  id: number;
  name: string;
  artist?: string;
  album?: string;
  year?: number;
  durationMs?: number;
  isrc?: string;
  trackType?: string;
}>): string {
  const trackDicts = tracks
    .map(
      (t) => `
    <key>${t.id}</key>
    <dict>
      <key>Track ID</key><integer>${t.id}</integer>
      <key>Name</key><string>${t.name}</string>
      ${t.artist ? `<key>Artist</key><string>${t.artist}</string>` : ''}
      ${t.album ? `<key>Album</key><string>${t.album}</string>` : ''}
      ${t.year ? `<key>Year</key><integer>${t.year}</integer>` : ''}
      ${t.durationMs ? `<key>Total Time</key><integer>${t.durationMs}</integer>` : ''}
      ${t.isrc ? `<key>ISRC</key><string>${t.isrc}</string>` : ''}
      ${t.trackType ? `<key>Track Type</key><string>${t.trackType}</string>` : ''}
    </dict>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Major Version</key><integer>1</integer>
  <key>Minor Version</key><integer>1</integer>
  <key>Tracks</key>
  <dict>
    ${trackDicts}
  </dict>
  <key>Playlists</key>
</dict>
</plist>`;
}

describe('parseItunesXml', () => {
  it('returns empty array for empty input', () => {
    expect(parseItunesXml('')).toEqual([]);
  });

  it('returns empty array when no Tracks key found', () => {
    const xml = `<?xml version="1.0"?><plist><dict></dict></plist>`;
    expect(parseItunesXml(xml)).toEqual([]);
  });

  it('parses a single track with all fields', () => {
    const xml = buildItunesXml([
      {
        id: 1,
        name: 'Bohemian Rhapsody',
        artist: 'Queen',
        album: 'A Night at the Opera',
        year: 1975,
        durationMs: 354000,
        isrc: 'GBUM71029604',
      },
    ]);

    const tracks = parseItunesXml(xml);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].name).toBe('Bohemian Rhapsody');
    expect(tracks[0].artists[0]).toBe('Queen');
    expect(tracks[0].album).toBe('A Night at the Opera');
    expect(tracks[0].releaseYear).toBe(1975);
    expect(tracks[0].durationMs).toBe(354000);
    expect(tracks[0].isrc).toBe('GBUM71029604');
    expect(tracks[0].platformId).toBe('ITUNES_XML');
  });

  it('parses multiple tracks', () => {
    const xml = buildItunesXml([
      { id: 1, name: 'Track One', artist: 'Artist A' },
      { id: 2, name: 'Track Two', artist: 'Artist B' },
      { id: 3, name: 'Track Three', artist: 'Artist C' },
    ]);

    const tracks = parseItunesXml(xml);
    expect(tracks).toHaveLength(3);
    expect(tracks[0].name).toBe('Track One');
    expect(tracks[1].name).toBe('Track Two');
    expect(tracks[2].name).toBe('Track Three');
  });

  it('handles tracks with missing optional fields', () => {
    const xml = buildItunesXml([{ id: 1, name: 'Minimal Track' }]);

    const tracks = parseItunesXml(xml);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].name).toBe('Minimal Track');
    expect(tracks[0].artists).toEqual([]);
    expect(tracks[0].album).toBeUndefined();
    expect(tracks[0].releaseYear).toBeUndefined();
    expect(tracks[0].durationMs).toBeUndefined();
    expect(tracks[0].isrc).toBeUndefined();
  });

  it('assigns platformId ITUNES_XML to each track', () => {
    const xml = buildItunesXml([{ id: 1, name: 'Test Track', artist: 'Test Artist' }]);
    const tracks = parseItunesXml(xml);
    expect(tracks[0].platformId).toBe('ITUNES_XML');
  });

  it('skips tracks without a Name field', () => {
    // Build a custom XML with one track missing Name
    const xml = `<?xml version="1.0"?>
<plist version="1.0"><dict>
  <key>Tracks</key>
  <dict>
    <key>1</key>
    <dict>
      <key>Track ID</key><integer>1</integer>
      <key>Artist</key><string>No Name Band</string>
    </dict>
    <key>2</key>
    <dict>
      <key>Track ID</key><integer>2</integer>
      <key>Name</key><string>Valid Track</string>
      <key>Artist</key><string>Artist</string>
    </dict>
  </dict>
  <key>Playlists</key>
</dict></plist>`;

    const tracks = parseItunesXml(xml);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].name).toBe('Valid Track');
  });

  it('handles artist as empty string gracefully', () => {
    const xml = buildItunesXml([{ id: 1, name: 'Solo Track', artist: '' }]);
    const tracks = parseItunesXml(xml);
    expect(tracks[0].artists).toEqual([]);
  });

  it('parses release year correctly', () => {
    const xml = buildItunesXml([
      { id: 1, name: 'Old Song', year: 1967 },
      { id: 2, name: 'New Song', year: 2023 },
    ]);
    const tracks = parseItunesXml(xml);
    expect(tracks[0].releaseYear).toBe(1967);
    expect(tracks[1].releaseYear).toBe(2023);
  });
});
