import { Router, Request, Response } from 'express';
import { getActiveTimers, createTimer, deleteTimer } from '../services/timer.service';

export const timerRouter = Router();

const MAX_NAME_LENGTH = 50;
const MAX_DURATION_SECS = 24 * 60 * 60; // 24 hours
const MAX_ACTIVE_TIMERS = 10;

// GET /timers — list active timers
timerRouter.get('/timers', (_req: Request, res: Response) => {
  res.json({ timers: getActiveTimers() });
});

// POST /timers — create a new timer
timerRouter.post('/timers', (req: Request, res: Response) => {
  const { name, durationSecs } = req.body as { name?: string; durationSecs?: number };

  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  if (name.trim().length > MAX_NAME_LENGTH) {
    res.status(400).json({ error: `name must be ${MAX_NAME_LENGTH} characters or fewer` });
    return;
  }

  if (durationSecs == null || !Number.isFinite(durationSecs) || durationSecs < 1) {
    res.status(400).json({ error: 'durationSecs must be a positive number' });
    return;
  }

  if (durationSecs > MAX_DURATION_SECS) {
    res.status(400).json({ error: `durationSecs must be ${MAX_DURATION_SECS} or less` });
    return;
  }

  const active = getActiveTimers();
  if (active.length >= MAX_ACTIVE_TIMERS) {
    res.status(422).json({ error: `Maximum of ${MAX_ACTIVE_TIMERS} active timers reached` });
    return;
  }

  const timer = createTimer(name.trim(), Math.round(durationSecs));
  res.status(201).json(timer);
});

// DELETE /timers/:id — cancel a timer
timerRouter.delete('/timers/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const deleted = deleteTimer(id);
  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Timer not found' });
  }
});
