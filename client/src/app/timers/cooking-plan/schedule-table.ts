import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CookingPlanService } from '../../shared/services/cooking-plan.service';

@Component({
  selector: 'app-schedule-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (svc.schedule().length) {
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Food</th>
              <th>Put In</th>
              <th>Take Out</th>
              <th>Cook</th>
              <th>Rest</th>
            </tr>
          </thead>
          <tbody>
            @for (s of svc.schedule(); track s.id) {
              <tr>
                <td>{{ s.name }}</td>
                <td>{{ svc.formatTime(toDate(s.putIn)) }}</td>
                <td>{{ svc.formatTime(toDate(s.takeOut)) }}</td>
                <td class="num">{{ s.cookMins }}m</td>
                <td class="num">{{ s.restMins ? s.restMins + 'm' : '—' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    .table-wrap {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }

    th {
      text-align: left;
      padding: 0.4rem 0.5rem;
      background: var(--wp--preset--color--primary);
      color: #fff;
      font-weight: 600;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    td {
      padding: 0.4rem 0.5rem;
      border-bottom: 1px solid #eee;
    }

    .num {
      text-align: center;
      font-variant-numeric: tabular-nums;
    }

    tr:last-child td {
      border-bottom: none;
    }
  `,
})
export class ScheduleTableComponent {
  protected svc = inject(CookingPlanService);

  toDate(iso: string): Date {
    return new Date(iso);
  }
}
