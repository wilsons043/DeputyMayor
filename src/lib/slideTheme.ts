/**
 * Municipal slide theme: dark blue / gold, punchline typography (max 15 words).
 */

export const MUNI = {
  blue: '#0f2847',
  blueMid: '#1e3a5f',
  blueLight: '#2d4a6f',
  gold: '#c9a227',
  goldLight: '#e5c158',
  white: '#ffffff',
  overlay: 'rgba(15, 40, 71, 0.85)',
} as const;

export const PUNCHLINE_MAX_WORDS = 15;

export function toPunchline(text: string, maxWords = PUNCHLINE_MAX_WORDS): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(' ');
}

export function bulletPoints(text: string, max = 3): string[] {
  const lines = text
    .split(/\n+/)
    .map((s) => s.replace(/^[•\-\*]\s*/, '').trim())
    .filter(Boolean);
  return lines.slice(0, max);
}
