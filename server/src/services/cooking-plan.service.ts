export interface CookingPlanItem {
  id: number;
  name: string;
  cookMins: number;
  restMins: number;
}

export interface ScheduledItem extends CookingPlanItem {
  putIn: string;   // ISO 8601
  takeOut: string;  // ISO 8601
  ready: string;    // ISO 8601
}

export interface CookingPlan {
  finishTime: string; // "HH:MM"
  items: CookingPlanItem[];
}

export interface CookingPlanResponse {
  finishTime: string;
  items: CookingPlanItem[];
  schedule: ScheduledItem[];
}

let currentPlan: CookingPlan | null = null;

function buildFinishDate(timeStr: string): Date | null {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  const now = new Date();
  const finish = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  // If the time is in the past, assume tomorrow
  if (finish.getTime() < now.getTime()) {
    finish.setDate(finish.getDate() + 1);
  }
  return finish;
}

function computeSchedule(plan: CookingPlan): { schedule: ScheduledItem[]; adjustedFinishTime: string } {
  let finish = buildFinishDate(plan.finishTime);
  if (!finish) return { schedule: [], adjustedFinishTime: plan.finishTime };

  const validItems = plan.items.filter(i => i.name.trim() && i.cookMins > 0);
  if (!validItems.length) return { schedule: [], adjustedFinishTime: plan.finishTime };

  // Find the longest total time (cook + rest) to check if finish time needs pushing
  const maxTotalMs = Math.max(...validItems.map(i => ((i.cookMins ?? 0) + (i.restMins ?? 0)) * 60 * 1000));
  const earliestPutIn = new Date(finish.getTime() - maxTotalMs);
  const now = new Date();

  // If the earliest put-in would be in the past, push finish time forward
  if (earliestPutIn.getTime() < now.getTime()) {
    const shiftMs = now.getTime() - earliestPutIn.getTime() + 60000; // +1 min buffer
    finish = new Date(finish.getTime() + shiftMs);
  }

  const adjustedFinishTime = `${String(finish.getHours()).padStart(2, '0')}:${String(finish.getMinutes()).padStart(2, '0')}`;

  const schedule = validItems
    .map(item => {
      const restMs = (item.restMins ?? 0) * 60 * 1000;
      const cookMs = item.cookMins * 60 * 1000;
      const ready = finish;
      const takeOut = new Date(ready.getTime() - restMs);
      const putIn = new Date(takeOut.getTime() - cookMs);
      return {
        ...item,
        putIn: putIn.toISOString(),
        takeOut: takeOut.toISOString(),
        ready: ready.toISOString(),
      };
    })
    .sort((a, b) => new Date(a.putIn).getTime() - new Date(b.putIn).getTime());

  return { schedule, adjustedFinishTime };
}

export function getPlan(): CookingPlanResponse | null {
  if (!currentPlan) return null;
  const { schedule, adjustedFinishTime } = computeSchedule(currentPlan);
  return {
    finishTime: adjustedFinishTime,
    items: currentPlan.items,
    schedule,
  };
}

export function setPlan(finishTime: string, items: CookingPlanItem[]): CookingPlanResponse {
  currentPlan = { finishTime, items };
  const { schedule, adjustedFinishTime } = computeSchedule(currentPlan);
  // Persist the adjusted time so subsequent GETs are consistent
  currentPlan.finishTime = adjustedFinishTime;
  return {
    finishTime: adjustedFinishTime,
    items: currentPlan.items,
    schedule,
  };
}

export function clearPlan(): void {
  currentPlan = null;
}
