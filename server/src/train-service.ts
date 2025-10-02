import axios from 'axios';
import { NextTrainResponse, TrainCache, TrainLeg, TrainStatus } from './types';
import { generateMockTrainData } from './train-mock';

// Environment-driven configuration
const TRAIN_APP_ID = process.env.TRAIN_APP_ID;
const TRAIN_APP_KEY = process.env.TRAIN_APP_KEY;
const TRAIN_API_BASE = process.env.TRAIN_API_BASE || 'https://transportapi.com/v3/uk/train/station';
const TEST_MODE = process.env.TEST_MODE === 'true' || false;

// Cache (simple in-memory)
const trainCache: TrainCache = {};
const DEFAULT_TTL_MS = 60 * 1000; // 60 seconds
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // Serve stale up to 5 minutes if upstream fails

export async function getNextTrain(from: string, to: string): Promise<NextTrainResponse> {

  console.log(`Fetching next train from ${from} to ${to}`);
  const key = `${from}-${to}`.toUpperCase();
  const now = Date.now();

  if (TEST_MODE || !TRAIN_APP_ID || !TRAIN_APP_KEY) {
    return generateMockTrainData(from, to);
  }

  const cached = trainCache[key];
  if (cached && (now - cached.timestamp) < cached.ttl) {
    return { ...cached.response, source: 'cache' };
  }

  try {
    // TransportAPI endpoint pattern:
    // /{station_code}/live.json?app_id=...&app_key=...&calling_at=HWW&darwin=true&train_status=passenger
    const url = `${TRAIN_API_BASE}/${from}/live.json`;
    const params = {
      app_id: TRAIN_APP_ID,
      app_key: TRAIN_APP_KEY,
      calling_at: to,
      darwin: 'true',
      train_status: 'passenger'
    } as const;

    const response = await axios.get(url, { params, timeout: 8000 });
    const data = response.data;

    console.log(`Received train data:`, data.departures.all);

    const services = Array.isArray(data.departures?.all) ? data.departures.all : [];

    const legs: TrainLeg[] = services
      .filter((s: any) => !s.is_passport_control && s.destination_name)
      .slice(0, 5)
      .map((s: any, idx: number) => normaliseService(s, idx));

    const next = legs[0] || null;
    const following = legs.slice(1, 4);

    const result: NextTrainResponse = {
      generatedAt: new Date().toISOString(),
      from,
      to,
      next,
      following,
      source: 'live'
    };

    trainCache[key] = {
      key,
      response: result,
      timestamp: now,
      ttl: DEFAULT_TTL_MS
    };

    return result;
  } catch (error: any) {
    // If we have stale cache, serve it with stale metadata
    const cached = trainCache[key];
    if (cached) {
      const age = now - cached.timestamp;
      if (age < STALE_THRESHOLD_MS) {
        return { ...cached.response, source: 'stale', staleSeconds: Math.floor(age / 1000), error: 'Upstream API error; serving stale data' };
      }
    }
    return {
      generatedAt: new Date().toISOString(),
      from,
      to,
      next: null,
      following: [],
      source: 'mock',
      error: error?.message || 'Failed to fetch live data'
    };
  }
}

function normaliseService(s: any, idx: number): TrainLeg {
  const depPlanned: string | undefined = s.aimed_departure_time || s.aimed_departure || s.scheduled_departure_time;
  const arrPlanned: string | undefined = s.aimed_arrival_time || s.aimed_arrival || s.scheduled_arrival_time;

  // TransportAPI gives times without date; combine with service date if available
  const serviceDate: string = s.date || new Date().toISOString().split('T')[0];
  const isoFromParts = (date: string, hhmm?: string) => {
    if (!hhmm) return new Date().toISOString();
    const [hh, mm] = hhmm.split(':');
    const d = new Date(date + 'T' + hh + ':' + mm + ':00');
    return d.toISOString();
  };

  const aimedDepIso = isoFromParts(serviceDate, depPlanned);
  const aimedArrIso = isoFromParts(serviceDate, arrPlanned);

  const expectedDep = s.expected_departure_time || s.expected_departure || depPlanned;
  const expectedArr = s.expected_arrival_time || s.expected_arrival || arrPlanned;

  const status = deriveStatus(s);

  return {
    serviceId: s.service || s.train_uid || `svc-${idx}`,
    origin: (s.origin_name && s.origin_name_code) ? s.origin_name_code : (s.origin_name || '???'),
    destination: (s.destination_name && s.destination_name_code) ? s.destination_name_code : (s.destination_name || '???'),
    aimedDeparture: aimedDepIso,
    aimedArrival: aimedArrIso,
    expectedDeparture: isoFromParts(serviceDate, expectedDep),
    expectedArrival: isoFromParts(serviceDate, expectedArr),
    platform: s.platform || undefined,
    status,
    callingPoints: []
  };
}

function deriveStatus(s: any): TrainStatus {
  const cancelFlags = ['canc', 'cancel'];
  const statusStr: string = (s.status || s.train_status || '').toLowerCase();
  if (cancelFlags.some(f => statusStr.includes(f))) return 'CANCELLED';
  const etd = s.expected_departure_time || s.expected_departure;
  const atd = s.aimed_departure_time || s.aimed_departure;
  if (!etd || !atd) return 'UNKNOWN';
  if (etd === atd) return 'ON_TIME';
  return 'DELAYED';
}
