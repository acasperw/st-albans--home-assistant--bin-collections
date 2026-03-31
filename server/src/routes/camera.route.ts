import { Router, Request, Response } from 'express';
import path from 'path';
import { existsSync, readFileSync } from 'fs';
import {
  startStream,
  stopStream,
  isStreamActive,
  getStreamStatus,
  getHLSPlaylistPath,
  initStreamDirectory,
  getHLSManifestFsPath,
  getStreamFileFsPath,
  getLastStreamError
} from '../services/camera-stream.service';

const router = Router();

// Initialize stream directory on module load
initStreamDirectory();

async function waitForManifest(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (existsSync(getHLSManifestFsPath())) {
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  return false;
}

// GET /api/camera/status - check if stream is running
router.get('/camera/status', (req: Request, res: Response) => {
  const status = getStreamStatus();
  res.json({
    active: isStreamActive(),
    status: status,
    hlsUrl: isStreamActive() ? getHLSPlaylistPath() : null,
    error: getLastStreamError()
  });
});

// POST /api/camera/start - start streaming
router.post('/camera/start', async (req: Request, res: Response) => {
  try {
    if (!isStreamActive()) {
      startStream();
      const ready = await waitForManifest(8000);

      if (!ready) {
        res.status(502).json({
          success: false,
          error: getLastStreamError() ?? 'Stream did not become ready in time'
        });
        return;
      }
    }

    res.json({ success: true, message: 'Stream ready', hlsUrl: getHLSPlaylistPath() });
  } catch (err) {
    console.error('[CameraRoute] Error starting stream:', err);
    res.status(500).json({ success: false, error: String(err) });
  }
});

// POST /api/camera/stop - stop streaming
router.post('/camera/stop', (req: Request, res: Response) => {
  try {
    stopStream();
    res.json({ success: true, message: 'Stream stopped' });
  } catch (err) {
    console.error('[CameraRoute] Error stopping stream:', err);
    res.status(500).json({ success: false, error: String(err) });
  }
});

// GET /api/camera/stream.m3u8 - serve HLS manifest
router.get('/camera/stream.m3u8', (req: Request, res: Response) => {
  const manifestPath = getHLSManifestFsPath();

  if (!existsSync(manifestPath)) {
    res.status(404).json({ error: getLastStreamError() ?? 'Stream not available' });
    return;
  }

  try {
    const manifest = readFileSync(manifestPath, 'utf-8');
    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(manifest);
  } catch (err) {
    console.error('[CameraRoute] Error reading manifest:', err);
    res.status(500).json({ error: 'Failed to read stream manifest' });
  }
});

// GET /api/camera/*.ts - serve HLS segments produced by ffmpeg
router.get(/\/camera\/[A-Za-z0-9._-]+\.ts$/, (req: Request, res: Response) => {
  const segmentName = path.basename(req.path);
  const segmentPath = getStreamFileFsPath(segmentName);

  if (!existsSync(segmentPath)) {
    res.status(404).send('Segment not found');
    return;
  }

  try {
    res.set('Content-Type', 'video/MP2T');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(segmentPath);
  } catch (err) {
    console.error('[CameraRoute] Error sending segment:', err);
    res.status(500).send('Failed to send segment');
  }
});

export const cameraRouter = router;
