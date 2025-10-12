import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, OnDestroy, computed, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { interval, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TemperatureNotificationService } from '../../services/temperature-notification.service';

@Component({
  selector: 'app-weather-badge',
  templateUrl: './weather-badge.component.html',
  styleUrl: './weather-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeatherBadgeComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);
  private temperatureNotificationService = inject(TemperatureNotificationService);

  // Parent can hint active state (e.g. clock visible) to pause rotation if desired
  public active = input<boolean>(true);

  // Weather signals
  public temperatureC = signal<number | null>(null);
  public precipProb = signal<number | null>(null); // daily max precipitation probability
  public weatherCode = signal<number | null>(null);
  public overnightMinTemp = signal<number | null>(null); // overnight minimum temperature
  public maxTempC = signal<number | null>(null);
  public hasWeather = computed(() => this.temperatureC() !== null);

  // Rotation
  private rotateTimer: ReturnType<typeof setInterval> | null = null;
  public weatherStateIndex = signal(0);

  public weatherIcon = computed(() => this.mapWeatherIcon(this.weatherCode()));
  public weatherLabel = computed(() => this.mapWeatherLabel(this.weatherCode()));
  public maxTempDisplay = computed(() => {
    const max = this.maxTempC();
    return max == null ? '' : `Max ${max}°C`;
  });
  public maxTempDescription = computed(() => {
    const max = this.maxTempC();
    return max == null ? '' : `Maximum temperature ${max} degrees`;
  });

  public rainChanceText = computed(() => {
    const p = this.precipProb();
    if (p == null || p < 20) return '';
    if (p <= 50) return `Rain chance ${p}%`;
    if (p <= 80) return `Rain likely (${p}%)`;
    return `Rain very likely: ${p}%`;
  });

  public weatherAriaLabel = computed(() => {
    const parts: string[] = [];
    const label = this.weatherLabel();
    const currentTemp = this.temperatureC();
    const rain = this.rainChanceText();
    const maxDescription = this.maxTempDescription();

    if (label) parts.push(label);
    if (currentTemp != null) parts.push(`${currentTemp} degrees`);
    if (rain) parts.push(rain);
    if (maxDescription) parts.push(maxDescription);

    return parts.join(', ');
  });

  ngOnInit(): void {
    this.fetchWeather();
    // Update weather every 3 hours
    interval(3 * 60 * 60 * 1000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.fetchWeather());
    this.startRotation();
  }

  ngOnDestroy(): void {
    if (this.rotateTimer !== null) {
      clearInterval(this.rotateTimer);
      this.rotateTimer = null;
    }
  }

  private startRotation() {
    this.rotateTimer = setInterval(() => {
      if (!this.active() || !this.hasWeather()) {
        return;
      }

      const availableStates = this.getAvailableStates();

      if (availableStates.length <= 1) {
        this.weatherStateIndex.set(availableStates[0] ?? 0);
        return;
      }

      const currentState = this.weatherStateIndex();
      const currentIndex = availableStates.indexOf(currentState);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % availableStates.length;
      this.weatherStateIndex.set(availableStates[nextIndex]);
    }, 8000);
  }

  private fetchWeather() {
    const lat = 51.721236;
    const lon = -0.343218;
  // Include hourly temps so we can suppress the max once it has passed for the day
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=precipitation_probability_max,temperature_2m_min,temperature_2m_max&hourly=temperature_2m&timezone=auto&forecast_days=2`;
    this.http.get<any>(url).pipe(catchError(() => of(null))).subscribe(data => {
      if (!data) return;

      // Reset notification suppression on each weather fetch
      this.temperatureNotificationService.resetSuppression();

      // Current weather data
      if (data.current) {
        if (typeof data.current.temperature_2m === 'number') this.temperatureC.set(Math.round(data.current.temperature_2m));
        else this.temperatureC.set(null);
        if (typeof data.current.weather_code === 'number') this.weatherCode.set(data.current.weather_code);
        else this.weatherCode.set(null);
      }

      try {
        if (data.daily && Array.isArray(data.daily.precipitation_probability_max)) {
          // Today is index 0 when timezone set to auto
          const todayVal = data.daily.precipitation_probability_max[0];
          if (typeof todayVal === 'number') this.precipProb.set(todayVal);
          else this.precipProb.set(null);
        } else {
          this.precipProb.set(null);
        }

        // Get tonight's minimum temperature
        if (data.daily && Array.isArray(data.daily.temperature_2m_min)) {
          const currentHour = new Date().getHours();
          let overnightMin: number | undefined;

          // Logic to determine which night's minimum temperature to use
          if (currentHour >= 6 && currentHour < 18) {
            // During daytime (6 AM - 6 PM), show tonight's minimum (index 0 for today)
            overnightMin = data.daily.temperature_2m_min[0];
          } else {
            // During evening/night (6 PM - 6 AM), show upcoming night's minimum
            // If it's already evening/night, we want the next night's minimum (index 1)
            overnightMin = data.daily.temperature_2m_min[1] ?? data.daily.temperature_2m_min[0];
          }

          if (typeof overnightMin === 'number') {
            const roundedMin = Math.round(overnightMin);
            this.overnightMinTemp.set(roundedMin);
            // Trigger notification check for overnight temperature
            this.temperatureNotificationService.checkOvernightTemperature(roundedMin);
          }
        }

        this.updateMaxTemperatureState(data);
      } catch { /* swallow */ }

      this.ensureValidStateIndex();
    });
  }

  private updateMaxTemperatureState(data: any): void {
    // Default to no max temp so we never show stale data when parsing fails
    let upcomingMax: number | null = null;

    if (data?.daily && Array.isArray(data.daily.temperature_2m_max)) {
      const todayMax = data.daily.temperature_2m_max[0];
      if (typeof todayMax === 'number') {
        upcomingMax = Math.round(todayMax);
      }
    }

    if (upcomingMax === null || !data?.hourly || !Array.isArray(data.hourly.temperature_2m) || !Array.isArray(data.hourly.time)) {
      this.maxTempC.set(upcomingMax);
      return;
    }

    // Walk hourly temps for today to find when the forecast peak occurs
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDate = now.getDate();
    let peakIndex: number | null = null;

    for (let i = 0; i < data.hourly.temperature_2m.length; i++) {
      const temp = data.hourly.temperature_2m[i];
      const timeStr = data.hourly.time[i];
      if (typeof temp !== 'number' || typeof timeStr !== 'string') continue;

      const stamp = new Date(timeStr);
      if (Number.isNaN(stamp.getTime())) continue;
      if (stamp.getFullYear() !== todayYear || stamp.getMonth() !== todayMonth || stamp.getDate() !== todayDate) continue;

      if (peakIndex === null || temp > data.hourly.temperature_2m[peakIndex]) {
        peakIndex = i;
      }
    }

    if (peakIndex === null) {
      this.maxTempC.set(upcomingMax);
      return;
    }

    const peakTime = new Date(data.hourly.time[peakIndex]);
    if (Number.isNaN(peakTime.getTime())) {
      this.maxTempC.set(upcomingMax);
      return;
    }

    const peakTimeMs = peakTime.getTime();
    const currentMs = now.getTime();

    if (peakTimeMs < currentMs) {
      // Peak already occurred, drop the max state
      this.maxTempC.set(null);
    } else {
      this.maxTempC.set(upcomingMax);
    }
  }

  private ensureValidStateIndex(): void {
    const availableStates = this.getAvailableStates();

    if (availableStates.length === 0) {
      this.weatherStateIndex.set(0);
      return;
    }

    if (!availableStates.includes(this.weatherStateIndex())) {
      this.weatherStateIndex.set(availableStates[0]);
    }
  }

  private getAvailableStates(): number[] {
    const states: number[] = [];

    if (this.hasWeather()) {
      states.push(0);
    }

    if (this.rainChanceText()) {
      states.push(1);
    }

    if (this.maxTempC() !== null) {
      states.push(2);
    }

    return states;
  }

  private mapWeatherIcon(code: number | null): string {
    if (code == null) return '';
    if ([0].includes(code)) return '☀️';
    if ([1, 2].includes(code)) return '⛅';
    if ([3].includes(code)) return '☁️';
    if ([45, 48].includes(code)) return '🌫️';
    if ([51, 53, 55, 56, 57].includes(code)) return '🌦️';
    if ([61, 63, 65].includes(code)) return '🌧️';
    if ([66, 67].includes(code)) return '🌧️';
    if ([71, 73, 75, 77].includes(code)) return '🌨️';
    if ([80, 81, 82].includes(code)) return '🌦️';
    if ([85, 86].includes(code)) return '🌨️';
    if ([95].includes(code)) return '⛈️';
    if ([96, 99].includes(code)) return '⛈️';
    return '❓';
  }

  private mapWeatherLabel(code: number | null): string {
    if (code == null) return '';
    const map: Record<number, string> = {
      0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime fog',
      51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
      61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain', 71: 'Light snow',
      73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains', 80: 'Light showers', 81: 'Showers', 82: 'Heavy showers',
      85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm hail', 99: 'Thunderstorm hail'
    };
    return map[code] || 'Unknown';
  }
}
