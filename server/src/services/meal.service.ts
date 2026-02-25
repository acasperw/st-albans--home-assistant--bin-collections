import Database from 'better-sqlite3';
import path from 'path';
import { distance as levenshtein } from 'fastest-levenshtein';

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

export interface MealWithStats extends Meal {
  times_planned: number;
  last_planned: string | null;
}

export function getAllMeals(): Meal[] {
  return getDb().prepare('SELECT * FROM meals ORDER BY name COLLATE NOCASE').all() as Meal[];
}

/** Return every library meal enriched with plan-frequency stats */
export function getMealsWithStats(): MealWithStats[] {
  return getDb().prepare(`
    SELECT
      m.id,
      m.name,
      m.description,
      m.created_at,
      COALESCE(ps.times_planned, 0) AS times_planned,
      ps.last_planned
    FROM meals m
    LEFT JOIN (
      SELECT meal_id, COUNT(*) AS times_planned, MAX(date) AS last_planned
      FROM meal_plan
      WHERE meal_id IS NOT NULL
      GROUP BY meal_id
    ) ps ON ps.meal_id = m.id
    ORDER BY times_planned DESC, m.name COLLATE NOCASE
  `).all() as MealWithStats[];
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
  // Clean up resolved suggestions older than 7 days
  purgeOldSuggestions();

  const stmt = getDb().prepare('INSERT INTO suggestions (meal_name, suggested_by) VALUES (?, ?)');
  const result = stmt.run(mealName, suggestedBy);
  return getDb().prepare('SELECT * FROM suggestions WHERE id = ?').get(result.lastInsertRowid) as Suggestion;
}

/** Delete accepted/dismissed suggestions older than 7 days */
function purgeOldSuggestions(): void {
  const result = getDb().prepare(
    "DELETE FROM suggestions WHERE status != 'pending' AND created_at < datetime('now', '-7 days')"
  ).run();
  if (result.changes > 0) {
    console.log(`Purged ${result.changes} old resolved suggestion(s)`);
  }
}

// Normalized Levenshtein similarity: 1 - (editDistance / maxLength)
// 0.6 threshold catches most single/double-char typos while avoiding false positives
// Normalized Levenshtein similarity: 1 - (editDistance / maxLength)
// 0.55 threshold catches most single/double-char typos while avoiding false positives
const SIMILARITY_THRESHOLD = 0.55;
const DEBUG = process.env.NODE_ENV !== 'production';

export interface NearMatch {
  name: string;
  score: number;
}

/** Normalize a meal name: trim, collapse whitespace, title-case */
export function normalizeMealName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/** Compute normalized similarity between two strings (0–1, higher = more similar) */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/** Find the closest match from the library + pending suggestions */
export function findNearMatch(input: string): NearMatch | null {
  const normalized = normalizeMealName(input).toLowerCase();

  // Gather all known meal names
  const libraryNames = getAllMeals().map(m => m.name);
  const pendingNames = getPendingSuggestions().map(s => s.meal_name);
  const allNames = [...new Set([...libraryNames, ...pendingNames])];

  if (allNames.length === 0) return null;

  // Skip exact matches — handled separately by findExactMatch
  const exactMatch = allNames.find(n => n.toLowerCase() === normalized);
  if (exactMatch) return null;

  // Find the best match by Levenshtein similarity
  let bestScore = 0;
  let bestName: string | null = null;

  for (const name of allNames) {
    const score = similarity(normalized, name.toLowerCase());
    if (DEBUG) {
      console.log(`  [fuzzy] "${normalized}" vs "${name}" → ${score.toFixed(3)}`);
    }
    if (score > bestScore) {
      bestScore = score;
      bestName = name;
    }
  }

  if (DEBUG) {
    console.log(`  [fuzzy] Best: "${bestName}" (${bestScore.toFixed(3)}), threshold: ${SIMILARITY_THRESHOLD}, ${bestScore >= SIMILARITY_THRESHOLD ? 'MATCH' : 'no match'}`);
  }

  if (bestName && bestScore >= SIMILARITY_THRESHOLD) {
    return { name: bestName, score: bestScore };
  }

  return null;
}

/** Check if the meal already exists in the library or pending suggestions (case-insensitive) */
export function findExactMatch(input: string): string | null {
  const normalized = normalizeMealName(input).toLowerCase();

  const libraryNames = getAllMeals().map(m => m.name);
  const pendingNames = getPendingSuggestions().map(s => s.meal_name);
  const allNames = [...new Set([...libraryNames, ...pendingNames])];

  return allNames.find(n => n.toLowerCase() === normalized) ?? null;
}

export function updateSuggestionStatus(id: number, status: 'accepted' | 'dismissed'): Suggestion | undefined {
  const stmt = getDb().prepare('UPDATE suggestions SET status = ? WHERE id = ?');
  const result = stmt.run(status, id);
  if (result.changes === 0) return undefined;
  return getDb().prepare('SELECT * FROM suggestions WHERE id = ?').get(id) as Suggestion;
}
