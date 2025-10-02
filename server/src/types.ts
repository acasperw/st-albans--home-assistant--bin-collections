export interface ServiceHeader {
  TaskType: string;
  Last: string;
  Next: string;
  ScheduleDescription: string;
}

export interface VeoliaService {
  __type: string;
  ServiceHeaders: ServiceHeader[];
  ServiceName: string;
}

export interface ApiResponse {
  d: VeoliaService[];
}

// Server-specific types
export interface CacheData {
  data: ApiResponse | null;
  processedData: ProcessedApiResponse | null;
  timestamp: number | null;
  TTL: number;
}

export interface HealthCheckResponse {
  status: string;
  uprn: string | undefined;
  timestamp: string;
  cache: {
    hasData: boolean;
    ageInMinutes: number | null;
    isValid: boolean;
  };
  testMode: {
    enabled: boolean;
    variant: TestScenario;
  };
}

// Processed API response types
export type ServiceType = 'refuse' | 'recycling' | 'food' | 'garden' | 'default';

export interface ProcessedService {
  serviceName: string;
  serviceType: ServiceType;
  taskType: string;
  last: string;
  next: string;
  scheduleDescription: string;
}

export interface ProcessedCollectionDate {
  date: string; // ISO 8601 datetime string (e.g., "2025-09-05T00:00:00+01:00")
  daysUntil: number;
  services: ProcessedService[];
}

export interface ProcessedApiResponse {
  collections: ProcessedCollectionDate[];
}

export type TestScenario = 'tomorrow' | 'gap' | 'today';

// ----------------- Train Feature Types -----------------
// Request parameters for next train lookup
export interface TrainServiceRequest {
  from: string; // CRS code e.g. 'SAA'
  to: string;   // CRS code e.g. 'HWW'
}

// A calling point on the route (minimal for now)
export interface TrainCallingPoint {
  stationCode: string;
  stationName?: string;
  scheduled: string; // ISO datetime
  estimated?: string; // ISO datetime or unchanged
  platform?: string;
}

export type TrainStatus = 'ON_TIME' | 'DELAYED' | 'CANCELLED' | 'UNKNOWN';

// Normalised train leg (single service)
export interface TrainLeg {
  serviceId: string;
  origin: string;       // origin CRS
  destination: string;  // destination CRS
  aimedDeparture: string; // ISO datetime
  aimedArrival: string;   // ISO datetime (if available)
  expectedDeparture?: string; // ISO datetime
  expectedArrival?: string;   // ISO datetime
  platform?: string;
  status: TrainStatus;
  callingPoints?: TrainCallingPoint[];
}

// Response returned to client for next trains
export interface NextTrainResponse {
  generatedAt: string; // ISO datetime when server generated
  from: string; // CRS code
  to: string;   // CRS code
  next: TrainLeg | null; // first upcoming
  following?: TrainLeg[]; // optional list of following services (limited)
  source: 'live' | 'cache' | 'mock' | 'stale';
  staleSeconds?: number; // If served from stale cache in error scenario
  error?: string; // Optional error message if partial failure
}

// Train cache entry
export interface TrainCacheEntry {
  key: string; // from-to
  response: NextTrainResponse;
  timestamp: number; // ms epoch
  ttl: number; // ms
}

export interface TrainCache {
  [key: string]: TrainCacheEntry | undefined;
}