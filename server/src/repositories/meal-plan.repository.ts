import { getDb } from '../services/db';

export interface MealPlanEntry {
  id: number;
  date: string; // YYYY-MM-DD
  meal_id: number | null;
  custom_name: string | null;
  notes: string | null;
  /** Joined from `meals.name`, falling back to `custom_name`. */
  meal_name?: string;
}

const SELECT_PLAN_ENTRY_BY_DATE = `
  SELECT
    mp.id,
    mp.date,
    mp.meal_id,
    mp.custom_name,
    mp.notes,
    COALESCE(m.name, mp.custom_name) as meal_name
  FROM meal_plan mp
  LEFT JOIN meals m ON mp.meal_id = m.id
`;

export function getMealPlan(startDate: string, endDate: string): MealPlanEntry[] {
  return getDb()
    .prepare(`${SELECT_PLAN_ENTRY_BY_DATE} WHERE mp.date >= ? AND mp.date <= ? ORDER BY mp.date`)
    .all(startDate, endDate) as MealPlanEntry[];
}

export function setMealPlanEntry(
  date: string,
  mealId: number | null,
  customName: string | null,
  notes?: string,
): MealPlanEntry {
  getDb().prepare(`
    INSERT INTO meal_plan (date, meal_id, custom_name, notes)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      meal_id = excluded.meal_id,
      custom_name = excluded.custom_name,
      notes = excluded.notes
  `).run(date, mealId, customName, notes ?? null);

  return getDb()
    .prepare(`${SELECT_PLAN_ENTRY_BY_DATE} WHERE mp.date = ?`)
    .get(date) as MealPlanEntry;
}

export function deleteMealPlanEntry(id: number): boolean {
  const result = getDb().prepare('DELETE FROM meal_plan WHERE id = ?').run(id);
  return result.changes > 0;
}
