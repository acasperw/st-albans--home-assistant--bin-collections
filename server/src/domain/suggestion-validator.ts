import { countPendingSuggestionsBy } from '../repositories/suggestion.repository';

const MIN_MEAL_LENGTH = 2;
const MAX_MEAL_LENGTH = 60;
const MAX_PENDING_PER_PERSON = 3;

/** Words that are clearly not food — kept small and family-appropriate. */
const BLOCKED_WORDS: string[] = [
  'poo', 'poop', 'poopy', 'pee', 'wee', 'bum', 'butt', 'fart', 'booger',
  'snot', 'vomit', 'puke', 'stupid', 'dumb', 'idiot', 'hate', 'kill',
  'die', 'dead', 'blood', 'murder', 'damn', 'crap', 'hell', 'shut up',
  'butthole', 'ass', 'arse', 'bloody', 'bollocks',
];

export interface SuggestionValidation {
  valid: boolean;
  reason?: string;
}

/**
 * Lightweight validation for meal suggestions to curb silly/inappropriate input.
 * Returns `{ valid: true }` or `{ valid: false, reason }`.
 */
export function validateSuggestion(mealName: string, suggestedBy: string): SuggestionValidation {
  const trimmed = mealName.trim();

  if (trimmed.length < MIN_MEAL_LENGTH) {
    return { valid: false, reason: 'That name is too short — try a real meal name!' };
  }
  if (trimmed.length > MAX_MEAL_LENGTH) {
    return { valid: false, reason: 'That name is too long — keep it short and simple.' };
  }

  // Must contain at least one letter.
  if (!/[a-zA-Z]/.test(trimmed)) {
    return { valid: false, reason: 'A meal name needs some actual letters!' };
  }

  // Reject excessive repeated characters (e.g. "aaaaaaa", "hahahaha").
  if (/(.)\1{4,}/i.test(trimmed)) {
    return { valid: false, reason: "That doesn't look like a real meal — no repeating characters please!" };
  }

  // Reject keyboard mashing — long stretches without any vowel.
  const withoutSpaces = trimmed.replace(/\s/g, '');
  if (withoutSpaces.length >= 4 && !/[aeiou]/i.test(withoutSpaces)) {
    return { valid: false, reason: "That doesn't look like a real meal name." };
  }

  const lower = trimmed.toLowerCase();
  for (const word of BLOCKED_WORDS) {
    const matched = word.includes(' ')
      ? lower.includes(word)
      : new RegExp(`\\b${word}\\b`, 'i').test(lower);
    if (matched) {
      return { valid: false, reason: "Let's keep the suggestions to actual meals please! 😄" };
    }
  }

  if (countPendingSuggestionsBy(suggestedBy) >= MAX_PENDING_PER_PERSON) {
    return {
      valid: false,
      reason: `You already have ${MAX_PENDING_PER_PERSON} suggestions waiting — hold tight until they're reviewed!`,
    };
  }

  return { valid: true };
}
