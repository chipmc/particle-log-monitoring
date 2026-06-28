/**
 * Timeline analytics for device event analysis
 */

import { DynamoIndexRecord } from '../types';

/**
 * Event count by event name
 */
export interface EventCounts {
  [eventName: string]: number;
}

/**
 * Time gap between consecutive events
 */
export interface TimeGap {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  eventBefore: string;
  eventAfter: string;
}

/**
 * Event burst (multiple events in short window)
 */
export interface EventBurst {
  startTime: string;
  endTime: string;
  eventCount: number;
  events: string[];
}

/**
 * Detected anomaly
 */
export interface Anomaly {
  type: 'missing_eventTime' | 'unknown_deviceId' | 'high_ingest_delay' | 'repeated_burst';
  severity: 'low' | 'medium' | 'high';
  description: string;
  eventTime?: string;
  eventName?: string;
}

/**
 * Timeline analytics summary
 */
export interface TimelineSummary {
  totalEvents: number;
  eventCounts: EventCounts;
  firstEventTime: string | null;
  lastEventTime: string | null;
  averageIngestDelayMs: number;
  maxIngestDelayMs: number;
  minIngestDelayMs: number;
  gaps: TimeGap[];
  bursts: EventBurst[];
  firmwareVersions: string[];
  serialLifecycleCounts: {
    SERIAL_CONNECTED: number;
    SERIAL_DISCONNECTED: number;
    SERIAL_MISSING: number;
    LOG: number;
  };
  anomalies: Anomaly[];
}

/**
 * Calculate ingest delay in milliseconds
 */
function calculateIngestDelay(eventTime: string, receivedAt: string): number {
  const eventMs = new Date(eventTime).getTime();
  const receivedMs = new Date(receivedAt).getTime();
  return receivedMs - eventMs;
}

/**
 * Calculate time difference in minutes
 */
function calculateMinutesDiff(time1: string, time2: string): number {
  const ms1 = new Date(time1).getTime();
  const ms2 = new Date(time2).getTime();
  return Math.abs(ms2 - ms1) / (1000 * 60);
}

/**
 * Detect time gaps larger than threshold
 */
function detectGaps(events: DynamoIndexRecord[], thresholdMinutes: number): TimeGap[] {
  const gaps: TimeGap[] = [];
  
  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const curr = events[i];
    
    const durationMinutes = calculateMinutesDiff(prev.eventTime, curr.eventTime);
    
    if (durationMinutes > thresholdMinutes) {
      gaps.push({
        startTime: prev.eventTime,
        endTime: curr.eventTime,
        durationMinutes: Math.round(durationMinutes),
        eventBefore: prev.eventName,
        eventAfter: curr.eventName,
      });
    }
  }
  
  return gaps;
}

/**
 * Detect event bursts (multiple events within 10 minutes)
 */
function detectBursts(events: DynamoIndexRecord[]): EventBurst[] {
  const bursts: EventBurst[] = [];
  const burstWindowMinutes = 10;
  const minBurstSize = 3; // At least 3 events to be considered a burst
  
  let burstStart = 0;
  
  for (let i = 0; i < events.length; i++) {
    // Check how many events are within 10 minutes from current position
    let burstEnd = i;
    const burstEvents: string[] = [events[i].eventName];
    
    for (let j = i + 1; j < events.length; j++) {
      const minutesDiff = calculateMinutesDiff(events[i].eventTime, events[j].eventTime);
      
      if (minutesDiff <= burstWindowMinutes) {
        burstEnd = j;
        burstEvents.push(events[j].eventName);
      } else {
        break;
      }
    }
    
    const burstSize = burstEnd - i + 1;
    
    if (burstSize >= minBurstSize) {
      bursts.push({
        startTime: events[i].eventTime,
        endTime: events[burstEnd].eventTime,
        eventCount: burstSize,
        events: burstEvents,
      });
      
      // Skip past this burst
      i = burstEnd;
    }
  }
  
  return bursts;
}

