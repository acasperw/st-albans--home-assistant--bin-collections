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

export interface CollectionGroup {
  date: string;
  formattedDate: string;
  daysUntil: number;
  daysUntilText: string;
  isCollectionSoon: boolean;
  services: VeoliaService[];
}