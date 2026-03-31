import { Router, Request, Response } from 'express';
import path from 'path';
import { existsSync, readFileSync } from 'fs';
import { startStream, stopStream, isStreamActive, getStreamStatus, getHLSPlaylistPath, initStreamDirectory } from '../services/camera-stream.service';

const router = Router();
const STREAMS_DIR = path.join(__dirname, '..', '..', 'data', 'streams');

// Initialize stream directory on module load
initStreamDirectory();

// GET /api/camera/status - check if stream is running
router.get('/camera/status', (req: Request, res: Response) => {
  const status = getStreamStatus();
  res.json({
    active: isStreamActive(),
    status: status,
    hlsUrl: isStreamActive() ? getHLSPlaylistPath() : null
  });
});

// POST /api/camera/start - start streaming
router.post('/camera/start', (req: Request, res: Response) => {
  try {
    if (!isStreamActive()) {
      startStream();
      // Give ffmpeg a moment to start creating segments
      setTimeout(() => {
        res.json({ success: true, message: 'Stream started', hlsUrl: getHLSPlaylistPath() });
      }, 1000);
    } else {
      res.json({ success: true, message: 'Stream already running', hlsUrl: getHLSPlaylistPath() });
    }
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
  const manifestPath = path.join(STREAMS_DIR, 'stream.m3u8');

  if (!existsSync(manifestPath)) {
    res.status(404).json({ error: 'Stream not available' });
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

// GET /api/camera/segment-*.ts - serve HLS segments
router.get(/\/camera\/segment-\d+\.ts$/, (req: Request, res: Response) => {
  const segmentName = path.basename(req.path);
  const segmentPath = path.join(STREAMS_DIR, segmentName);

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
