import { Router, Request, Response, NextFunction } from 'express';
import {
  getAllMeals,
  getMealsWithStats,
  addMeal,
  deleteMeal,
  getMealPlan,
  setMealPlanEntry,
  deleteMealPlanEntry,
  addSuggestion,
  getAllSuggestions,
  updateSuggestionStatus,
  normalizeMealName,
  findNearMatch,
  findExactMatch
} from '../services/meal.service';

const ADMIN_PASSWORD = process.env.MEAL_ADMIN_PASSWORD || '';

// ── Admin auth middleware ──
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!ADMIN_PASSWORD) {
    res.status(500).json({ error: 'MEAL_ADMIN_PASSWORD not configured on the server' });
    return;
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header required' });
    return;
  }

  const token = authHeader.slice(7); // strip "Bearer "
  if (token !== ADMIN_PASSWORD) {
    res.status(403).json({ error: 'Invalid password' });
    return;
  }

  next();
}

export const mealRouter = Router();

// ── Public routes ──

// GET /meals/plan — rolling 7-day plan
mealRouter.get('/meals/plan', (req: Request, res: Response) => {
  try {
    const today = new Date();
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d.toISOString().split('T')[0]!);
    }

    const startDate = dates[0]!;
    const endDate = dates[6]!;

    const entries = getMealPlan(startDate, endDate);
    const entryMap = new Map(entries.map(e => [e.date, e]));

    // Return all 7 days, with null for unplanned days
    const plan = dates.map(date => ({
      date,
      dayName: new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' }),
      entry: entryMap.get(date) ?? null
    }));

    res.json({ plan });
  } catch (error) {
    console.error('Error fetching meal plan:', error);
    res.status(500).json({ error: 'Failed to fetch meal plan' });
  }
});

// POST /meals/suggestions — submit a suggestion (public)
mealRouter.post('/meals/suggestions', (req: Request, res: Response) => {
  try {
    const { mealName, suggestedBy, useExisting } = req.body as {
      mealName?: string;
      suggestedBy?: string;
      useExisting?: boolean;
    };

    if (!mealName?.trim() || !suggestedBy?.trim()) {
      res.status(400).json({ error: 'mealName and suggestedBy are required' });
      return;
    }

    const normalized = normalizeMealName(mealName);

    // If client hasn't confirmed yet, check for exact and near matches
    if (!useExisting) {
      // Exact match — meal already exists
      const exact = findExactMatch(normalized);
      if (exact) {
        res.status(200).json({
          exactMatch: exact,
          original: normalized,
        });
        return;
      }

      // Near match — possible typo
      const nearMatch = findNearMatch(normalized);
      if (nearMatch) {
        res.status(200).json({
          nearMatch: nearMatch.name,
          original: normalized,
        });
        return;
      }
    }

    // useExisting means the user accepted the near match — use mealName as-is (already the matched name)
    const finalName = normalizeMealName(mealName);
    const suggestion = addSuggestion(finalName, suggestedBy.trim());
    res.status(201).json(suggestion);
  } catch (error) {
    console.error('Error adding suggestion:', error);
    res.status(500).json({ error: 'Failed to add suggestion' });
  }
});

// POST /meals/auth — validate admin password
mealRouter.post('/meals/auth', (req: Request, res: Response) => {
  try {
    const { password } = req.body as { password?: string };

    if (!ADMIN_PASSWORD) {
      res.status(500).json({ error: 'MEAL_ADMIN_PASSWORD not configured on the server' });
      return;
    }

    if (password === ADMIN_PASSWORD) {
      res.json({ success: true });
    } else {
      res.status(403).json({ error: 'Invalid password' });
    }
  } catch (error) {
    console.error('Error validating auth:', error);
    res.status(500).json({ error: 'Auth validation failed' });
  }
});

// ── Admin routes ──

