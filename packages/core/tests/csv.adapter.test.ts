import { describe, it, expect } from 'vitest';
import { parseCsv, parseM3u } from '../src/adapters/csv.adapter.js';

// ─── CSV Parser ───────────────────────────────────────────────────────────────

describe('parseCsv', () => {
  it('returns empty array for empty input', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('   \n  ')).toEqual([]);
  });

  it('parses header-less CSV with positional columns', () => {
    const csv = `Bohemian Rhapsody,Queen,A Night at the Opera
Hotel California,Eagles,Hotel California`;

    const tracks = parseCsv(csv);
    expect(tracks).toHaveLength(2);
    expect(tracks[0].name).toBe('Bohemian Rhapsody');
    expect(tracks[0].artists[0]).toBe('Queen');
    expect(tracks[0].album).toBe('A Night at the Opera');
    expect(tracks[1].name).toBe('Hotel California');
    expect(tracks[1].artists[0]).toBe('Eagles');
  });

  it('parses CSV with header row (name, artist, album)', () => {
    const csv = `Track Name,Artist,Album
Thriller,Michael Jackson,Thriller
Purple Rain,Prince,Purple Rain`;

    const tracks = parseCsv(csv);
    expect(tracks).toHaveLength(2);
    expect(tracks[0].name).toBe('Thriller');
    expect(tracks[0].artists[0]).toBe('Michael Jackson');
    expect(tracks[0].album).toBe('Thriller');
    expect(tracks[1].name).toBe('Purple Rain');
  });

  it('handles quoted fields with commas inside', () => {
    const csv = `"Hello, World",Artist,Album
Simple Track,Artist2,Album2`;

    const tracks = parseCsv(csv);
    expect(tracks[0].name).toBe('Hello, World');
    expect(tracks[1].name).toBe('Simple Track');
  });

  it('handles quoted fields with escaped double-quotes', () => {
    const csv = `"Say ""Hello"" To Me",Singer,Album`;
    const tracks = parseCsv(csv);
    expect(tracks[0].name).toBe('Say "Hello" To Me');
  });

  it('skips rows with empty track name', () => {
    const csv = `,Empty Artist,
Valid Track,Artist,Album`;
    const tracks = parseCsv(csv);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].name).toBe('Valid Track');
  });

  it('handles CSV with only two columns (name + artist)', () => {
    const csv = `Song Name,Artist
Track One,Artist One`;
    const tracks = parseCsv(csv);
    expect(tracks[0].name).toBe('Track One');
    expect(tracks[0].artists[0]).toBe('Artist One');
  });

  it('assigns platformId CSV to each track', () => {
    const csv = `Track,Artist\nSong,Band`;
    const tracks = parseCsv(csv);
    expect(tracks[0].platformId).toBe('CSV');
  });

  it('handles Windows-style CRLF line endings', () => {
    const csv = 'Track Name,Artist,Album\r\nSong One,Band One,Album One\r\nSong Two,Band Two,Album Two';
    const tracks = parseCsv(csv);
    expect(tracks).toHaveLength(2);
    expect(tracks[0].name).toBe('Song One');
    expect(tracks[1].name).toBe('Song Two');
  });
});

// ─── M3U Parser ───────────────────────────────────────────────────────────────

describe('parseM3u', () => {
  it('returns empty array for empty input', () => {
    expect(parseM3u('')).toEqual([]);
  });

  it('parses a basic M3U file without EXTINF', () => {
    const m3u = `#EXTM3U
/music/song1.mp3
/music/song2.flac`;

    const tracks = parseM3u(m3u);
    expect(tracks).toHaveLength(2);
    expect(tracks[0].name).toBe('song1');
    expect(tracks[1].name).toBe('song2');
  });

  it('parses EXTINF metadata (artist - title format)', () => {
    const m3u = `#EXTM3U
#EXTINF:243,Queen - Bohemian Rhapsody
/music/bohemian-rhapsody.mp3
#EXTINF:391,Eagles - Hotel California
/music/hotel-california.mp3`;

    const tracks = parseM3u(m3u);
    expect(tracks).toHaveLength(2);
    expect(tracks[0].name).toBe('Bohemian Rhapsody');
    expect(tracks[0].artists[0]).toBe('Queen');
    expect(tracks[1].name).toBe('Hotel California');
    expect(tracks[1].artists[0]).toBe('Eagles');
  });

  it('handles EXTINF with title only (no artist dash)', () => {
    const m3u = `#EXTM3U
#EXTINF:180,Just A Title
/music/track.mp3`;

    const tracks = parseM3u(m3u);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].name).toBe('Just A Title');
    expect(tracks[0].artists).toEqual([]);
  });

  it('ignores comment lines (starting with #) other than EXTINF', () => {
    const m3u = `#EXTM3U
# This is a comment
#EXTINF:100,Artist - Song
/music/song.mp3`;

    const tracks = parseM3u(m3u);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].name).toBe('Song');
  });

  it('handles HTTP URLs as track paths', () => {
    const m3u = `#EXTM3U
#EXTINF:200,Band - Hit Song
http://example.com/stream/song.mp3`;

    const tracks = parseM3u(m3u);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].name).toBe('Hit Song');
  });

  it('assigns platformId CSV to each track', () => {
    const m3u = `#EXTM3U\n#EXTINF:100,A - B\n/path/to/file.mp3`;
    const tracks = parseM3u(m3u);
    expect(tracks[0].platformId).toBe('CSV');
  });
});
