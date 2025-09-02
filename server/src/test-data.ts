import { ProcessedApiResponse } from './types';

/**
 * Generates mock test data with a "tomorrow" collection date
 * This is useful for testing the UI without needing real API data
 */
export function generateTestData(): ProcessedApiResponse {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const dayAfterTomorrow = new Date();
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 8);
  dayAfterTomorrow.setHours(0, 0, 0, 0);
  
  const twoWeeksLater = new Date();
  twoWeeksLater.setDate(twoWeeksLater.getDate() + 15);
  twoWeeksLater.setHours(0, 0, 0, 0);

  return {
    collections: [
      {
        date: tomorrow.toISOString(),
        daysUntil: 1,
        services: [
          {
            serviceName: "Food Waste",
            serviceType: "food",
            taskType: "Collection",
            last: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            next: tomorrow.toISOString(),
            scheduleDescription: "Weekly Collection"
          },
          {
            serviceName: "Recycling",
            serviceType: "recycling",
            taskType: "Collection", 
            last: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
            next: tomorrow.toISOString(),
            scheduleDescription: "Fortnightly Collection"
          }
        ]
      },
      {
        date: dayAfterTomorrow.toISOString(),
        daysUntil: 8,
        services: [
          {
            serviceName: "Food Waste",
            serviceType: "food",
            taskType: "Collection",
            last: tomorrow.toISOString(),
            next: dayAfterTomorrow.toISOString(),
            scheduleDescription: "Weekly Collection"
          },
          {
            serviceName: "Refuse",
            serviceType: "refuse",
            taskType: "Collection",
            last: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
            next: dayAfterTomorrow.toISOString(),
            scheduleDescription: "Fortnightly Collection"
          }
        ]
      },
      {
        date: twoWeeksLater.toISOString(),
        daysUntil: 15,
        services: [
          {
            serviceName: "Garden Waste",
            serviceType: "garden",
            taskType: "Collection",
            last: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
            next: twoWeeksLater.toISOString(),
            scheduleDescription: "Fortnightly Collection"
          },
          {
            serviceName: "Food Waste",
            serviceType: "food",
            taskType: "Collection",
            last: dayAfterTomorrow.toISOString(),
            next: twoWeeksLater.toISOString(),
            scheduleDescription: "Weekly Collection"
          }
        ]
      }
    ]
  };
}
