import type { Track } from '@tunemymusic/types';

/**
 * Parse a CSV string into Track objects.
 * Expected columns (order-insensitive if header row present):
 *   track name, artist, album (optional)
 *
 * Falls back to positional parsing (col 0 = name, col 1 = artist, col 2 = album)
 * when no header row is detected.
 */
export function parseCsv(csvContent: string): Track[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  // Detect header row: the first column must itself be a header keyword.
  // Using only the first column avoids false positives when actual data values
  // in other columns (e.g. "Artist", "Album") match header keywords.
  const firstCols = splitCsvRow(lines[0]).map((h) => h.toLowerCase().trim());
  const firstColHeaderKeywords = ['track', 'track name', 'title', 'song', 'song name', 'name'];
  const hasHeader = firstColHeaderKeywords.includes(firstCols[0] ?? '');

  let nameIdx = 0;
  let artistIdx = 1;
  let albumIdx = 2;
  let startLine = 0;

  if (hasHeader) {
    const headers = splitCsvRow(lines[0]).map((h) => h.toLowerCase().trim());
    nameIdx = findHeaderIndex(headers, ['track', 'title', 'song', 'name']) ?? 0;
    artistIdx = findHeaderIndex(headers, ['artist', 'artist name', 'performer']) ?? 1;
    albumIdx = findHeaderIndex(headers, ['album', 'album name', 'release']) ?? 2;
    startLine = 1;
  }

  const tracks: Track[] = [];

  for (let i = startLine; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    if (cols.length === 0) continue;

    const name = (cols[nameIdx] ?? '').trim();
    const artist = (cols[artistIdx] ?? '').trim();
    const album = albumIdx < cols.length ? (cols[albumIdx] ?? '').trim() : undefined;

    if (!name) continue;

    tracks.push({
      id: `csv-${i}`,
      name,
      artists: artist ? [artist] : [],
      album: album || undefined,
      platformId: 'CSV',
    });
  }

  return tracks;
}

/**
 * Parse an M3U/M3U8 playlist string into Track objects.
 * Handles #EXTINF tags for metadata extraction.
 */
export function parseM3u(m3uContent: string): Track[] {
  const lines = m3uContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const tracks: Track[] = [];
  let pendingName: string | undefined;
  let pendingArtist: string | undefined;
  let idx = 0;

  for (const line of lines) {
    if (line.startsWith('#EXTM3U')) continue;

    if (line.startsWith('#EXTINF:')) {
      // #EXTINF:<duration>,<Artist> - <Title>
      const meta = line.slice(8); // remove #EXTINF:
      const commaIdx = meta.indexOf(',');
      if (commaIdx !== -1) {
        const titlePart = meta.slice(commaIdx + 1).trim();
        const dashIdx = titlePart.indexOf(' - ');
        if (dashIdx !== -1) {
          pendingArtist = titlePart.slice(0, dashIdx).trim();
          pendingName = titlePart.slice(dashIdx + 3).trim();
        } else {
          pendingName = titlePart;
          pendingArtist = undefined;
        }
      }
      continue;
    }

    if (line.startsWith('#')) continue;

    // This is a URL or file path
    const name = pendingName ?? extractNameFromPath(line);
    const artist = pendingArtist;

    tracks.push({
      id: `m3u-${idx++}`,
      name,
      artists: artist ? [artist] : [],
      platformId: 'CSV',
    });

    pendingName = undefined;
    pendingArtist = undefined;
  }

  return tracks;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function findHeaderIndex(headers: string[], candidates: string[]): number | undefined {
  for (const candidate of candidates) {
    const idx = headers.findIndex((h) => h === candidate || h.includes(candidate));
    if (idx !== -1) return idx;
  }
  return undefined;
}

function splitCsvRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];

    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function extractNameFromPath(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  const filename = parts[parts.length - 1] ?? filePath;
  // Remove extension
  return filename.replace(/\.[^/.]+$/, '');
}
