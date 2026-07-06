import type { Track } from '@tunemymusic/types';

/**
 * Parse an iTunes Library XML file and extract tracks.
 * The iTunes XML format uses nested <dict> elements.
 * Track entries live under Library -> Tracks -> <integer key> -> <dict>.
 */
export function parseItunesXml(xmlContent: string): Track[] {
  if (!xmlContent.trim()) return [];

  // Find the start of the Tracks outer dict
  const tracksKeyIdx = xmlContent.indexOf('<key>Tracks</key>');
  if (tracksKeyIdx === -1) return [];

  // Find the opening <dict> that follows <key>Tracks</key>
  const outerDictStart = xmlContent.indexOf('<dict>', tracksKeyIdx);
  if (outerDictStart === -1) return [];

  // Extract the entire Tracks outer dict using balanced-tag counting
  const tracksContent = extractBalancedDict(xmlContent, outerDictStart);
  if (!tracksContent) return [];

  return parseTracksDict(tracksContent);
}

/**
 * Extract the content inside the <dict> starting at `startIdx` (which points at '<dict>').
 * Handles nested <dict>...</dict> pairs by counting depth.
 * Returns the *content* between the outermost <dict> and </dict>.
 */
function extractBalancedDict(xml: string, startIdx: number): string | null {
  // startIdx points to '<dict>'
  let depth = 0;
  let i = startIdx;
  let contentStart = -1;

  while (i < xml.length) {
    const openTag = xml.indexOf('<dict>', i);
    const closeTag = xml.indexOf('</dict>', i);

    if (openTag === -1 && closeTag === -1) break;

    // Determine which comes first
    const nextOpen = openTag === -1 ? Infinity : openTag;
    const nextClose = closeTag === -1 ? Infinity : closeTag;

    if (nextOpen < nextClose) {
      depth++;
      if (depth === 1) {
        contentStart = openTag + 6; // past '<dict>'
      }
      i = openTag + 6;
    } else {
      depth--;
      if (depth === 0) {
        // Found the matching close tag
        return xml.slice(contentStart, closeTag);
      }
      i = closeTag + 7; // past '</dict>'
    }
  }

  return null;
}

function parseTracksDict(dictContent: string): Track[] {
  const tracks: Track[] = [];
  let searchFrom = 0;
  let idx = 0;

  // Each track entry starts with <key>DIGITS</key> followed by a <dict>
  const keyRegex = /<key>(\d+)<\/key>\s*<dict>/g;

  let keyMatch: RegExpExecArray | null;
  while ((keyMatch = keyRegex.exec(dictContent)) !== null) {
    // Find the start of the <dict> for this track
    const dictStartIdx = dictContent.indexOf('<dict>', keyMatch.index + keyMatch[0].indexOf('<dict>'));
    if (dictStartIdx === -1) continue;

    // Extract the track dict contents
    const trackContent = extractBalancedDict(dictContent, dictStartIdx);
    if (!trackContent) continue;

    const trackData = parseDictEntries(trackContent);

    // Skip podcast, video, etc.
    const kind = (trackData['Track Type'] ?? '').toLowerCase();
    if (kind && kind !== 'file' && !kind.includes('audio') && !kind.includes('music')) {
      continue;
    }

    const name = trackData['Name'];
    if (!name) continue;

    const artist = trackData['Artist'];
    const album = trackData['Album'];
    const isrc = trackData['ISRC'];
    const durationMs = trackData['Total Time'] ? parseInt(trackData['Total Time'], 10) : undefined;
    const releaseYearStr = trackData['Year'];
    const releaseYear = releaseYearStr ? parseInt(releaseYearStr, 10) : undefined;

    tracks.push({
      id: `itunes-${idx++}`,
      name,
      artists: artist ? [artist] : [],
      album: album || undefined,
      isrc: isrc || undefined,
      durationMs: Number.isFinite(durationMs) ? durationMs : undefined,
      releaseYear: Number.isFinite(releaseYear) ? releaseYear : undefined,
      platformId: 'ITUNES_XML',
    });
  }

  return tracks;
}

/**
 * Parse key-value pairs from an iTunes dict element content (without outer <dict> tags).
 * Returns a plain string map.
 */
function parseDictEntries(dictContent: string): Record<string, string> {
  const result: Record<string, string> = {};

  // Match <key>K</key><string>V</string> or <key>K</key><integer>V</integer> or <key>K</key><real>V</real>
  const pairRegex = /<key>([^<]+)<\/key>\s*(?:<string>([^<]*)<\/string>|<integer>([^<]*)<\/integer>|<real>([^<]*)<\/real>)/g;
  let match: RegExpExecArray | null;

  while ((match = pairRegex.exec(dictContent)) !== null) {
    const key = match[1].trim();
    const value = (match[2] ?? match[3] ?? match[4] ?? '').trim();
    result[key] = value;
  }

  return result;
}
