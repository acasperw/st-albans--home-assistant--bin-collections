import { getDb } from '../services/db';

export interface Meal {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export interface MealWithStats extends Meal {
  times_planned: number;
  last_planned: string | null;
  times_requested: number;
}

export function getAllMeals(): Meal[] {
  return getDb()
    .prepare('SELECT * FROM meals ORDER BY name COLLATE NOCASE')
    .all() as Meal[];
}

/** Library meals enriched with plan-frequency and (recent) request stats. */
export function getMealsWithStats(): MealWithStats[] {
  return getDb().prepare(`
    SELECT
      m.id,
      m.name,
      m.description,
      m.created_at,
      COALESCE(ps.times_planned, 0) AS times_planned,
      ps.last_planned,
      COALESCE(rq.times_requested, 0) AS times_requested
    FROM meals m
    LEFT JOIN (
      SELECT meal_id, COUNT(*) AS times_planned, MAX(date) AS last_planned
      FROM meal_plan
      WHERE meal_id IS NOT NULL
      GROUP BY meal_id
    ) ps ON ps.meal_id = m.id
    LEFT JOIN (
      SELECT meal_id, COUNT(*) AS times_requested
      FROM meal_requests
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY meal_id
    ) rq ON rq.meal_id = m.id
    ORDER BY times_requested DESC, times_planned DESC, m.name COLLATE NOCASE
  `).all() as MealWithStats[];
}

export function addMeal(name: string, description?: string): Meal {
  const result = getDb()
    .prepare('INSERT INTO meals (name, description) VALUES (?, ?)')
    .run(name, description ?? null);
  return getDb()
    .prepare('SELECT * FROM meals WHERE id = ?')
    .get(result.lastInsertRowid) as Meal;
}

export function renameMeal(id: number, newName: string): Meal | undefined {
  const result = getDb()
    .prepare('UPDATE meals SET name = ? WHERE id = ?')
    .run(newName, id);
  if (result.changes === 0) return undefined;
  return getDb()
    .prepare('SELECT * FROM meals WHERE id = ?')
    .get(id) as Meal;
}

export function deleteMeal(id: number): boolean {
  const result = getDb().prepare('DELETE FROM meals WHERE id = ?').run(id);
  return result.changes > 0;
}
