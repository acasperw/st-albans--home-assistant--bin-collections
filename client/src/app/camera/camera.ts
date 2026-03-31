import { ChangeDetectionStrategy, Component, OnDestroy, effect, inject, signal, viewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import HLS from 'hls.js';

@Component({
  selector: 'app-camera',
  standalone: true,
  template: `
    <div class="camera-container">
      <div class="video-wrapper">
        @if (isLoading()) {
          <div class="loading">Initializing stream...</div>
        }
        @if (!error()) {
          @if (snapshotUrl()) {
            <img [src]="snapshotUrl()!" class="video-player" alt="Camera snapshot" />
          } @else {
            <video
              #videoPlayer
              autoplay
              muted
              playsinline
              controls
              preload="auto"
              class="video-player"
            ></video>
          }
        }
        @if (error()) {
          <div class="error-message">{{ error() }}</div>
        }
        @if (!error() && status()) {
          <div class="status-message">{{ status() }}</div>
        }
      </div>
      <div class="controls">
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
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CameraComponent implements OnDestroy {
  private router = inject(Router);
  private http = inject(HttpClient);

  protected videoPlayer = viewChild<HTMLVideoElement>('videoPlayer');
  protected isLoading = signal(true);
  protected error = signal<string | null>(null);
  protected status = signal('Waiting for stream...');
  protected snapshotUrl = signal<string | null>(null);

  private hls: HLS | null = null;
  private snapshotRefreshId: number | null = null;

  constructor() {
    effect(() => {
      this.initializeStream();
    });
  }

  ngOnDestroy(): void {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }

    if (this.snapshotRefreshId !== null) {
      window.clearInterval(this.snapshotRefreshId);
      this.snapshotRefreshId = null;
    }
  }

  private initializeStream(): void {
    this.http.post<{ success: boolean; hlsUrl: string; error?: string }>('/api/camera/start', {}).subscribe({
      next: (response) => {
        if (response.success && response.hlsUrl) {
          this.setupHlsStream(response.hlsUrl);
          return;
        }

        this.error.set(response.error ?? 'Failed to start stream');
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('[CameraComponent] Stream start failed:', err);
        this.error.set(err.error?.error ?? 'Unable to connect to camera stream');
        this.isLoading.set(false);
      }
    });
  }

  private setupHlsStream(hlsUrl: string): void {
    const video = this.videoPlayer();
    if (!video) {
      this.error.set('Video element not found');
      this.isLoading.set(false);
      return;
    }

    video.muted = true;
    this.attachVideoEventLogging(video);

    if (!HLS.isSupported()) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = hlsUrl;
        this.status.set('Using native HLS playback');
        this.isLoading.set(false);
        void video.play().catch((err: unknown) => {
          console.error('[CameraComponent] Autoplay failed:', err);
          this.status.set('Autoplay blocked, use play control');
        });
        return;
      }

      this.startSnapshotFallback('HLS not supported by this browser');
      return;
    }

    this.hls = new HLS({
      enableWorker: false,
      lowLatencyMode: true,
      backBufferLength: 90
    });

    this.status.set('Loading stream manifest...');
    this.hls.loadSource(hlsUrl);
    this.hls.attachMedia(video);

    this.hls.on(HLS.Events.MEDIA_ATTACHED, () => {
      this.status.set('Media attached');
    });

    this.hls.on(HLS.Events.MANIFEST_PARSED, () => {
      this.status.set('Stream ready');
      this.isLoading.set(false);
      void video.play().catch((err: unknown) => {
        console.error('[CameraComponent] Autoplay failed:', err);
        this.status.set('Autoplay blocked, use play control');
      });
    });

    this.hls.on(HLS.Events.FRAG_LOADED, () => {
      this.status.set('Receiving video...');
    });

    this.hls.on(HLS.Events.ERROR, (_event: unknown, data: { fatal?: boolean; details?: string; type?: string }) => {
      console.error('[CameraComponent] HLS error:', data);

      if (data.fatal || data.details === 'internalException') {
        this.startSnapshotFallback(data.details ?? data.type ?? 'HLS error');
        return;
      }

      this.status.set(`HLS warning: ${data.details ?? data.type ?? 'unknown'}`);
    });
  }

  private attachVideoEventLogging(video: HTMLVideoElement): void {
    video.onloadedmetadata = () => {
      this.status.set('Metadata loaded');
    };

    video.oncanplay = () => {
      this.status.set('Ready to play');
    };

    video.onplaying = () => {
      this.status.set('Playing');
      this.isLoading.set(false);
    };

    video.onerror = () => {
      const mediaError = video.error;
      const message = mediaError ? `Video error code ${mediaError.code}` : 'Video playback error';
      this.startSnapshotFallback(message);
    };
  }

  private startSnapshotFallback(reason: string): void {
    if (this.snapshotRefreshId !== null) {
      this.status.set('Using snapshot fallback');
      return;
    }

    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }

    this.error.set(null);
    this.isLoading.set(false);
    this.status.set(`Using snapshot fallback (${reason})`);

    const refreshSnapshot = () => {
      this.snapshotUrl.set(`/api/camera/snapshot.jpg?t=${Date.now()}`);
    };

    refreshSnapshot();
    this.snapshotRefreshId = window.setInterval(refreshSnapshot, 2000);
  }

  protected exitFullscreen(): void {
    this.ngOnDestroy();

    this.http.post('/api/camera/stop', {}).subscribe({
      error: (err) => console.error('[CameraComponent] Stop stream error:', err)
    });

    this.router.navigateByUrl('/');
  }
}
