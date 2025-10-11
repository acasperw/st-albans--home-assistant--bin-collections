import axios from 'axios';
import { ApiResponse, CacheData, ProcessedApiResponse } from '../types';
import { processApiResponse, getDaysUntil } from '../data-processor';

// Cache configuration (24h)
export const cache: CacheData = {
  data: null,
  processedData: null,
  timestamp: null,
  TTL: 24 * 60 * 60 * 1000
};

// Check if cache still valid
export function isCacheValid(): boolean {
  if (!cache.data || !cache.timestamp) return false;
  const now = Date.now();
  return (now - cache.timestamp) < cache.TTL;
}

// Fetch & process upstream data, updating cache
export async function fetchFreshData(uprn: string): Promise<CacheData> {
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

  cache.data = response.data;
  cache.processedData = processApiResponse(response.data);
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