// GET /meals/suggestions — list all suggestions (admin)
mealRouter.get('/meals/suggestions', requireAdmin, (req: Request, res: Response) => {
  try {
    const suggestions = getAllSuggestions();
    res.json(suggestions);
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// PUT /meals/suggestions/:id — accept or dismiss (admin)
mealRouter.put('/meals/suggestions/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] ?? '', 10);
    const { status } = req.body as { status?: string };

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid suggestion ID' });
      return;
    }

    if (status !== 'accepted' && status !== 'dismissed') {
      res.status(400).json({ error: 'Status must be "accepted" or "dismissed"' });
      return;
    }

    const updated = updateSuggestionStatus(id, status);
    if (!updated) {
      res.status(404).json({ error: 'Suggestion not found' });
      return;
    }

    // If accepted, also add to meal library
    if (status === 'accepted') {
      try {
        addMeal(updated.meal_name);
      } catch {
        // Meal may already exist in library, that's fine
      }
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating suggestion:', error);
    res.status(500).json({ error: 'Failed to update suggestion' });
  }
});

// GET /meals/library — full meal catalog with stats (admin)
mealRouter.get('/meals/library', requireAdmin, (req: Request, res: Response) => {
  try {
    const meals = getMealsWithStats();
    res.json(meals);
  } catch (error) {
    console.error('Error fetching meal library:', error);
    res.status(500).json({ error: 'Failed to fetch meal library' });
  }
});

// POST /meals/library — add meal to library (admin)
mealRouter.post('/meals/library', requireAdmin, (req: Request, res: Response) => {
  try {
    const { name, description, force } = req.body as { name?: string; description?: string; force?: boolean };

    if (!name?.trim()) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const normalized = normalizeMealName(name);

    // Unless forced, check for exact/near matches
    if (!force) {
      const exact = findExactMatch(normalized);
      if (exact) {
        res.status(200).json({ exactMatch: exact, original: normalized });
        return;
      }

      const nearMatch = findNearMatch(normalized);
      if (nearMatch) {
        res.status(200).json({ nearMatch: nearMatch.name, original: normalized });
        return;
      }
    }

    const meal = addMeal(normalized, description?.trim());
    res.status(201).json(meal);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'A meal with that name already exists' });
      return;
    }
    console.error('Error adding meal:', error);
    res.status(500).json({ error: 'Failed to add meal' });
  }
});

// DELETE /meals/library/:id — remove from library (admin)
mealRouter.delete('/meals/library/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] ?? '', 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid meal ID' });
      return;
    }

    const deleted = deleteMeal(id);
    if (!deleted) {
      res.status(404).json({ error: 'Meal not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting meal:', error);
    res.status(500).json({ error: 'Failed to delete meal' });
  }
});

// POST /meals/plan — assign meal to a date (admin)
mealRouter.post('/meals/plan', requireAdmin, (req: Request, res: Response) => {
  try {
    const { date, mealId, customName, notes, force } = req.body as {
      date?: string;
      mealId?: number;
      customName?: string;
      notes?: string;
      force?: boolean;
    };

    if (!date) {
      res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
      return;
    }

    if (!mealId && !customName?.trim()) {
      res.status(400).json({ error: 'Either mealId or customName is required' });
      return;
    }

    // When saving with a custom name (no library match), check for fuzzy matches
    if (!mealId && customName?.trim() && !force) {
      const normalized = normalizeMealName(customName);
      const allMeals = getAllMeals();

      const exact = findExactMatch(normalized);
      if (exact) {
        const matched = allMeals.find(m => m.name.toLowerCase() === exact.toLowerCase());
        res.status(200).json({ exactMatch: exact, original: normalized, matchedMealId: matched?.id ?? null });
        return;
      }

      const nearMatch = findNearMatch(normalized);
      if (nearMatch) {
        const matched = allMeals.find(m => m.name.toLowerCase() === nearMatch.name.toLowerCase());
        res.status(200).json({ nearMatch: nearMatch.name, original: normalized, matchedMealId: matched?.id ?? null });
        return;
      }
    }

    const entry = setMealPlanEntry(
      date,
      mealId ?? null,
      customName?.trim() ?? null,
      notes?.trim()
    );
    res.status(201).json(entry);
  } catch (error) {
    console.error('Error setting meal plan:', error);
    res.status(500).json({ error: 'Failed to set meal plan entry' });
  }
});

// DELETE /meals/plan/:id — remove from plan (admin)
mealRouter.delete('/meals/plan/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] ?? '', 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid plan entry ID' });
      return;
    }

    const deleted = deleteMealPlanEntry(id);
    if (!deleted) {
      res.status(404).json({ error: 'Plan entry not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting plan entry:', error);
    res.status(500).json({ error: 'Failed to delete plan entry' });
  }
});
