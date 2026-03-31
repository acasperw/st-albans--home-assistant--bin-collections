import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';

const STREAMS_DIR = path.join(__dirname, '..', '..', 'data', 'streams');
const HLS_SEGMENT_TIME = 2; // seconds per segment
const HLS_LIST_SIZE = 3; // keep 3 segments in playlist
const RTSP_URL = process.env.CAMERA_RTSP_URL ?? 'rtsp://admin:Al22jb!123@192.168.68.63:554/Streaming/Channels/102';
const HLS_PLAYLIST_FILENAME = 'stream.m3u8';
const HLS_SEGMENT_FILENAME_PATTERN = 'segment-%03d.ts';

let ffmpegProcess: ChildProcess | null = null;
let isStreaming = false;
let streamStartedAt = 0;
let lastStreamError: string | null = null;

export function initStreamDirectory(): void {
  if (!existsSync(STREAMS_DIR)) {
    mkdirSync(STREAMS_DIR, { recursive: true });
  }
}

export function startStream(): void {
  if (isStreaming) return;

  initStreamDirectory();
  cleanupStreamFiles();

  const hlsPath = path.join(STREAMS_DIR, HLS_PLAYLIST_FILENAME);
  const segmentPattern = path.join(STREAMS_DIR, HLS_SEGMENT_FILENAME_PATTERN);

  // Use the camera sub-stream by default and avoid transcoding to keep startup fast on the Pi.
  ffmpegProcess = spawn('ffmpeg', [
    '-hide_banner',
    '-loglevel', 'info',
    '-rtsp_transport', 'tcp',
    '-rtsp_flags', 'prefer_tcp',
    '-fflags', '+genpts',
    '-use_wallclock_as_timestamps', '1',
    '-i', RTSP_URL,
    '-an',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-profile:v', 'baseline',
    '-level:v', '3.1',
    '-pix_fmt', 'yuv420p',
    '-g', '24',
    '-keyint_min', '24',
    '-sc_threshold', '0',
    '-f', 'hls',
    '-hls_time', String(HLS_SEGMENT_TIME),
    '-hls_list_size', String(HLS_LIST_SIZE),
    '-hls_flags', 'delete_segments+append_list',
    '-hls_segment_filename', segmentPattern,
    hlsPath
  ]);

  ffmpegProcess.on('error', (err) => {
    console.error('[CameraStream] ffmpeg spawn failed:', err.message);
    lastStreamError = err.message;
    isStreaming = false;
  });

  ffmpegProcess.stderr?.on('data', (data) => {
    const lines = data
      .toString()
      .split(/\r?\n/)
      .map((line: string) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      if (/error|401|403|404|unauthorized|forbidden|timed out|refused|method DESCRIBE failed|Invalid data/i.test(line)) {
        lastStreamError = line;
      }

      console.log('[CameraStream] ffmpeg:', line);
    }
  });

  ffmpegProcess.on('exit', (code) => {
    console.log(`[CameraStream] ffmpeg exited with code ${code}`);
    isStreaming = false;
    ffmpegProcess = null;
  });

  isStreaming = true;
  streamStartedAt = Date.now();
  lastStreamError = null;
  console.log('[CameraStream] Starting stream conversion (RTSP → HLS)');
}

export function stopStream(): void {
  if (!ffmpegProcess) return;

  console.log('[CameraStream] Stopping stream...');
  ffmpegProcess.kill('SIGTERM');
  ffmpegProcess = null;
  isStreaming = false;
  streamStartedAt = 0;

  cleanupStreamFiles();
}

function cleanupStreamFiles(): void {
  try {
    if (existsSync(STREAMS_DIR)) {
      readdirSync(STREAMS_DIR).forEach((file) => {
        const filePath = path.join(STREAMS_DIR, file);
        if (file.endsWith('.ts') || file === HLS_PLAYLIST_FILENAME) {
          unlinkSync(filePath);
        }
      });
    }
  } catch (err) {
    console.error('[CameraStream] Error cleaning up files:', err);
  }
}

export function isStreamActive(): boolean {
  return isStreaming && ffmpegProcess !== null;
}

export function getStreamStatus(): { active: boolean; uptime: number; lastCheck: number } {
  const now = Date.now();
  return {
    active: isStreamActive(),
    uptime: isStreaming ? now - streamStartedAt : 0,
    lastCheck: now
  };
}

export function getHLSPlaylistPath(): string {
  return '/api/camera/stream.m3u8';
}

export function getHLSManifestFsPath(): string {
  return path.join(STREAMS_DIR, HLS_PLAYLIST_FILENAME);
}

export function getStreamFileFsPath(fileName: string): string {
  return path.join(STREAMS_DIR, fileName);
}

export function getLastStreamError(): string | null {
  return lastStreamError;
}
