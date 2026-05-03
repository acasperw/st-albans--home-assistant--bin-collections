import { getDb } from '../services/db';

export interface Suggestion {
  id: number;
  meal_name: string;
  suggested_by: string;
  status: 'pending' | 'accepted' | 'dismissed';
  created_at: string;
}

export function getAllSuggestions(): Suggestion[] {
  return getDb()
    .prepare('SELECT * FROM suggestions ORDER BY created_at DESC')
    .all() as Suggestion[];
}

export function getPendingSuggestions(): Suggestion[] {
  return getDb()
    .prepare("SELECT * FROM suggestions WHERE status = 'pending' ORDER BY created_at DESC")
    .all() as Suggestion[];
}

export function countPendingSuggestionsBy(suggestedBy: string): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) as count FROM suggestions WHERE status = 'pending' AND LOWER(suggested_by) = LOWER(?)")
    .get(suggestedBy.trim()) as { count: number };
  return row.count;
}

export function addSuggestion(mealName: string, suggestedBy: string): Suggestion {
  // Clean up resolved suggestions older than 7 days on each insert.
  purgeOldSuggestions();

  const result = getDb()
    .prepare('INSERT INTO suggestions (meal_name, suggested_by) VALUES (?, ?)')
    .run(mealName, suggestedBy);
  return getDb()
    .prepare('SELECT * FROM suggestions WHERE id = ?')
    .get(result.lastInsertRowid) as Suggestion;
}

export function updateSuggestionStatus(
  id: number,
  status: 'accepted' | 'dismissed',
  newName?: string,
): Suggestion | undefined {
  const result = newName
    ? getDb()
        .prepare('UPDATE suggestions SET meal_name = ?, status = ? WHERE id = ?')
        .run(newName, status, id)
    : getDb()
        .prepare('UPDATE suggestions SET status = ? WHERE id = ?')
        .run(status, id);

  if (result.changes === 0) return undefined;
  return getDb()
    .prepare('SELECT * FROM suggestions WHERE id = ?')
    .get(id) as Suggestion;
}

/** Delete accepted/dismissed suggestions older than 7 days. */
function purgeOldSuggestions(): void {
  const result = getDb()
    .prepare("DELETE FROM suggestions WHERE status != 'pending' AND created_at < datetime('now', '-7 days')")
    .run();
  if (result.changes > 0) {
    console.log(`Purged ${result.changes} old resolved suggestion(s)`);
  }
}
