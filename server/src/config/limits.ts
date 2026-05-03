/**
 * Centralised validation limits for API inputs.
 * Imported by route handlers to keep validation consistent and avoid magic numbers.
 */
export const LIMITS = {
  // Timers
  TIMER_NAME_MAX: 50,
  TIMER_DURATION_MAX_SECS: 24 * 60 * 60, // 24 hours
  MAX_ACTIVE_TIMERS: 10,

  // Cooking plan
  COOKING_PLAN_NAME_MAX: 50,
  COOKING_PLAN_MAX_ITEMS: 20,
  COOKING_PLAN_MAX_COOK_MINS: 1440, // 24 hours
  COOKING_PLAN_MAX_REST_MINS: 1440,
} as const;
