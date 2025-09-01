// Import the new processed types
import type { ProcessedApiResponse, ProcessedCollectionDate, ProcessedService, ServiceType } from '@server/types';

// Re-export for convenience
export type { ProcessedApiResponse, ProcessedCollectionDate, ProcessedService, ServiceType };

// Enhanced service for frontend presentation - extends server interface
export interface EnhancedProcessedService extends ProcessedService {
  binIcon: string; // Added for presentation
}

// Enhanced collection date for frontend presentation - extends server interface
export interface EnhancedCollectionDate extends ProcessedCollectionDate {
  formattedDate: string; // Added for presentation
  daysUntilText: string; // Added for presentation
  isCollectionSoon: boolean; // Added for presentation
  services: EnhancedProcessedService[]; // Override with enhanced services
}