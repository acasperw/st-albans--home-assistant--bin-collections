import { Component, inject, ChangeDetectionStrategy, effect } from '@angular/core';
import { FormGroup, FormControl, FormArray, ReactiveFormsModule } from '@angular/forms';
import { CookingPlanService, CookingPlanItem } from '../../shared/services/cooking-plan.service';

type ItemFormGroup = FormGroup<{
  id: FormControl<number>;
  name: FormControl<string>;
  cookMins: FormControl<number | null>;
  restMins: FormControl<number | null>;
}>;

@Component({
  selector: 'app-items-editor',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (submit)="$event.preventDefault()">
      <div formArrayName="items" class="items-list">
        @for (group of itemFGs(); track group.controls.id.value; let i = $index) {
          <div [formGroupName]="i" class="item-row">
            <div class="sentence-row">
              <span class="label">Cook</span>
              <input formControlName="name" placeholder="Food item" class="input-name" />
              <span class="label">for</span>
              <input type="number" formControlName="cookMins" min="1" placeholder="0" class="input-mins" />
              <span class="label">mins</span>
            </div>
            <div class="sentence-row sentence-row--rest">
              <span class="label label--rest">Rest</span>
              <input type="number" formControlName="restMins" min="0" placeholder="0" class="input-mins input-mins--rest" />
              <span class="label label--rest">mins</span>
              <button type="button" class="btn-remove" (click)="remove(i, group.controls.id.value)">✕</button>
            </div>
          </div>
        }
      </div>
      <div class="editor-actions">
        <button type="button" class="btn-add" (click)="add()">+ Add Item</button>
        <button type="button" class="btn-reset" (click)="resetAll()">Reset</button>
      </div>
    </form>
  `,
  styles: `
    .items-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .item-row {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      background: #fff;
      border-radius: var(--wp--custom--default-border-radius);
      padding: 0.6rem 0.65rem;
      border-left: 3px solid var(--wp--preset--color--secondary);
    }

    .sentence-row {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: nowrap;
    }

    .sentence-row--rest {
      padding-top: 0.2rem;
    }

    .label {
      font-size: 0.9rem;
      font-weight: 600;
      color: #333;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .label--rest {
      font-size: 0.8rem;
      font-weight: 500;
      color: #888;
    }

    .input-name {
      border: 1px solid #ccc;
      border-radius: var(--wp--custom--default-border-radius);
      padding: 0.45rem 0.5rem;
      font-size: 0.95rem;
      font-family: inherit;
      flex: 1;
      min-width: 0;

      &:focus {
        outline: none;
        border-color: var(--wp--preset--color--secondary);
        box-shadow: 0 0 0 2px rgba(255, 188, 0, 0.25);
      }
    }

    .input-mins {
      width: 3.5rem;
      padding: 0.45rem 0.3rem;
      border: 1px solid #ccc;
      border-radius: var(--wp--custom--default-border-radius);
      font-size: 0.95rem;
      font-family: inherit;
      text-align: center;
      flex-shrink: 0;

      &:focus {
        outline: none;
        border-color: var(--wp--preset--color--secondary);
        box-shadow: 0 0 0 2px rgba(255, 188, 0, 0.25);
      }
    }

    .input-mins--rest {
      width: 3rem;
      font-size: 0.85rem;
      padding: 0.35rem 0.25rem;
    }

    .btn-remove {
      width: 2rem;
      height: 2rem;
      border: none;
      border-radius: 50%;
      background: #f0f0f0;
      font-size: 0.9rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-left: auto;

      &:hover {
        background: #e74c3c;
        color: #fff;
      }
    }

    .editor-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    .btn-add,
    .btn-reset {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: var(--wp--custom--default-border-radius);
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }

    .btn-add {
      background: var(--wp--preset--color--primary);
      color: #fff;

      &:hover {
        background: var(--wp--custom--color--primary-hover);
      }
    }

    .btn-reset {
      background: #f0f0f0;
      color: #333;

      &:hover {
        background: #ddd;
      }
    }
  `,
})
export class ItemsEditorComponent {
  private svc = inject(CookingPlanService);

  form = new FormGroup({
    items: new FormArray<ItemFormGroup>([]),
  });

  private updatingFromService = false;

  constructor() {
    this.syncFromService(this.svc.items());
    effect(() => {
      const items = this.svc.items();
      this.syncFromService(items);
    });
  }

  itemFGs(): ItemFormGroup[] {
    return (this.form.controls.items as FormArray<ItemFormGroup>).controls;
  }

  add(): void {
    this.svc.addItem();
  }

  remove(index: number, id: number): void {
    this.svc.removeItem(id);
    (this.form.controls.items as FormArray).removeAt(index);
  }

  resetAll(): void {
    this.svc.clear();
  }

  private buildGroup(item: CookingPlanItem): ItemFormGroup {
    const g: ItemFormGroup = new FormGroup({
      id: new FormControl(item.id, { nonNullable: true }),
      name: new FormControl(item.name, { nonNullable: true }),
      cookMins: new FormControl<number | null>(item.cookMins || null),
      restMins: new FormControl<number | null>(item.restMins || null),
    });
    this.attachGroupSubscription(g);
    return g;
  }

  private attachGroupSubscription(group: ItemFormGroup): void {
    group.valueChanges.subscribe(val => {
      if (this.updatingFromService) return;
      const id = group.controls.id.value;
      const cook = this.sanitizeNumber(val.cookMins);
      const rest = this.sanitizeNumber(val.restMins);
      this.svc.updateItem(id, { name: val.name ?? '', cookMins: cook ?? 0, restMins: rest ?? 0 });
    });
  }

  private sanitizeNumber(n: number | null | undefined): number | null {
    if (n == null || !Number.isFinite(n)) return null;
    return Math.max(0, Math.round(n));
  }

  private syncFromService(items: CookingPlanItem[]): void {
    this.updatingFromService = true;
    const fa = this.form.controls.items as FormArray<ItemFormGroup>;
    const existingIds = new Set(fa.controls.map(c => c.controls.id.value));

    for (const item of items) {
      if (!existingIds.has(item.id)) {
        fa.push(this.buildGroup(item));
      }
    }

    for (let i = fa.length - 1; i >= 0; i--) {
      const id = fa.at(i).controls.id.value;
      if (!items.find(it => it.id === id)) {
        fa.removeAt(i);
      }
    }

    for (const item of items) {
      const grp = fa.controls.find(c => c.controls.id.value === item.id)!;
      if (grp) {
        const needsPatch =
          grp.controls.name.value !== item.name ||
          grp.controls.cookMins.value !== (item.cookMins || null) ||
          grp.controls.restMins.value !== (item.restMins || null);
        if (needsPatch) {
          grp.patchValue(
            { name: item.name, cookMins: item.cookMins || null, restMins: item.restMins || null },
            { emitEvent: false }
          );
        }
      }
    }
    this.updatingFromService = false;
  }
}
