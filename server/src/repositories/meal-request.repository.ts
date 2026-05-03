import { getDb } from '../services/db';

export interface MealRequest {
  id: number;
  meal_id: number;
  requested_by: string;
  created_at: string;
}

export interface MealRequestResult {
  success: boolean;
  reason?: string;
}

/**
 * Record a request (vote) for an existing library meal.
 * Returns `{ success: false, reason }` if the same person already requested this meal today.
 */
export function addMealRequest(mealId: number, requestedBy: string): MealRequestResult {
  // Anti-spam: same person + same meal + same UTC day.
  // Note: `date(created_at)` returns the UTC date because rows are inserted with
  // SQLite's `datetime('now')`, which is UTC. We deliberately use the UTC date
  // here (not the user's local date) so the comparison stays consistent.
  const todayUtc = new Date().toISOString().split('T')[0];
  const existing = getDb().prepare(
    "SELECT COUNT(*) as count FROM meal_requests WHERE meal_id = ? AND LOWER(requested_by) = LOWER(?) AND date(created_at) = ?",
  ).get(mealId, requestedBy.trim(), todayUtc) as { count: number };

  if (existing.count > 0) {
    return { success: false, reason: "You've already requested this meal today — we got the message! 😊" };
  }

  // Opportunistic cleanup of records older than 30 days.
  purgeOldRequests();

  getDb()
    .prepare('INSERT INTO meal_requests (meal_id, requested_by) VALUES (?, ?)')
    .run(mealId, requestedBy.trim());
  return { success: true };
}

function purgeOldRequests(): void {
  const result = getDb()
    .prepare("DELETE FROM meal_requests WHERE created_at < datetime('now', '-30 days')")
    .run();
  if (result.changes > 0) {
    console.log(`Purged ${result.changes} old meal request(s)`);
  }
}
