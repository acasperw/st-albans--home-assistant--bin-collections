import { Component, inject, ChangeDetectionStrategy, effect } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CookingPlanService } from '../../shared/services/cooking-plan.service';

@Component({
  selector: 'app-finish-time-input',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="finish-time">
      <label for="finishTime">Serve at</label>
      <input id="finishTime" type="time" [formControl]="ctrl" />
    </div>
  `,
  styles: `
    .finish-time {
      display: flex;
      align-items: center;
      gap: 0.75rem;

      label {
        font-weight: 600;
        font-size: 1rem;
        white-space: nowrap;
      }

      input {
        padding: 0.6rem 0.75rem;
        border: 1px solid #ccc;
        border-radius: var(--wp--custom--default-border-radius);
        font-size: 1.1rem;
        font-family: inherit;
        font-weight: 600;

        &:focus {
          outline: none;
          border-color: var(--wp--preset--color--secondary);
          box-shadow: 0 0 0 2px rgba(255, 188, 0, 0.25);
        }
      }
    }
  `,
})
export class FinishTimeInputComponent {
  private svc = inject(CookingPlanService);

  ctrl = new FormControl<string>(this.svc.finishTime(), { nonNullable: true });

  constructor() {
    this.ctrl.valueChanges.subscribe(v => this.svc.setFinishTime(v));
    effect(() => {
      const current = this.svc.finishTime();
      if (current !== this.ctrl.value) {
        this.ctrl.setValue(current, { emitEvent: false });
      }
    });
  }
}
