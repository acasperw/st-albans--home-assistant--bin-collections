import { Component, inject, input } from '@angular/core';
import { TemperatureNotificationService } from '../../services/temperature-notification.service';

@Component({
  selector: 'app-temperature-notification',
  template: `
    @if (notificationService.hasNotification() && active()) {
      <div 
        class="temperature-notification"
        [class.warning]="notificationService.notification()?.type === 'warning'"
        [class.error]="notificationService.notification()?.type === 'error'"
        (click)="dismissNotification()"
        role="button"
        tabindex="0"
        [attr.aria-label]="'Temperature warning: ' + notificationService.notification()?.message + '. Click to dismiss.'"
        (keydown.enter)="dismissNotification()"
        (keydown.space)="dismissNotification()">
        
        <div class="notification-icon bin-icon-overlay">
          @if (notificationService.notification()?.type === 'warning') {
            ⚠️
          } @else if (notificationService.notification()?.type === 'error') {
            🥶
          }
        </div>
        
        <div class="notification-content">
          <div class="notification-temp">{{ notificationService.notification()?.temperature }}°C tonight</div>
          <div class="notification-message">{{ notificationService.notification()?.message }}</div>
        </div>
        
        <div class="notification-dismiss" aria-hidden="true">✕</div>
      </div>
    }
  `,
  styles: [`
    .temperature-notification {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.5rem;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
      cursor: pointer;
      user-select: none;
      transition: all 0.3s ease;
      z-index: 10001;
      font-family: system-ui, sans-serif;
      min-width: 280px;
      max-width: 400px;
      pointer-events: auto; /* Enable interactions within clock overlay */
      animation: slideInFromRight 0.5s ease-out;
    }

    @keyframes slideInFromRight {
      0% {
        transform: translateX(100%);
        opacity: 0;
      }
      100% {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .temperature-notification:hover {
      transform: scale(1.02);
      box-shadow: 0 6px 25px rgba(0, 0, 0, 0.4);
    }

    .temperature-notification:focus {
      outline: 2px solid rgba(255, 255, 255, 0.7);
      outline-offset: 2px;
    }

    .temperature-notification.warning {
      background: linear-gradient(135deg, rgba(255, 193, 7, 0.95), rgba(255, 152, 0, 0.95));
      color: #1a1a1a;
      border: 1px solid rgba(255, 193, 7, 0.8);
    }

    .temperature-notification.error {
      background: linear-gradient(135deg, rgba(220, 53, 69, 0.95), rgba(185, 28, 28, 0.95));
      color: #ffffff;
      border: 1px solid rgba(220, 53, 69, 0.8);
    }

    .notification-icon {
      font-size: 2rem;
      line-height: 1;
      flex-shrink: 0;
    }

    .notification-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .notification-temp {
      font-size: 1.1rem;
      font-weight: 600;
      line-height: 1.2;
    }

    .notification-message {
      font-size: 0.9rem;
      line-height: 1.3;
      opacity: 0.95;
    }

    .notification-dismiss {
      font-size: 1.2rem;
      opacity: 0.7;
      flex-shrink: 0;
      transition: opacity 0.2s ease;
    }

    .temperature-notification:hover .notification-dismiss {
      opacity: 1;
    }
  `]
})
export class TemperatureNotificationComponent {
  protected notificationService = inject(TemperatureNotificationService);
  
  // Show when active (can be controlled by parent - e.g., idle mode, specific routes, etc.)
  public active = input<boolean>(true); // Default to true for more flexibility

  public dismissNotification(): void {
    this.notificationService.clearNotification();
  }
}