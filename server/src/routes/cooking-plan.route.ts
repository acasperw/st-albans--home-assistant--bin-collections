import { Router, Request, Response } from 'express';
import { getPlan, setPlan, clearPlan, CookingPlanItem } from '../services/cooking-plan.service';

export const cookingPlanRouter = Router();

const MAX_NAME_LENGTH = 50;
const MAX_ITEMS = 20;
const MAX_COOK_MINS = 1440; // 24 hours
const MAX_REST_MINS = 1440;

// GET /cooking-plan — get current plan with computed schedule
cookingPlanRouter.get('/cooking-plan', (_req: Request, res: Response) => {
  const plan = getPlan();
  if (!plan) {
    res.json({ plan: null });
    return;
  }
  res.json({ plan });
});

// PUT /cooking-plan — create or replace the plan
cookingPlanRouter.put('/cooking-plan', (req: Request, res: Response) => {
  const { finishTime, items } = req.body as { finishTime?: string; items?: CookingPlanItem[] };

  if (!finishTime || !/^\d{1,2}:\d{2}$/.test(finishTime)) {
    res.status(400).json({ error: 'finishTime must be in HH:MM format' });
    return;
  }

  const parts = finishTime.split(':').map(Number);
  const hh = parts[0];
  const mm = parts[1];
  if (hh === undefined || mm === undefined || hh > 23 || mm > 59) {
    res.status(400).json({ error: 'finishTime is not a valid time' });
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'items must be a non-empty array' });
    return;
  }

  if (items.length > MAX_ITEMS) {
    res.status(400).json({ error: `Maximum ${MAX_ITEMS} items allowed` });
    return;
  }

  // Validate each item
  for (const item of items) {
    if (!item.name?.trim()) {
      res.status(400).json({ error: 'Each item must have a name' });
      return;
    }
    if (item.name.trim().length > MAX_NAME_LENGTH) {
      res.status(400).json({ error: `Item name must be ${MAX_NAME_LENGTH} characters or fewer` });
      return;
    }
    if (item.cookMins == null || !Number.isFinite(item.cookMins) || item.cookMins < 1) {
      res.status(400).json({ error: `${item.name}: cookMins must be a positive number` });
      return;
    }
    if (item.cookMins > MAX_COOK_MINS) {
      res.status(400).json({ error: `${item.name}: cookMins must be ${MAX_COOK_MINS} or less` });
      return;
    }
    if (item.restMins != null) {
      if (!Number.isFinite(item.restMins) || item.restMins < 0) {
        res.status(400).json({ error: `${item.name}: restMins must be 0 or greater` });
        return;
      }
      if (item.restMins > MAX_REST_MINS) {
        res.status(400).json({ error: `${item.name}: restMins must be ${MAX_REST_MINS} or less` });
        return;
      }
    }
  }

  const sanitised = items.map((item, idx) => ({
    id: item.id ?? idx + 1,
    name: item.name.trim(),
    cookMins: Math.round(item.cookMins),
    restMins: Math.round(item.restMins ?? 0),
  }));

  const normalised = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  const plan = setPlan(normalised, sanitised);
  res.json({ plan });
});

// DELETE /cooking-plan — clear the plan
cookingPlanRouter.delete('/cooking-plan', (_req: Request, res: Response) => {
  clearPlan();
  res.json({ success: true });
});