/**
 * Detect anomalies in timeline
 */
function detectAnomalies(events: DynamoIndexRecord[], averageDelayMs: number): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const highDelayThresholdMs = 5000; // 5 seconds
  
  // Count repeated bursts
  const burstCount = detectBursts(events).length;
  if (burstCount > 3) {
    anomalies.push({
      type: 'repeated_burst',
      severity: 'medium',
      description: `Detected ${burstCount} event bursts (3+ events within 10 minutes)`,
    });
  }
  
  for (const event of events) {
    // Missing eventTime
    if (!event.eventTime) {
      anomalies.push({
        type: 'missing_eventTime',
        severity: 'high',
        description: `Event ${event.eventName} missing eventTime`,
        eventName: event.eventName,
      });
    }
    
    // High ingest delay
    const delay = calculateIngestDelay(event.eventTime, event.receivedAt);
    if (delay > highDelayThresholdMs && delay > averageDelayMs * 2) {
      anomalies.push({
        type: 'high_ingest_delay',
        severity: 'low',
        description: `High ingest delay: ${Math.round(delay)}ms for ${event.eventName}`,
        eventTime: event.eventTime,
        eventName: event.eventName,
      });
    }
  }
  
  return anomalies;
}

/**
 * Analyze device timeline and generate summary
 */
export function analyzeTimeline(
  events: DynamoIndexRecord[],
  gapThresholdMinutes: number = 90
): TimelineSummary {
  if (events.length === 0) {
    return {
      totalEvents: 0,
      eventCounts: {},
      firstEventTime: null,
      lastEventTime: null,
      averageIngestDelayMs: 0,
      maxIngestDelayMs: 0,
      minIngestDelayMs: 0,
      gaps: [],
      bursts: [],
      firmwareVersions: [],
      serialLifecycleCounts: {
        SERIAL_CONNECTED: 0,
        SERIAL_DISCONNECTED: 0,
        SERIAL_MISSING: 0,
        LOG: 0,
      },
      anomalies: [],
    };
  }
  
  // Event counts by name
  const eventCounts: EventCounts = {};
  for (const event of events) {
    eventCounts[event.eventName] = (eventCounts[event.eventName] || 0) + 1;
  }
  
  // First and last event times
  const firstEventTime = events[0].eventTime;
  const lastEventTime = events[events.length - 1].eventTime;
  
  // Calculate ingest delays
  const delays = events.map(e => calculateIngestDelay(e.eventTime, e.receivedAt));
  const averageIngestDelayMs = Math.round(delays.reduce((a, b) => a + b, 0) / delays.length);
  const maxIngestDelayMs = Math.max(...delays);
  const minIngestDelayMs = Math.min(...delays);
  
  // Detect gaps
  const gaps = detectGaps(events, gapThresholdMinutes);
  
  // Detect bursts
  const bursts = detectBursts(events);
  
  // Collect firmware versions
  const firmwareVersions = [...new Set(
    events
      .map(e => e.fw_version)
      .filter((v): v is string => v !== undefined)
  )].sort();
  
  // Count serial lifecycle events
  const serialLifecycleCounts = {
    SERIAL_CONNECTED: eventCounts['SERIAL_CONNECTED'] || 0,
    SERIAL_DISCONNECTED: eventCounts['SERIAL_DISCONNECTED'] || 0,
    SERIAL_MISSING: eventCounts['SERIAL_MISSING'] || 0,
    LOG: eventCounts['LOG'] || 0,
  };
  
  // Detect anomalies
  const anomalies = detectAnomalies(events, averageIngestDelayMs);
  
  return {
    totalEvents: events.length,
    eventCounts,
    firstEventTime,
    lastEventTime,
    averageIngestDelayMs,
    maxIngestDelayMs,
    minIngestDelayMs,
    gaps,
    bursts,
    firmwareVersions,
    serialLifecycleCounts,
    anomalies,
  };
}
