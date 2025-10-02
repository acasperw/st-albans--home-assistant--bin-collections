import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import path from 'path';
import { ApiResponse, CacheData, HealthCheckResponse, TestScenario, NextTrainResponse } from './types';
import { processApiResponse } from './data-processor';
import { generateTestData } from './test-data';
import { getNextTrain } from './train-service';

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const UPRN = process.env.UPRN;

// Test mode configuration - set to true to return mock data
const TEST_MODE = process.env.TEST_MODE === 'true' || false;
const TEST_MODE_VARIANT: TestScenario = (process.env.TEST_MODE_VARIANT as TestScenario) || 'tomorrow';

// Cache configuration
const cache: CacheData = {
  data: null,
  processedData: null,
  timestamp: null,
  TTL: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
};

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
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Helper function to check if cache is valid
function isCacheValid(): boolean {
  if (!cache.data || !cache.timestamp) {
    return false;
  }
  const now = Date.now();
  return (now - cache.timestamp) < cache.TTL;
}

// Helper function to fetch fresh data from API
async function fetchFreshData(uprn: string): Promise<CacheData> {
  // console.log(`Fetching fresh bin collection data from API for UPRN: ${uprn}`);

  const response = await axios.post<ApiResponse>(
    'https://gis.stalbans.gov.uk/NoticeBoard9/VeoliaProxy.NoticeBoard.asmx/GetServicesByUprnAndNoticeBoard',
    {
      uprn: parseInt(uprn),
      noticeBoard: 'default'
    },
    {
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Accept': 'application/json'
      }
    }
  );

  // Update cache with both raw and processed data
  cache.data = response.data;
  cache.processedData = processApiResponse(response.data);
  cache.timestamp = Date.now();

  // Successfully fetched and cached bin collection data
  return cache;
}

app.get('/api/bin-collection', async (req: Request, res: Response): Promise<void> => {
  try {
    // If test mode is enabled, return mock data
    if (TEST_MODE) {
      console.log(`TEST_MODE enabled: returning mock data scenario='${TEST_MODE_VARIANT}'`);
      const testData = generateTestData(TEST_MODE_VARIANT);
      res.json(testData);
      return;
    }

    if (!UPRN) {
      res.status(500).json({
        error: 'UPRN not configured',
        message: 'UPRN environment variable is required'
      });
      return;
    }

    const uprn = UPRN;

    // Check if we have valid cached data
    if (isCacheValid() && cache.processedData) {
      // Serving cached processed bin collection data for UPRN: ${uprn}
      res.json(cache.processedData);
      return;
    }

    // Fetch fresh data if cache is invalid or empty
    const tempCache = await fetchFreshData(uprn);
    res.json(tempCache.processedData);

  } catch (error) {
    console.error('Error fetching bin collection data:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({
      error: 'Failed to fetch bin collection data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Next train endpoint (SAA -> HWW by default if not provided)
app.get('/api/train/next', async (req: Request, res: Response): Promise<void> => {
  try {
    const from = (req.query.from as string) || 'SAA';
    const to = (req.query.to as string) || 'HWW';
    const response: NextTrainResponse = await getNextTrain(from.toUpperCase(), to.toUpperCase());
    res.json(response);
  } catch (err) {
    console.error('Error fetching train data', err);
    res.status(500).json({ error: 'Failed to fetch train data' });
  }
});


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
