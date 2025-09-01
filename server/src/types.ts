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
