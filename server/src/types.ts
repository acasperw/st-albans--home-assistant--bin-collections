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
