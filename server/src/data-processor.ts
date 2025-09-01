import { ApiResponse, ProcessedApiResponse, ProcessedCollectionDate, ProcessedService, ServiceType } from './types';

// Helper function to determine service type from service name
export function getServiceType(serviceName: string): ServiceType {
  if (serviceName.includes('Refuse')) return 'refuse';
  if (serviceName.includes('Recycling')) return 'recycling';
  if (serviceName.includes('Food')) return 'food';
  if (serviceName.includes('Garden')) return 'garden';
  return 'default';
}

// Helper function to get local date string from a datetime with timezone
function getLocalDateString(dateTimeString: string): string {
  // Parse the date with timezone info
  const date = new Date(dateTimeString);
  // Get the year, month, day in the local timezone
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to calculate days until a given date (using original datetime with timezone)
export function getDaysUntil(dateTimeString: string): number {
  // Parse the original date with timezone
  const targetDate = new Date(dateTimeString);
  const today = new Date();

  // Set both dates to start of day for comparison
  const targetDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const diff = targetDay.getTime() - todayDay.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Main function to process raw API response into structured format
export function processApiResponse(rawData: ApiResponse): ProcessedApiResponse {
  // Group services by their next collection date (using date part as key)
  const dateGroups = new Map<string, ProcessedService[]>();
  // Keep track of the original datetime for each date group
  const dateTimeMap = new Map<string, string>();

  rawData.d.forEach(service => {
    if (service.ServiceHeaders && service.ServiceHeaders.length > 0) {
      const header = service.ServiceHeaders[0];

      if (header && header.Next) {
        const nextDateTime = header.Next; // Full ISO 8601 datetime
        // Use local date string for grouping services on the same day
        const dateKey = getLocalDateString(nextDateTime);

        // Store the first datetime we encounter for each date
        if (!dateTimeMap.has(dateKey)) {
          dateTimeMap.set(dateKey, nextDateTime);
        }

        if (!dateGroups.has(dateKey)) {
          dateGroups.set(dateKey, []);
        }

        const processedService: ProcessedService = {
          serviceName: service.ServiceName.replace('Domestic', '').replace('Collection', '').trim(),
          serviceType: getServiceType(service.ServiceName),
          taskType: header.TaskType,
          last: header.Last,
          next: header.Next,
          scheduleDescription: header.ScheduleDescription
        };

        const servicesArray = dateGroups.get(dateKey);
        if (servicesArray) {
          servicesArray.push(processedService);
        }
      }
    }
  });

  // Convert to ProcessedCollectionDate array
  const collections: ProcessedCollectionDate[] = Array.from(dateGroups.entries())
    .map(([dateKey, services]) => {
      // Sort services within each date - Food collections come last, then alphabetically
      const sortedServices = services.sort((a, b) => {
        const aIsFood = a.serviceType === 'food';
        const bIsFood = b.serviceType === 'food';

        // If one is food and the other isn't, food goes last
        if (aIsFood && !bIsFood) return 1;
        if (!aIsFood && bIsFood) return -1;

        // If both are food or both are not food, sort alphabetically
        return a.serviceName.localeCompare(b.serviceName);
      });

      // Get the original ISO 8601 datetime for this date group
      const originalDateTime = dateTimeMap.get(dateKey);
      const daysUntil = originalDateTime ? getDaysUntil(originalDateTime) : 0;

      return {
        date: originalDateTime || dateKey, // Return full ISO 8601 datetime
        daysUntil: daysUntil,
        services: sortedServices
      };
    })
    // Sort collection dates by date (earliest first)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return { collections };
}
