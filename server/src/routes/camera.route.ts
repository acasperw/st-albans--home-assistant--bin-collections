import { Router, Request, Response } from 'express';
import { captureSnapshot } from '../services/camera-stream.service';

const router = Router();

// GET /api/camera/snapshot.jpg - capture a single JPEG frame from RTSP
router.get('/camera/snapshot.jpg', async (req: Request, res: Response) => {
  try {
    const queryChannel = Number.parseInt(String(req.query.ch ?? '1'), 10);
    const channel = Number.isNaN(queryChannel) ? 1 : Math.min(Math.max(queryChannel, 1), 6);
    const imageBuffer = await captureSnapshot(channel);
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(imageBuffer);
  } catch (err) {
    console.error('[CameraRoute] Error capturing snapshot:', err);
    res.status(502).json({ error: String(err) });
  }
});

export const cameraRouter = router;
