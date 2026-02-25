import Database from 'better-sqlite3';
import path from 'path';

// Types
export interface Meal {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export interface MealPlanEntry {
  id: number;
  date: string; // YYYY-MM-DD
  meal_id: number | null;
  custom_name: string | null;
  notes: string | null;
  meal_name?: string; // joined from meals table or custom_name
}

export interface Suggestion {
  id: number;
  meal_name: string;
  suggested_by: string;
  status: 'pending' | 'accepted' | 'dismissed';
  created_at: string;
}

// Database setup
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'meals.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema(): void {
  getDbRaw().exec(`
    CREATE TABLE IF NOT EXISTS meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meal_plan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      meal_id INTEGER,
      custom_name TEXT,
      notes TEXT,
      FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE SET NULL,
      UNIQUE(date)
    );

    CREATE TABLE IF NOT EXISTS suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_name TEXT NOT NULL,
      suggested_by TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'dismissed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/** Raw db handle (for initSchema bootstrap) */
function getDbRaw(): Database.Database {
  return db;
}

// ── Meal Library ──

export function getAllMeals(): Meal[] {
  return getDb().prepare('SELECT * FROM meals ORDER BY name COLLATE NOCASE').all() as Meal[];
}

export function addMeal(name: string, description?: string): Meal {
  const stmt = getDb().prepare('INSERT INTO meals (name, description) VALUES (?, ?)');
  const result = stmt.run(name, description ?? null);
  return getDb().prepare('SELECT * FROM meals WHERE id = ?').get(result.lastInsertRowid) as Meal;
}

export function deleteMeal(id: number): boolean {
  const result = getDb().prepare('DELETE FROM meals WHERE id = ?').run(id);
  return result.changes > 0;
}

// ── Meal Plan ──

export function getMealPlan(startDate: string, endDate: string): MealPlanEntry[] {
  // Return plan entries for the date range, joined with meal names
  const rows = getDb().prepare(`
    SELECT
      mp.id,
      mp.date,
      mp.meal_id,
      mp.custom_name,
      mp.notes,
      COALESCE(m.name, mp.custom_name) as meal_name
    FROM meal_plan mp
    LEFT JOIN meals m ON mp.meal_id = m.id
    WHERE mp.date >= ? AND mp.date <= ?
    ORDER BY mp.date
  `).all(startDate, endDate) as MealPlanEntry[];

  return rows;
}

export function setMealPlanEntry(date: string, mealId: number | null, customName: string | null, notes?: string): MealPlanEntry {
  // Upsert: replace existing entry for that date
  const stmt = getDb().prepare(`
    INSERT INTO meal_plan (date, meal_id, custom_name, notes)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      meal_id = excluded.meal_id,
      custom_name = excluded.custom_name,
      notes = excluded.notes
  `);
  stmt.run(date, mealId, customName, notes ?? null);

  const entry = getDb().prepare(`
    SELECT
      mp.id,
      mp.date,
      mp.meal_id,
      mp.custom_name,
      mp.notes,
      COALESCE(m.name, mp.custom_name) as meal_name
    FROM meal_plan mp
    LEFT JOIN meals m ON mp.meal_id = m.id
    WHERE mp.date = ?
  `).get(date) as MealPlanEntry;

  return entry;
}

export function deleteMealPlanEntry(id: number): boolean {
  const result = getDb().prepare('DELETE FROM meal_plan WHERE id = ?').run(id);
  return result.changes > 0;
}

// ── Suggestions ──

export function getAllSuggestions(): Suggestion[] {
  return getDb().prepare('SELECT * FROM suggestions ORDER BY created_at DESC').all() as Suggestion[];
}

export function getPendingSuggestions(): Suggestion[] {
  return getDb().prepare("SELECT * FROM suggestions WHERE status = 'pending' ORDER BY created_at DESC").all() as Suggestion[];
}

export function addSuggestion(mealName: string, suggestedBy: string): Suggestion {
  const stmt = getDb().prepare('INSERT INTO suggestions (meal_name, suggested_by) VALUES (?, ?)');
  const result = stmt.run(mealName, suggestedBy);
  return getDb().prepare('SELECT * FROM suggestions WHERE id = ?').get(result.lastInsertRowid) as Suggestion;
}

export function updateSuggestionStatus(id: number, status: 'accepted' | 'dismissed'): Suggestion | undefined {
  const stmt = getDb().prepare('UPDATE suggestions SET status = ? WHERE id = ?');
  const result = stmt.run(status, id);
  if (result.changes === 0) return undefined;
  return getDb().prepare('SELECT * FROM suggestions WHERE id = ?').get(id) as Suggestion;
}
