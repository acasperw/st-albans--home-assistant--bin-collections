import { Component, DestroyRef, OnInit, OnDestroy, computed, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { interval, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-weather-badge',
  templateUrl: './weather-badge.component.html',
  styleUrl: './weather-badge.component.scss'
})
export class WeatherBadgeComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);

  // Parent can hint active state (e.g. clock visible) to pause rotation if desired
  public active = input<boolean>(true);

  // Weather signals
  public temperatureC = signal<number | null>(null);
  public precipProb = signal<number | null>(null); // daily max precipitation probability
  public weatherCode = signal<number | null>(null);
  public hasWeather = computed(() => this.temperatureC() !== null);

  // Rotation
  private rotateTimer: any;
  public weatherStateIndex = signal(0);
  private readonly totalStates = 2;

  public weatherIcon = computed(() => this.mapWeatherIcon(this.weatherCode()));
  public weatherLabel = computed(() => this.mapWeatherLabel(this.weatherCode()));

  public rainChanceText = computed(() => {
    const p = this.precipProb();
    if (p == null || p < 20) return '';
    if (p <= 50) return `Rain chance ${p}%`;
    if (p <= 80) return `Rain likely (${p}%)`;
    return `Rain very likely: ${p}%`;
  });

  ngOnInit(): void {
    this.fetchWeather();
    interval(10 * 60 * 1000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.fetchWeather());
    this.startRotation();
  }

  ngOnDestroy(): void {
    clearInterval(this.rotateTimer);
  }

  private startRotation() {
    this.rotateTimer = setInterval(() => {
      if (this.active() && this.hasWeather()) {
        // Only rotate if we have rain text to show (state 1)
        const hasRain = this.rainChanceText() !== '';
        if (hasRain) {
          this.weatherStateIndex.update(i => (i + 1) % this.totalStates);
        } else {
          // Stay on temperature (state 0) if no rain info
          this.weatherStateIndex.set(0);
        }
      }
    }, 4000);
  }

  private fetchWeather() {
    const lat = 51.7167;
    const lon = -0.3333;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=precipitation_probability_max&timezone=auto`;
    this.http.get<any>(url).pipe(catchError(() => of(null))).subscribe(data => {
      if (!data) return;
      if (data.current) {
        if (typeof data.current.temperature_2m === 'number') this.temperatureC.set(Math.round(data.current.temperature_2m));
        if (typeof data.current.weather_code === 'number') this.weatherCode.set(data.current.weather_code);
      }
      try {
        if (data.daily && Array.isArray(data.daily.precipitation_probability_max)) {
          // Today is index 0 when timezone set to auto
          const todayVal = data.daily.precipitation_probability_max[0];
          if (typeof todayVal === 'number') this.precipProb.set(todayVal);
        }
      } catch { /* swallow */ }
    });
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
