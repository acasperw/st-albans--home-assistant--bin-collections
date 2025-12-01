import axios from 'axios';
import { ApiResponse, CacheData, ProcessedApiResponse } from '../types';
import { processApiResponse, getDaysUntil } from '../data-processor';
import { generateFallbackSchedule, isApiBlocked } from './fallback-schedule.service';

// Cache configuration (1 week)
export const cache: CacheData = {
  data: null,
  processedData: null,
  timestamp: null,
  TTL: 7 * 24 * 60 * 60 * 1000
};

// Check if cache still valid
export function isCacheValid(): boolean {
  if (!cache.data || !cache.timestamp) return false;
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
      cache.processedData = processApiResponse(response.data);
      cache.timestamp = Date.now();
      
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
        cache.processedData = generateFallbackSchedule();
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
  cache.processedData = generateFallbackSchedule();
  cache.timestamp = Date.now();
  return cache;
}

// Recompute relative day fields each request (prevents stale daysUntil)
export function withDynamicRelativeFields(processed: ProcessedApiResponse): ProcessedApiResponse {
  return {
    collections: processed.collections
      .map(c => ({ ...c, daysUntil: getDaysUntil(c.date) }))
      .sort((a, b) => a.date.localeCompare(b.date))
  };
}
