import { VeoliaService } from '@server/types';

export type { ServiceHeader, VeoliaService, ApiResponse } from '@server/types';

export interface CollectionGroup {
  date: string;
  formattedDate: string;
  daysUntil: number;
  daysUntilText: string;
  isCollectionSoon: boolean;
  services: VeoliaService[];
}