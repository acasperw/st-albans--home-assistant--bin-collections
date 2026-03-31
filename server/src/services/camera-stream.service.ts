import { spawn } from 'child_process';

const RTSP_URL_TEMPLATE = process.env.CAMERA_RTSP_URL_TEMPLATE ?? 'rtsp://admin:Al22jb!123@192.168.68.63:554/Streaming/Channels/{channel}02';

function getRtspUrlForChannel(channel: number): string {
  const safeChannel = Number.isInteger(channel) && channel > 0 ? channel : 1;
  return RTSP_URL_TEMPLATE.replace('{channel}', String(safeChannel));
}

export async function captureSnapshot(channel: number = 1): Promise<Buffer> {
  const rtspUrl = getRtspUrlForChannel(channel);

  return new Promise<Buffer>((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-rtsp_transport', 'tcp',
      '-rtsp_flags', 'prefer_tcp',
      '-i', rtspUrl,
      '-an',
      '-frames:v', '1',
      '-q:v', '2',
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      'pipe:1'
    ]);

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      ffmpeg.kill('SIGTERM');
      reject(new Error('Snapshot capture timed out'));
    }, 8000);

    ffmpeg.stdout.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    ffmpeg.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    ffmpeg.on('error', (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      reject(error);
    });

    ffmpeg.on('close', (code) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);

      if (code === 0 && stdoutChunks.length > 0) {
        resolve(Buffer.concat(stdoutChunks));
        return;
      }

      const stderr = Buffer.concat(stderrChunks).toString().trim();
      reject(new Error(stderr || `Snapshot capture failed with code ${code}`));
    });
  });
}

export function streamFrames(channel: number = 1, res: any): () => void {
  const rtspUrl = getRtspUrlForChannel(channel);
  let isActive = true;
  let frameInterval: NodeJS.Timeout;
  const boundary = 'frame_boundary';

  res.set('Content-Type', `multipart/x-mixed-replace; boundary=${boundary}`);
  res.set('Connection', 'close');
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');

  const cleanup = () => {
    isActive = false;
    if (frameInterval) {
      clearInterval(frameInterval);
    }
  };

  res.on('close', cleanup);
  res.on('error', cleanup);

  // Send opening boundary
  res.write(`--${boundary}\r\n`);

  // Capture frames every 500ms (~2 fps) to avoid overwhelming NVR with connection attempts
  frameInterval = setInterval(async () => {
    if (!isActive) {
      return;
    }

    try {
      const jpegBuffer = await captureSnapshot(channel);
      res.write('Content-Type: image/jpeg\r\n');
      res.write(`Content-Length: ${jpegBuffer.length}\r\n`);
      res.write('Content-Disposition: inline; filename="frame.jpg"\r\n');
      res.write('\r\n');
      res.write(jpegBuffer);
      res.write(`\r\n--${boundary}\r\n`);
    } catch (err) {
      console.error('[StreamFrames] Frame capture error:', err);
      // Continue streaming, skip this frame on error
    }
  }, 500);

  return cleanup;
}
