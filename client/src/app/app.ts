import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IdleService } from './shared/services/idle.service';
import { Clock } from './clock/clock';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Clock],
  template: `
    <router-outlet />
    <app-clock [active]="idle.isIdle()" />
  `
})
export class App {

  protected idle = inject(IdleService);
}
