import axios from 'axios';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { ApiResponse, CacheData, ProcessedApiResponse } from '../types';
import { processApiResponse, getDaysUntil } from '../data-processor';
import { generateFallbackSchedule, isApiBlocked } from './fallback-schedule.service';

const DISK_CACHE_FILE = path.join(__dirname, '..', '..', 'data', 'bin-collection-cache.json');

interface DiskCachePayload {
  data: ApiResponse;
  timestamp: number;
}

// Cache configuration (1 week)
export const cache: CacheData = {
  data: null,
  processedData: null,
  timestamp: null,
  TTL: 7 * 24 * 60 * 60 * 1000
};

function loadCacheFromDisk(): void {
  try {
    if (!existsSync(DISK_CACHE_FILE)) return;

    const raw = readFileSync(DISK_CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DiskCachePayload>;
    if (!parsed.data || typeof parsed.timestamp !== 'number') {
      return;
    }

    const age = Date.now() - parsed.timestamp;
    if (age >= cache.TTL) {
      console.warn('Persistent bin cache is older than TTL, ignoring it');
      return;
    }

    cache.data = parsed.data;
    const processed = processApiResponse(parsed.data);
    processed.isFallback = false;
    cache.processedData = processed;
    cache.timestamp = parsed.timestamp;
    console.log(`Loaded persistent bin cache from disk (age: ${Math.floor(age / 1000 / 60)} minutes)`);
  } catch (error) {
    console.warn(
      'Failed to load persistent bin cache from disk:',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

function persistCacheToDisk(payload: DiskCachePayload): void {
  try {
    mkdirSync(path.dirname(DISK_CACHE_FILE), { recursive: true });
    writeFileSync(DISK_CACHE_FILE, JSON.stringify(payload), 'utf8');
  } catch (error) {
    console.warn(
      'Failed to persist bin cache to disk:',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

loadCacheFromDisk();

// Check if cache still valid
export function isCacheValid(): boolean {
  // Cache is valid if we have processed data (including fallback) and timestamp is within TTL
  if (!cache.processedData || !cache.timestamp) return false;
  const now = Date.now();
  return (now - cache.timestamp) < cache.TTL;
}

// Fetch & process upstream data, updating cache with retry logic
export async function fetchFreshData(uprn: string, retryCount = 3, retryDelay = 2000): Promise<CacheData> {
  let lastError: any;

  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
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
          },
          timeout: 10000 // 10 second timeout
        }
      );

      cache.data = response.data;
      const processedData = processApiResponse(response.data);
      processedData.isFallback = false;
      cache.processedData = processedData;
      cache.timestamp = Date.now();
      persistCacheToDisk({ data: response.data, timestamp: cache.timestamp });

      if (attempt > 1) {
        console.log(`✓ Successfully fetched data on attempt ${attempt}`);
      }

      return cache;
    } catch (error) {
      lastError = error;

      // If API is blocked or rate-limited, use fallback schedule immediately
      if (isApiBlocked(error)) {
        console.warn('API blocked or rate-limited, using fallback schedule');
        cache.data = null; // Mark as fallback data
        const fallbackData = generateFallbackSchedule();
        fallbackData.isFallback = true;
        cache.processedData = fallbackData;
        cache.timestamp = Date.now();
        return cache;
      }

      // Check if it's a network error
      const isNetworkError = axios.isAxiosError(error) &&
        (!error.response || error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED');

      if (isNetworkError && attempt < retryCount) {
        console.warn(`Network error on attempt ${attempt}/${retryCount}, retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }

      // If we've exhausted retries or it's not a network error, break
      break;
    }
  }

  // If we have stale cache data, return it rather than failing completely
  if (cache.processedData) {
    console.warn(`Failed to fetch fresh data after ${retryCount} attempts, returning stale cache (age: ${cache.timestamp ? Math.floor((Date.now() - cache.timestamp) / 1000 / 60) : 'unknown'} minutes)`);
    return cache;
  }

  // As last resort, use fallback schedule
  console.warn('No cached data available and all fetch attempts failed, using fallback schedule');
  cache.data = null;
  const fallbackData = generateFallbackSchedule();
  fallbackData.isFallback = true;
  cache.processedData = fallbackData;
  cache.timestamp = Date.now();
  return cache;
}

// Recompute relative day fields each request (prevents stale daysUntil)
export function withDynamicRelativeFields(processed: ProcessedApiResponse): ProcessedApiResponse {
  return {
    collections: processed.collections
      .map(c => ({ ...c, daysUntil: getDaysUntil(c.date) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    ...(processed.isFallback && { isFallback: processed.isFallback })
  };
}
