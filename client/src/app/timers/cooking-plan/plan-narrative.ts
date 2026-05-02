import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CookingPlanService, ScheduledItem } from '../../shared/services/cooking-plan.service';

@Component({
  selector: 'app-plan-narrative',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (svc.groupedSchedule().length === 0) {
      <p class="empty-hint">Add items and tap "Calculate Plan" to see your cooking schedule.</p>
    } @else {
      <div class="narrative">
        @for (group of svc.groupedSchedule(); track group.putIn.getTime()) {
          <div class="group" [class.group-past]="group.isPast" [class.group-next]="group.isNext">
            @if (group.isNext) {
              <span class="next-badge">⬅ Up next</span>
            }
            <p>
              At <strong>{{ svc.formatTime(group.putIn) }}</strong>,
              @for (item of group.items; track item.id; let i = $index) {
                <strong>{{ item.name }}</strong>{{ joinText(i, group.items.length) }}
              }
              {{ group.items.length === 1 ? 'goes' : 'go' }} in
              @if (!group.isFirstGroup && group.deltaFromPrevGroup) {
                (<strong>{{ group.deltaFromPrevGroup }}</strong> min after <strong>{{ group.prevGroupLastName }}</strong>)
              }
              for <strong>{{ durationText(group.items) }}</strong> minutes.
            </p>
            @for (item of group.items; track item.id) {
              @if (item.restMins) {
                <p class="rest-note">
                  Take <strong>{{ item.name }}</strong> out at <strong>{{ svc.formatTime(toDate(item.takeOut)) }}</strong>
                  then rest <strong>{{ item.restMins }}</strong> minutes
                  (ready {{ svc.formatTime(toDate(item.ready)) }}).
                </p>
              }
            }
          </div>
        }
        <p class="serve-time">
          Everything ready to serve at <strong>{{ svc.finishTime() }}</strong>.
        </p>
      </div>
    }
  `,
  styles: `
    .empty-hint {
      color: #888;
      font-style: italic;
      font-size: 0.95rem;
    }

    .narrative {
      line-height: 1.6;
      font-size: 0.95rem;

      p {
        margin: 0.3rem 0;
      }

      strong {
        color: var(--wp--preset--color--primary);
      }
    }

    .group-past {
      opacity: 0.45;
      text-decoration: line-through;
      text-decoration-color: rgba(0, 0, 0, 0.25);
    }

    .group-next {
      background: rgba(var(--wp--preset--color--primary-rgb, 0, 0, 0), 0.06);
      border-left: 3px solid var(--wp--preset--color--primary);
      padding: 0.35rem 0.5rem;
      border-radius: 0 var(--wp--custom--default-border-radius, 4px) var(--wp--custom--default-border-radius, 4px) 0;
      margin: 0.4rem 0;
    }

    .next-badge {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--wp--preset--color--primary);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .rest-note {
      margin-left: 1rem !important;
      font-size: 0.9rem;
      opacity: 0.85;
    }

    .serve-time {
      margin-top: 0.75rem !important;
      font-weight: 600;
      font-size: 1rem;
    }
  `,
})
export class PlanNarrativeComponent {
  protected svc = inject(CookingPlanService);

  toDate(iso: string): Date {
    return new Date(iso);
  }

  joinText(index: number, total: number): string {
    if (index < total - 2) return ', ';
    if (index === total - 2) return ' & ';
    return '';
  }

  durationText(items: ScheduledItem[]): string {
    const unique = Array.from(new Set(items.map(e => e.cookMins)));
    if (unique.length === 1) return String(unique[0]);
    return items.map(e => `${e.cookMins} (${e.name})`).join(', ');
  }
}
