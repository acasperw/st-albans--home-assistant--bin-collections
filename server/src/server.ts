import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { HealthCheckResponse, TestScenario } from './types';
import { binCollectionRouter } from './routes/bin-collection.route';
import { cache, isCacheValid } from './services/bin-collection.service';

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const UPRN = process.env.UPRN;

// Test mode configuration - set to true to return mock data
const TEST_MODE = process.env.TEST_MODE === 'true' || false;
const TEST_MODE_VARIANT: TestScenario = (process.env.TEST_MODE_VARIANT as TestScenario) || 'tomorrow';

// Bin collection caching now handled in services/bin-collection.service

const app = express();

// Using CommonJS compilation; __dirname available after build.

app.use(express.json());

// Serve Angular static files (assumes Angular build outputs browser folder)
const activeClientDir = path.join(__dirname, '..', '..', 'client', 'dist', 'bin-collection-app', 'browser');
import { existsSync } from 'fs';
if (existsSync(activeClientDir)) {
  app.use(express.static(activeClientDir));
}

// Enable CORS for API routes during development
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:4200');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Mount bin collection routes under /api
app.use('/api', binCollectionRouter);

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  const cacheAge = cache.timestamp ? Math.floor((Date.now() - cache.timestamp) / 1000 / 60) : null;

  const healthResponse: HealthCheckResponse = {
    status: 'healthy',
    uprn: UPRN,
    timestamp: new Date().toISOString(),
    cache: {
      hasData: !!cache.processedData,
      ageInMinutes: cacheAge,
      isValid: isCacheValid()
    },
    testMode: {
      enabled: TEST_MODE,
      variant: TEST_MODE_VARIANT
    }
  };

  res.json(healthResponse);
});

// (Simplified) No late-mount logic; rebuild before starting server if missing.

// SPA fallback middleware (must be AFTER other routes & static)
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api')) return next();
  if (!existsSync(activeClientDir)) return next();
  const indexPath = path.join(activeClientDir, 'index.html');
  if (!existsSync(indexPath)) return next();
  res.sendFile(indexPath, err => { if (err) next(); });
});

app.listen(Number(PORT), HOST, () => {
  console.log(`Server listening on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  if (!existsSync(activeClientDir)) {
    console.log('Static Angular build not found (UI pages will 404 until built).');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});
