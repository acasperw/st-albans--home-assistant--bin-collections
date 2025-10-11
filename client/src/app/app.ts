import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IdleService } from './shared/services/idle.service';
import { Clock } from './clock/clock';
import { TemperatureNotificationComponent } from './shared/components/temperature-notification/temperature-notification.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Clock, TemperatureNotificationComponent],
  template: `
    <router-outlet />
    <app-clock [active]="idle.isIdle()" />
    <app-temperature-notification />
  `
})
export class App {

  protected idle = inject(IdleService);
}
