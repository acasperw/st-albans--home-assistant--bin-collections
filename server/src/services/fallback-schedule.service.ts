import { ProcessedApiResponse, ProcessedCollectionDate, ProcessedService } from '../types';
import { getDaysUntil } from '../data-processor';

/**
 * Fallback schedule configuration
 * Based on known collection pattern when API is blocked
 * 
 * Known dates:
 * - Friday, 28 Nov 2025: Garden waste, Recycling, Food waste (Week 1)
 * - Friday, 5 Dec 2025: General waste/Rubbish, Food waste (Week 2)
 * 
 * Pattern repeats every 2 weeks on Fridays
 */

// Known starting point: Friday, 28 November 2025
const WEEK1_START_DATE = new Date('2025-11-28T00:00:00+00:00');

// Week 1 services (Garden + Recycling + Food)
const WEEK1_SERVICES: ProcessedService[] = [
  {
    serviceName: 'Garden Waste',
    serviceType: 'garden',
    taskType: 'Emptying',
    last: '',
    next: '',
    scheduleDescription: 'Fortnightly'
  },
  {
    serviceName: 'Recycling',
    serviceType: 'recycling',
    taskType: 'Emptying',
    last: '',
    next: '',
    scheduleDescription: 'Fortnightly'
  },
  {
    serviceName: 'Food Waste',
    serviceType: 'food',
    taskType: 'Emptying',
    last: '',
    next: '',
    scheduleDescription: 'Weekly'
  }
];

// Week 2 services (General waste + Food)
const WEEK2_SERVICES: ProcessedService[] = [
  {
    serviceName: 'Refuse',
    serviceType: 'refuse',
    taskType: 'Emptying',
    last: '',
    next: '',
    scheduleDescription: 'Fortnightly'
  },
  {
    serviceName: 'Food Waste',
    serviceType: 'food',
    taskType: 'Emptying',
    last: '',
    next: '',
    scheduleDescription: 'Weekly'
  }
];

/**
 * Generate collection dates based on the known 2-week rotation pattern
 * @param weeksAhead Number of weeks to generate (default: 12 weeks / 3 months)
 * @returns ProcessedApiResponse matching the normal API format
 */
export function generateFallbackSchedule(weeksAhead: number = 12): ProcessedApiResponse {
  const collections: ProcessedCollectionDate[] = [];
  const today = new Date();
  
  // Find the first Friday from today onwards
  let currentDate = new Date(today);
  
  // Calculate which week we're in based on the known start date
  const daysSinceStart = Math.floor((today.getTime() - WEEK1_START_DATE.getTime()) / (1000 * 60 * 60 * 24));
  const weeksSinceStart = Math.floor(daysSinceStart / 7);
  
  // Determine if we should start with week 1 or week 2 pattern
  let isWeek1 = weeksSinceStart % 2 === 0;
  
  // Generate collections for the next X weeks
  for (let week = 0; week < weeksAhead; week++) {
    // Calculate the next Friday
    const daysToAdd = week * 7;
    const collectionDate = new Date(WEEK1_START_DATE);
    collectionDate.setDate(collectionDate.getDate() + daysToAdd + (weeksSinceStart * 7));
    
    // Only include future dates
    if (collectionDate >= today || getDaysUntil(collectionDate.toISOString()) >= 0) {
      const services = isWeek1 ? [...WEEK1_SERVICES] : [...WEEK2_SERVICES];
      
      // Update the next/last dates for each service
      const dateString = collectionDate.toISOString();
      const updatedServices = services.map(service => ({
        ...service,
        next: dateString,
        last: new Date(collectionDate.getTime() - (service.serviceType === 'food' ? 7 : 14) * 24 * 60 * 60 * 1000).toISOString()
      }));
      
      collections.push({
        date: dateString,
        daysUntil: getDaysUntil(dateString),
        services: updatedServices
      });
    }
    
    // Alternate between week 1 and week 2
    isWeek1 = !isWeek1;
  }
  
  // Sort by date
  collections.sort((a, b) => a.date.localeCompare(b.date));
  
  return { collections };
}

/**
 * Check if an error indicates the API is blocked/rate-limited
 */
export function isApiBlocked(error: any): boolean {
  if (error?.response?.status === 403) return true;
  if (error?.response?.status === 404) return true;
  if (error?.response?.status === 429) return true;
  if (error?.code === 'ECONNREFUSED') return true;
  if (error?.message?.includes('blocked')) return true;
  if (error?.message?.includes('rate limit')) return true;
  return false;
}
