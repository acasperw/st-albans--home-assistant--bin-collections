import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-camera',
  standalone: true,
  template: `
    <div class="camera-container">
      <div class="video-wrapper">
        @if (isLoading()) {
          <div class="loading">Loading camera snapshot...</div>
        }
        @if (!error()) {
          <img [src]="snapshotUrl()!" class="video-player" alt="Camera snapshot" />
        }
        @if (error()) {
          <div class="error-message">{{ error() }}</div>
        }
        @if (!error() && status()) {
          <div class="status-message">{{ status() }}</div>
        }
      </div>
      <div class="controls">
        <button (click)="prevChannel()" class="nav-btn" aria-label="Previous camera channel">
          ◀
        </button>
        <div class="channel-pill">CH {{ currentChannel() }}</div>
        <button (click)="nextChannel()" class="nav-btn" aria-label="Next camera channel">
          ▶
        </button>
        <button (click)="exitFullscreen()" class="exit-btn" aria-label="Exit camera view">
          ✕
        </button>
      </div>
    </div>
  `,
  styles: [`
    .camera-container {
      position: fixed;
      inset: 0;
      background: #000;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .video-wrapper {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .video-player {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .loading,
    .error-message {
      color: #fff;
      font-size: 1.2rem;
      text-align: center;
      padding: 2rem;
      font-family: system-ui, -apple-system, sans-serif;
    }

    .error-message {
      color: #ff6b6b;
    }

    .status-message {
      position: absolute;
      bottom: 16px;
      left: 16px;
      padding: 0.5rem 0.75rem;
      border-radius: 999px;
      background: rgba(0, 0, 0, 0.55);
      color: rgba(255, 255, 255, 0.85);
      font-size: 0.9rem;
      font-family: system-ui, -apple-system, sans-serif;
    }

    .controls {
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .exit-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.3);
      background: rgba(0, 0, 0, 0.6);
      color: rgba(255, 255, 255, 0.9);
      font-size: 1.4rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(4px);
    }

    .nav-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.3);
      background: rgba(0, 0, 0, 0.6);
      color: rgba(255, 255, 255, 0.95);
      font-size: 1.1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(4px);
    }

    .channel-pill {
      min-width: 64px;
      text-align: center;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.25);
      background: rgba(0, 0, 0, 0.55);
      color: rgba(255, 255, 255, 0.9);
      padding: 0.4rem 0.6rem;
      font-size: 0.85rem;
      font-family: system-ui, -apple-system, sans-serif;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CameraComponent implements OnDestroy {
  private router = inject(Router);
  private http = inject(HttpClient);

  protected isLoading = signal(true);
  protected error = signal<string | null>(null);
  protected status = signal('Live snapshot mode (1s refresh)');
  protected snapshotUrl = signal<string | null>(null);
  protected currentChannel = signal(1);

  private snapshotRefreshId: number | null = null;

  constructor() {
    this.initializeStream();
  }

  ngOnDestroy(): void {
    if (this.snapshotRefreshId !== null) {
      window.clearInterval(this.snapshotRefreshId);
      this.snapshotRefreshId = null;
    }
  }

  private initializeStream(): void {
    this.status.set(`Live snapshot mode (CH ${this.currentChannel()}, 1s refresh)`);

    const refreshSnapshot = () => {
      this.snapshotUrl.set(`/api/camera/snapshot.jpg?ch=${this.currentChannel()}&t=${Date.now()}`);
      this.isLoading.set(false);
      this.error.set(null);
    };

    // Load immediately, then refresh every second.
    refreshSnapshot();
    this.snapshotRefreshId = window.setInterval(refreshSnapshot, 1000);

    // Probe once so we can show a useful error message if snapshots fail.
    this.http.get(`/api/camera/snapshot.jpg?ch=${this.currentChannel()}`, { responseType: 'blob' }).subscribe({
      error: (err) => {
        console.error('[CameraComponent] Snapshot probe failed:', err);
        this.error.set('Unable to load camera snapshot');
        this.isLoading.set(false);
      }
    });
  }

  protected prevChannel(): void {
    const channel = this.currentChannel() <= 1 ? 6 : this.currentChannel() - 1;
    this.setChannel(channel);
  }

  protected nextChannel(): void {
    const channel = this.currentChannel() >= 6 ? 1 : this.currentChannel() + 1;
    this.setChannel(channel);
  }

  private setChannel(channel: number): void {
    this.currentChannel.set(channel);
    this.status.set(`Live snapshot mode (CH ${channel}, 1s refresh)`);
    this.snapshotUrl.set(`/api/camera/snapshot.jpg?ch=${channel}&t=${Date.now()}`);
  }

  protected exitFullscreen(): void {
    this.ngOnDestroy();

    this.router.navigateByUrl('/');
  }
}
