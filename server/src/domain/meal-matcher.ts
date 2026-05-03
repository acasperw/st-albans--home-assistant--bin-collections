import { distance as levenshtein } from 'fastest-levenshtein';
import { getAllMeals } from '../repositories/meal.repository';
import { getPendingSuggestions } from '../repositories/suggestion.repository';

// Normalised Levenshtein similarity: 1 - (editDistance / maxLength)
// 0.55 catches most single/double-char typos while avoiding false positives.
const SIMILARITY_THRESHOLD = 0.55;
const DEBUG = process.env.NODE_ENV !== 'production';

export interface NearMatch {
  name: string;
  score: number;
}

export interface LibraryMatch {
  id: number;
  name: string;
}

/** Normalise a meal name: trim, collapse whitespace, title-case. */
export function normalizeMealName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/** Normalised similarity between two strings (0–1, higher = more similar). */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/** Pull all known meal names from library + pending suggestions, deduplicated. */
function getAllKnownNames(): string[] {
  const libraryNames = getAllMeals().map(m => m.name);
  const pendingNames = getPendingSuggestions().map(s => s.meal_name);
  return [...new Set([...libraryNames, ...pendingNames])];
}

/** Find the closest fuzzy match. Returns `null` for exact matches (use `findExactMatch`). */
export function findNearMatch(input: string): NearMatch | null {
  const normalised = normalizeMealName(input).toLowerCase();
  const allNames = getAllKnownNames();
  if (allNames.length === 0) return null;

  // Exact matches are handled separately.
  if (allNames.some(n => n.toLowerCase() === normalised)) return null;

  let bestScore = 0;
  let bestName: string | null = null;

  for (const name of allNames) {
    const score = similarity(normalised, name.toLowerCase());
    if (DEBUG) {
      console.log(`  [fuzzy] "${normalised}" vs "${name}" → ${score.toFixed(3)}`);
    }
    if (score > bestScore) {
      bestScore = score;
      bestName = name;
    }
  }

  if (DEBUG) {
    console.log(
      `  [fuzzy] Best: "${bestName}" (${bestScore.toFixed(3)}), threshold: ${SIMILARITY_THRESHOLD}, ${bestScore >= SIMILARITY_THRESHOLD ? 'MATCH' : 'no match'}`,
    );
  }

  return bestName && bestScore >= SIMILARITY_THRESHOLD
    ? { name: bestName, score: bestScore }
    : null;
}

/** Case-insensitive exact match against library + pending suggestions. */
export function findExactMatch(input: string): string | null {
  const normalised = normalizeMealName(input).toLowerCase();
  return getAllKnownNames().find(n => n.toLowerCase() === normalised) ?? null;
}

/** Case-insensitive exact match against the meal library only. */
export function findExactLibraryMatch(input: string): LibraryMatch | null {
  const normalised = normalizeMealName(input).toLowerCase();
  const meal = getAllMeals().find(m => m.name.toLowerCase() === normalised);
  return meal ? { id: meal.id, name: meal.name } : null;
}

/** Case-insensitive exact match against pending suggestions only (excludes library). */
export function findExactPendingMatch(input: string): string | null {
  if (findExactLibraryMatch(input)) return null;
  const normalised = normalizeMealName(input).toLowerCase();
  return getPendingSuggestions()
    .map(s => s.meal_name)
    .find(n => n.toLowerCase() === normalised) ?? null;
}
