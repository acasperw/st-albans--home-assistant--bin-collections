import { Router, Request, Response } from 'express';
import { TestScenario, ProcessedApiResponse } from '../types';
import { generateTestData } from '../test-data';
import { fetchFreshData, isCacheValid, withDynamicRelativeFields, cache } from '../services/bin-collection.service';

// Environment / config
const UPRN = process.env.UPRN;
const TEST_MODE = process.env.TEST_MODE === 'true' || false;
const TEST_MODE_VARIANT: TestScenario = (process.env.TEST_MODE_VARIANT as TestScenario) || 'tomorrow';

// Router
export const binCollectionRouter = Router();

binCollectionRouter.get('/bin-collection', async (req: Request, res: Response): Promise<void> => {
  try {
    if (TEST_MODE) {
      console.log(`TEST_MODE enabled: returning mock data scenario='${TEST_MODE_VARIANT}'`);
      res.json(generateTestData(TEST_MODE_VARIANT));
      return;
    }

    if (!UPRN) {
      res.status(500).json({
        error: 'UPRN not configured',
        message: 'UPRN environment variable is required'
      });
      return;
    }

    if (isCacheValid() && cache.processedData) {
      res.json(withDynamicRelativeFields(cache.processedData));
      return;
    }

    const fresh = await fetchFreshData(UPRN);
    res.json(withDynamicRelativeFields(fresh.processedData!));
  } catch (error) {
    console.error('Error fetching bin collection data:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({
      error: 'Failed to fetch bin collection data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
