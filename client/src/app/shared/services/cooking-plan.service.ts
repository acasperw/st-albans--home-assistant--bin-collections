import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface CookingPlanItem {
  id: number;
  name: string;
  cookMins: number;
  restMins: number;
}

export interface ScheduledItem extends CookingPlanItem {
  putIn: string;
  takeOut: string;
  ready: string;
}

export interface NarrativeGroup {
  putIn: Date;
  items: ScheduledItem[];
  isFirstGroup: boolean;
  deltaFromPrevGroup: number | null;
  prevGroupLastName: string | null;
}

export interface CookingPlanResponse {
  finishTime: string;
  items: CookingPlanItem[];
  schedule: ScheduledItem[];
}

@Injectable({ providedIn: 'root' })
export class CookingPlanService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/api/cooking-plan`;
  private nextId = 1;

  finishTime = signal('18:00');
  items = signal<CookingPlanItem[]>([{ id: this.nextId++, name: '', cookMins: 0, restMins: 0 }]);
  schedule = signal<ScheduledItem[]>([]);
  hasPlan = signal(false);
  saving = signal(false);

  /** Grouped schedule entries for narrative display */
  groupedSchedule = computed<NarrativeGroup[]>(() => {
    const sched = this.schedule();
    if (!sched.length) return [];

    const groups: NarrativeGroup[] = [];
    for (const item of sched) {
      const putIn = new Date(item.putIn);
      const last = groups[groups.length - 1];

      if (last && last.putIn.getTime() === putIn.getTime()) {
        last.items.push(item);
      } else {
        const prevLastItem = last?.items[last.items.length - 1];
        const delta = last ? Math.round((putIn.getTime() - last.putIn.getTime()) / 60000) : null;
        groups.push({
          putIn,
          items: [item],
          isFirstGroup: !last,
          deltaFromPrevGroup: delta,
          prevGroupLastName: prevLastItem?.name ?? null,
        });
      }
    }
    return groups;
  });

  /** Next upcoming action (put-in or take-out) for clock display */
  nextAction = computed<{ label: string; time: Date; itemName: string } | null>(() => {
    const sched = this.schedule();
    if (!sched.length) return null;

    const now = Date.now();
    const actions: { label: string; time: Date; itemName: string }[] = [];

    for (const item of sched) {
      const putIn = new Date(item.putIn);
      if (putIn.getTime() > now) {
        actions.push({ label: 'Put in', time: putIn, itemName: item.name });
      }
      const takeOut = new Date(item.takeOut);
      if (takeOut.getTime() > now && item.restMins > 0) {
        actions.push({ label: 'Take out', time: takeOut, itemName: item.name });
      }
    }

    if (!actions.length) return null;
    actions.sort((a, b) => a.time.getTime() - b.time.getTime());
    return actions[0];
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.http.get<{ plan: CookingPlanResponse | null }>(this.baseUrl).subscribe({
      next: (res) => {
        if (res.plan) {
          this.finishTime.set(res.plan.finishTime);
          this.items.set(res.plan.items);
          this.schedule.set(res.plan.schedule);
          this.hasPlan.set(res.plan.schedule.length > 0);
          const maxId = res.plan.items.reduce((m, i) => Math.max(m, i.id), 0);
          this.nextId = maxId + 1;
        } else {
          this.hasPlan.set(false);
          this.schedule.set([]);
        }
      },
    });
  }

  setFinishTime(value: string): void {
    if (/^\d{1,2}:\d{2}$/.test(value)) {
      const [hh, mm] = value.split(':').map(Number);
      if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60) {
        this.finishTime.set(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
      }
    }
  }

  addItem(): void {
    this.items.update(list => [...list, { id: this.nextId++, name: '', cookMins: 0, restMins: 0 }]);
  }

  removeItem(id: number): void {
    this.items.update(list => list.filter(i => i.id !== id));
  }

  updateItem(id: number, patch: Partial<Omit<CookingPlanItem, 'id'>>): void {
    this.items.update(list => list.map(i => i.id === id ? { ...i, ...patch } : i));
  }

  /** Save current plan to server and refresh schedule */
  save(): void {
    const validItems = this.items().filter(i => i.name.trim() && i.cookMins > 0);
    if (!validItems.length) return;

    this.saving.set(true);
    this.http.put<{ plan: CookingPlanResponse }>(this.baseUrl, {
      finishTime: this.finishTime(),
      items: validItems,
    }).subscribe({
      next: (res) => {
        this.schedule.set(res.plan.schedule);
        this.items.set(res.plan.items);
        // Update finish time if the server adjusted it forward
        if (res.plan.finishTime !== this.finishTime()) {
          this.finishTime.set(res.plan.finishTime);
        }
        this.hasPlan.set(res.plan.schedule.length > 0);
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  /** Clear the plan on the server */
  clear(): void {
    this.http.delete(this.baseUrl).subscribe({
      next: () => {
        this.finishTime.set('18:00');
        this.items.set([{ id: this.nextId++, name: '', cookMins: 0, restMins: 0 }]);
        this.schedule.set([]);
        this.hasPlan.set(false);
      },
    });
  }

  formatTime(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
}
