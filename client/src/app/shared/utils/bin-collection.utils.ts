import type { ProcessedCollectionDate } from '../../next-bin-collection/models';

/**
 * Shared utility functions for bin collection operations
 * Used across components and services to avoid duplication
 */
export class BinCollectionUtils {
  
  /**
   * Get icon for a specific service type
   */
  static getBinIcon(serviceType: string): string {
    switch (serviceType) {
      case 'refuse': return '🗑️';
      case 'recycling': return '♻️';
      case 'food': return '🍎';
      case 'garden': return '🌿';
      default: return '📦';
    }
  }

  /**
   * Get human-readable name for a service type
   */
  static getServiceName(serviceType: string): string {
    switch (serviceType) {
      case 'refuse': return 'General waste';
      case 'recycling': return 'Recycling';
      case 'food': return 'Food waste';
      case 'garden': return 'Garden waste';
      default: return serviceType;
    }
  }

  /**
   * Get bin type for wheelie bin component
   */
  static getBinType(serviceType: string): 'brown' | 'black' | 'blue' | 'green' | 'black-body-blue-lid' | 'black-body-purple-lid' {
    switch (serviceType) {
      case 'garden': return 'green';
      case 'refuse': return 'brown';
      case 'recycling': return 'black';
      case 'food': return 'green';
      default: return 'black';
    }
  }

  /**
   * Get human-readable description of all bin types in a collection
   * Handles singular and multiple bins with proper grammar
   */
  static getBinTypesDescription(collection: ProcessedCollectionDate): string {
    const descriptions = collection.services.map(s => this.getServiceName(s.serviceType));

    if (descriptions.length === 1) {
      return descriptions[0];
    } else if (descriptions.length === 2) {
      return descriptions.join(' & ');
    } else {
      return descriptions.slice(0, -1).join(', ') + ' & ' + descriptions[descriptions.length - 1];
    }
  }

  /**
   * Get appropriate icon for a collection
   * Returns general bin icon if multiple types, or specific icon if single type
   */
  static getCollectionIcon(collection: ProcessedCollectionDate): string {
    // If multiple bins, use general bin icon
    if (collection.services.length > 1) {
      return '🗑️';
    }

    // Single bin - use specific icon
    return this.getBinIcon(collection.services[0].serviceType);
  }

  /**
   * Format date for display
   */
  static formatDate(dateString: string): string {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    };
    return date.toLocaleDateString('en-GB', options);
  }
}
