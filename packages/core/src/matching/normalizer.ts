const BRACKET_PATTERNS = [
  /\s*\(feat\.?\s+[^)]*\)/gi,
  /\s*\(ft\.?\s+[^)]*\)/gi,
  /\s*\(with\s+[^)]*\)/gi,
  /\s*\[remastered[^\]]*\]/gi,
  /\s*\(remastered[^)]*\)/gi,
  /\s*\(live[^)]*\)/gi,
  /\s*\[live[^\]]*\]/gi,
  /\s*\(deluxe[^)]*\)/gi,
  /\s*\(bonus[^)]*\)/gi,
  /\s*\(radio edit\)/gi,
  /\s*\(explicit\)/gi,
  /\s*\(clean\)/gi,
  /\s*-\s*remastered\s*\d*/gi,
];

export function normalizeTrackName(name: string): string {
  let result = name.toLowerCase();
  for (const pattern of BRACKET_PATTERNS) {
    result = result.replace(pattern, '');
  }
  result = result.replace(/[^\w\s]/g, '');
  result = result.replace(/\s+/g, ' ').trim();
  return result;
}

export function normalizeArtistName(name: string): string {
  let result = name.toLowerCase().trim();
  result = result.replace(/^the\s+/i, '');
  result = result.replace(/[^\w\s]/g, '');
  result = result.replace(/\s+/g, ' ').trim();
  return result;
}
