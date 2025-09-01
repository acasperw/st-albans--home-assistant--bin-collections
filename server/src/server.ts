import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { ApiResponse, CacheData, HealthCheckResponse } from './types';
import { processApiResponse } from './data-processor';

// Configuration
const PORT = process.env.PORT || 3000;
const UPRN = process.env.UPRN;

// Cache configuration
const cache: CacheData = {
  data: null,
  processedData: null,
  timestamp: null,
  TTL: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
};

const app = express();

app.use(express.json());

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
  console.log(`Fetching fresh bin collection data from API for UPRN: ${uprn}`);

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

  console.log('Successfully fetched and cached bin collection data');
  return cache;
}

app.get('/api/bin-collection', async (req: Request, res: Response): Promise<void> => {
  try {
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
      console.log(`Serving cached processed bin collection data for UPRN: ${uprn}`);
      res.json(cache);
      return;
    }

    // Fetch fresh data if cache is invalid or empty
    const tempCache = await fetchFreshData(uprn);
    res.json(tempCache);

  } catch (error) {
    console.error('Error fetching bin collection data:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({
      error: 'Failed to fetch bin collection data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
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
      hasData: !!cache.data,
      ageInMinutes: cacheAge,
      isValid: isCacheValid()
    }
  };

  res.json(healthResponse);
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});
