import { NextTrainResponse, TrainLeg } from './types';

/**
 * Generate deterministic mock data for train departures between CRS codes.
 * Default scenario: next train in 7 minutes, another in 22 minutes.
 */
export function generateMockTrainData(from: string, to: string): NextTrainResponse {
  const now = new Date();

  const mkTime = (mins: number) => {
    const d = new Date(now);
    d.setMinutes(d.getMinutes() + mins);
    d.setSeconds(0, 0);
    return d.toISOString();
  };

  const leg = (offset: number, idSuffix: string): TrainLeg => ({
    serviceId: `${from}${to}-${idSuffix}`,
    origin: from,
    destination: to,
    aimedDeparture: mkTime(offset),
    aimedArrival: mkTime(offset + 6),
    expectedDeparture: mkTime(offset),
    expectedArrival: mkTime(offset + 6),
    platform: '1',
    status: 'ON_TIME',
    callingPoints: []
  });

  const next = leg(7, '001');
  const following = [leg(22, '002'), leg(37, '003')];

  return {
    generatedAt: new Date().toISOString(),
    from,
    to,
    next,
    following,
    source: 'mock'
  };
}
