import { Component, OnInit, OnDestroy, signal, computed, input, ChangeDetectionStrategy } from '@angular/core';
import { WeatherBadgeComponent } from '../shared/components/weather-badge/weather-badge.component';

@Component({
  selector: 'app-clock',
  imports: [WeatherBadgeComponent],
  templateUrl: './clock.html',
  styleUrl: './clock.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Clock implements OnInit, OnDestroy {
  private secondTimer: ReturnType<typeof setInterval> | null = null;
  private now = signal(new Date());

  // Active (visible) state passed from parent for fade animation
  public active = input<boolean>(false);

  // HH:MM main display
  public time = computed(() => {
    const d = this.now();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  });

  // Seconds (00-59)
  public seconds = computed(() => String(this.now().getSeconds()).padStart(2, '0'));

  ngOnInit(): void {
    this.alignAndStartSecondTicks();
  }

  ngOnDestroy(): void {
    if (this.secondTimer !== null) {
      clearInterval(this.secondTimer);
      this.secondTimer = null;
    }
  }

  private alignAndStartSecondTicks() {
    // Set current time immediately
    this.now.set(new Date());
    // Align first tick to next second boundary for smoothness
    const ms = this.now().getMilliseconds();
    setTimeout(() => {
      this.now.set(new Date());
      this.secondTimer = setInterval(() => this.now.set(new Date()), 1000);
    }, 1000 - ms);
  }

}
