import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'fs';

const STREAMS_DIR = path.join(__dirname, '..', '..', 'data', 'streams');
const HLS_SEGMENT_TIME = 2; // seconds per segment
const HLS_LIST_SIZE = 3; // keep 3 segments in playlist
const RTSP_URL = 'rtsp://admin:Al22jb!123@192.168.68.63:554/Streaming/Channels/101';
const RTSP_TIMEOUT = 5000; // 5 second timeout to detect stream unavailable

let ffmpegProcess: ChildProcess | null = null;
let isStreaming = false;
let lastHealthCheck = 0;

export function initStreamDirectory(): void {
  if (!existsSync(STREAMS_DIR)) {
    mkdirSync(STREAMS_DIR, { recursive: true });
  }
}

export function startStream(): void {
  if (isStreaming) return;

  initStreamDirectory();

  const hlsPath = path.join(STREAMS_DIR, 'stream.m3u8');
  const segmentPattern = path.join(STREAMS_DIR, 'segment-%03d.ts');

  // ffmpeg: convert RTSP to HLS segments (with digest auth support)
  ffmpegProcess = spawn('ffmpeg', [
    '-rtsp_transport', 'tcp',
    '-rtsp_flags', 'prefer_tcp',
    '-i', RTSP_URL,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '28',
    '-maxrate', '2500k',
    '-bufsize', '5000k',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-f', 'hls',
    '-hls_time', String(HLS_SEGMENT_TIME),
    '-hls_list_size', String(HLS_LIST_SIZE),
    '-hls_flags', 'delete_segments',
    '-hls_playlist_type', 'event',
    hlsPath
  ]);

  ffmpegProcess.on('error', (err) => {
    console.error('[CameraStream] ffmpeg spawn failed:', err.message);
    isStreaming = false;
  });

  ffmpegProcess.stderr?.on('data', (data) => {
    const msg = data.toString();
    // Log only important messages
    if (msg.includes('error') || msg.includes('Connection refused')) {
      console.error('[CameraStream] ffmpeg:', msg.slice(0, 100));
    }
  });

  ffmpegProcess.on('exit', (code) => {
    console.log(`[CameraStream] ffmpeg exited with code ${code}`);
    isStreaming = false;
    ffmpegProcess = null;
  });

  isStreaming = true;
  console.log('[CameraStream] Starting stream conversion (RTSP → HLS)');
}

export function stopStream(): void {
  if (!ffmpegProcess) return;

  console.log('[CameraStream] Stopping stream...');
  ffmpegProcess.kill('SIGTERM');
  ffmpegProcess = null;
  isStreaming = false;

  // Clean up segment files
  try {
    if (existsSync(STREAMS_DIR)) {
      readdirSync(STREAMS_DIR).forEach((file) => {
        const filePath = path.join(STREAMS_DIR, file);
        if (file.startsWith('segment-') || file === 'stream.m3u8') {
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
    uptime: isStreaming ? now - lastHealthCheck : 0,
    lastCheck: now
  };
}

export function getHLSPlaylistPath(): string {
  return '/api/camera/stream.m3u8';
}
