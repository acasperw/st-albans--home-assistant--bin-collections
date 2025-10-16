import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NotificationData } from '../../services/notification.service';

@Component({
  selector: 'app-notification',
  template: `
    @if (notification() && active()) {
      <div 
        class="notification"
        [class.info]="notification()?.type === 'info'"
        [class.warning]="notification()?.type === 'warning'"
        [class.error]="notification()?.type === 'error'"
        [class.success]="notification()?.type === 'success'"
        [class.clickable]="allowDismiss()"
        (click)="allowDismiss() ? onDismiss() : null"
        [attr.role]="allowDismiss() ? 'button' : 'alert'"
        [tabindex]="allowDismiss() ? 0 : -1"
        [attr.aria-label]="getAriaLabel()"
        (keydown.enter)="allowDismiss() ? onDismiss() : null"
        (keydown.space)="allowDismiss() ? onDismiss() : null">
        
        @if (notification()?.icon) {
          <div class="notification-icon bin-icon-overlay">
            {{ notification()?.icon }}
          </div>
        }
        
        <div class="notification-content">
          @if (notification()?.title) {
            <div class="notification-title">{{ notification()?.title }}</div>
          }
          @if (notification()?.message) {
            <div class="notification-message">{{ notification()?.message }}</div>
          }
        </div>
        
        @if (allowDismiss()) {
          <div class="notification-dismiss" aria-hidden="true">✕</div>
        }
      </div>
    }
  `,
  styles: [`
    .notification {
      position: fixed;
      bottom: var(--space--6);
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: var(--space--3);
      padding: var(--space--3) var(--space--4);
      border-radius: 16px;
      box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.4),
        0 0 0 1px rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(20px);
      user-select: none;
      transition: all 0.3s ease;
      z-index: 10001;
      font-family: var(--wp--preset--font-family--body-font);
      min-width: 350px;
      max-width: 600px;
      pointer-events: auto;
      animation: slideInFromBottom 0.6s ease-out;
    }

    .notification.clickable {
      cursor: pointer;
    }

    .notification.clickable:hover {
      transform: translateX(-50%) scale(1.02);
      box-shadow: 
        0 12px 40px rgba(0, 0, 0, 0.5),
        0 0 0 1px rgba(255, 255, 255, 0.15);
    }

    .notification.clickable:focus {
      outline: 3px solid rgba(255, 255, 255, 0.8);
      outline-offset: 3px;
    }

    @keyframes slideInFromBottom {
      0% {
        transform: translateX(-50%) translateY(100%);
        opacity: 0;
      }
      100% {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
      }
    }

    .notification.info {
      background: linear-gradient(135deg, 
        rgba(13, 110, 253, 0.92), 
        rgba(25, 135, 84, 0.88));
      color: #ffffff;
      border: 2px solid rgba(13, 110, 253, 0.6);
    }

    .notification.warning {
      background: linear-gradient(135deg, 
        rgba(255, 193, 7, 0.92), 
        rgba(255, 152, 0, 0.88));
      color: var(--wp--preset--color--dark);
      border: 2px solid rgba(255, 193, 7, 0.6);
    }

    .notification.error {
      background: linear-gradient(135deg, 
        rgba(220, 53, 69, 0.92), 
        rgba(185, 28, 28, 0.88));
      color: #ffffff;
      border: 2px solid rgba(220, 53, 69, 0.6);
    }

    .notification.success {
      background: linear-gradient(135deg, 
        rgba(25, 135, 84, 0.92), 
        rgba(32, 201, 151, 0.88));
      color: #ffffff;
      border: 2px solid rgba(25, 135, 84, 0.6);
    }

    .notification-icon {
      font-size: 2.5rem;
      line-height: 1;
      flex-shrink: 0;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
    }

    .notification-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: var(--space--1);
    }

    .notification-title {
      font-size: var(--wp--preset--font-size--message);
      font-weight: 600;
      line-height: 1.2;
    }

    .notification-message {
      font-size: var(--wp--preset--font-size--large);
      line-height: 1.4;
      opacity: 0.95;
      font-weight: 500;
    }

    .notification-dismiss {
      font-size: var(--wp--preset--font-size--text);
      opacity: 0.7;
      flex-shrink: 0;
      transition: opacity 0.2s ease;
      font-weight: 300;
    }

    .notification.clickable:hover .notification-dismiss {
      opacity: 1;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationComponent {
  // Input properties
  public notification = input<NotificationData | null>(null);
  public active = input<boolean>(true);
  public allowDismiss = input<boolean>(false);

  // Output events
  public dismiss = output<void>();

  public getAriaLabel(): string {
    const notif = this.notification();
    if (!notif) return '';
    
    const parts = [notif.title, notif.message].filter(Boolean);
    const baseLabel = parts.join(': ');
    return this.allowDismiss() ? `${baseLabel}. Click to dismiss.` : baseLabel;
  }

  public onDismiss(): void {
    if (this.allowDismiss()) {
      this.dismiss.emit();
    }
  }
}