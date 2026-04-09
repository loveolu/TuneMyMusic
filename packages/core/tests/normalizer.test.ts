import { describe, it, expect } from 'vitest';
import { normalizeTrackName, normalizeArtistName } from '../src/matching/normalizer.js';

describe('normalizeTrackName', () => {
  it('lowercases the name', () => {
    expect(normalizeTrackName('Bohemian Rhapsody')).toBe('bohemian rhapsody');
  });

  it('removes feat. parenthetical', () => {
    expect(normalizeTrackName('Song (feat. Artist)')).toBe('song');
  });

  it('removes ft. parenthetical', () => {
    expect(normalizeTrackName('Song (ft. Artist)')).toBe('song');
  });

  it('removes [Remastered] brackets', () => {
    expect(normalizeTrackName('Song [Remastered 2011]')).toBe('song');
  });

  it('removes (Live) parenthetical', () => {
    expect(normalizeTrackName('Song (Live)')).toBe('song');
  });

  it('removes (Deluxe Edition)', () => {
    expect(normalizeTrackName('Song (Deluxe Edition)')).toBe('song');
  });

  it('removes extra whitespace', () => {
    expect(normalizeTrackName('  Song   Name  ')).toBe('song name');
  });

  it('removes punctuation except spaces', () => {
    expect(normalizeTrackName("Don't Stop Me Now!")).toBe('dont stop me now');
  });

  it('handles combined cases', () => {
    expect(normalizeTrackName('Song Title (feat. X) [Remastered 2020]')).toBe('song title');
  });
});

describe('normalizeArtistName', () => {
  it('lowercases the name', () => {
    expect(normalizeArtistName('The Beatles')).toBe('beatles');
  });

  it('removes leading "The"', () => {
    expect(normalizeArtistName('The Rolling Stones')).toBe('rolling stones');
  });

  it('removes punctuation', () => {
    expect(normalizeArtistName('AC/DC')).toBe('acdc');
  });

  it('trims whitespace', () => {
    expect(normalizeArtistName('  Queen  ')).toBe('queen');
  });
});
