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
