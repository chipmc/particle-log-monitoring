/**
 * Health diagnostics module
 * 
 * Analyzes device telemetry payloads to extract health metrics and detect anomalies.
 */

import { DynamoIndexRecord, S3StorageRecord } from '../types';

/**
 * Known health fields extracted from device payloads
 */
export interface HealthMetrics {
  battery?: number[];
  connecttime?: number[];
  resets?: number[];
  alerts?: number[];
  occupancy?: number[];
  dailyoccupancy?: number[];
  temperature?: number[];
  firmwareVersions: string[];
  timestamps: string[];
}

/**
 * Statistical summary for a numeric metric
 */
export interface MetricStats {
  latest: number;
  min: number;
  max: number;
  average: number;
  count: number;
  change?: number; // Difference between first and last value
}

/**
 * Health anomaly detection result
 */
export interface HealthAnomaly {
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  metric: string;
  message: string;
  value?: number | string;
  timestamp?: string;
}

/**
 * Complete health summary
 */
export interface HealthSummary {
  deviceId: string;
  eventCount: number;
  timeSpan: {
    first: string;
    last: string;
    hours: number;
  };
  metrics: {
    battery?: MetricStats;
    connecttime?: MetricStats;
    resets?: MetricStats;
    alerts?: MetricStats;
    occupancy?: MetricStats;
    dailyoccupancy?: MetricStats;
    temperature?: MetricStats;
  };
  firmwareVersions: string[];
  firmwareChanges: Array<{ from: string; to: string; at: string }>;
  anomalies: HealthAnomaly[];
  parsingErrors: number;
}

/**
 * Parse payload data field
 * Handles JSON string, HTML-encoded JSON, or plain objects
 */
function parsePayloadData(data: any): any {
  if (!data) return null;
  
  // Already an object
  if (typeof data === 'object') return data;
  
  // String - might be JSON or HTML-encoded JSON
  if (typeof data === 'string') {
    try {
      // First try to decode HTML entities
      const decoded = data
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'");
      
      // Try parsing the decoded string
      return JSON.parse(decoded);
    } catch {
      // If that fails, try parsing as-is
      try {
        return JSON.parse(data);
      } catch {
        // Last attempt - check if it's partially HTML-encoded without proper JSON structure
        try {
          // Fix incomplete JSON strings like '&quot;battery&quot;:90.7,&quot;temp&quot;:29.7}'
          const fixed = '{' + data
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'");
          
          // Add closing brace if missing
          const finalFixed = fixed.endsWith('}') ? fixed : fixed + '}';
          return JSON.parse(finalFixed);
        } catch {
          return null;
        }
      }
    }
  }
  
  return null;
}

/**
 * Extract health metrics from a single S3 payload
 */
function extractMetricsFromPayload(record: S3StorageRecord): Partial<HealthMetrics> {
  const metrics: Partial<HealthMetrics> = {};
  
  // Try to get from parsed data field first
  let data = null;
  if (record.parsed?.data) {
    data = parsePayloadData(record.parsed.data);
  }
  
  // Also try particle webhook data field
  if (!data && record.particle?.data) {
    data = parsePayloadData(record.particle.data);
  }
  
  // Also check particle webhook top-level fields
  const particle = record.particle || {};
  
  // Helper to get numeric value from either location
  const getNumeric = (field: string): number | undefined => {
    const fromData = data?.[field];
    const fromParticle = particle[field];
    
    const value = fromData ?? fromParticle;
    if (value === null || value === undefined) return undefined;
    
    const num = typeof value === 'number' ? value : parseFloat(value);
    return isNaN(num) ? undefined : num;
  };
  
  // Extract known fields
  const battery = getNumeric('battery');
  const connecttime = getNumeric('connecttime');
  const resets = getNumeric('resets');
  const alerts = getNumeric('alerts');
  const occupancy = getNumeric('occupancy');
  const dailyoccupancy = getNumeric('dailyoccupancy');
  
  // Temperature can be 'temp' or 'temperature'
  const temp = getNumeric('temp') ?? getNumeric('temperature');
  
  if (battery !== undefined) metrics.battery = [battery];
  if (connecttime !== undefined) metrics.connecttime = [connecttime];
  if (resets !== undefined) metrics.resets = [resets];
  if (alerts !== undefined) metrics.alerts = [alerts];
  if (occupancy !== undefined) metrics.occupancy = [occupancy];
  if (dailyoccupancy !== undefined) metrics.dailyoccupancy = [dailyoccupancy];
  if (temp !== undefined) metrics.temperature = [temp];
  
  return metrics;
}

/**
 * Calculate statistics for a numeric array
 */
function calculateStats(values: number[], includeChange: boolean = true): MetricStats {
  const latest = values[values.length - 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const average = values.reduce((sum, v) => sum + v, 0) / values.length;
  const change = includeChange && values.length > 1 ? latest - values[0] : undefined;
  
  return {
    latest,
    min,
    max,
    average,
    count: values.length,
    ...(change !== undefined && { change }),
  };
}

/**
 * Detect health anomalies in collected metrics
 */
function detectHealthAnomalies(
  metrics: HealthMetrics,
  firmwareChanges: Array<{ from: string; to: string; at: string }>
): HealthAnomaly[] {
  const anomalies: HealthAnomaly[] = [];
  
  // Battery anomalies
  if (metrics.battery && metrics.battery.length > 0) {
    const latest = metrics.battery[metrics.battery.length - 1];
    if (latest < 30) {
      anomalies.push({
        severity: latest < 20 ? 'HIGH' : 'MEDIUM',
        metric: 'battery',
        message: `Battery critically low: ${latest.toFixed(1)}%`,
        value: latest,
      });
    }
    
    // Check for rapid battery drain
    if (metrics.battery.length > 1) {
      const first = metrics.battery[0];
      const drop = first - latest;
      const dropPercent = (drop / first) * 100;
      if (drop > 30 && dropPercent > 30) {
        anomalies.push({
          severity: 'MEDIUM',
          metric: 'battery',
          message: `Rapid battery drain: ${drop.toFixed(1)}% drop (${dropPercent.toFixed(0)}% of initial)`,
          value: drop,
        });
      }
    }
  }
  
  // Connection time anomalies
  if (metrics.connecttime && metrics.connecttime.length > 0) {
    const latest = metrics.connecttime[metrics.connecttime.length - 1];
    const max = Math.max(...metrics.connecttime);
    
    if (latest > 180) {
      anomalies.push({
        severity: latest > 300 ? 'HIGH' : 'MEDIUM',
        metric: 'connecttime',
        message: `High connection time: ${latest}s (threshold: 180s)`,
        value: latest,
      });
    }
    
    if (max > 180) {
      const count = metrics.connecttime.filter(t => t > 180).length;
      anomalies.push({
        severity: 'LOW',
        metric: 'connecttime',
        message: `${count} event(s) with connection time > 180s (max: ${max}s)`,
        value: max,
      });
    }
  }
  
  // Reset count anomalies
  if (metrics.resets && metrics.resets.length > 1) {
    const first = metrics.resets[0];
    const latest = metrics.resets[metrics.resets.length - 1];
    const increase = latest - first;
    
    if (increase > 0) {
      anomalies.push({
        severity: increase > 3 ? 'HIGH' : 'MEDIUM',
        metric: 'resets',
        message: `Reset count increased by ${increase} (from ${first} to ${latest})`,
        value: increase,
      });
    }
  }
  
  // Alert anomalies
  if (metrics.alerts && metrics.alerts.length > 0) {
    const nonZeroAlerts = metrics.alerts.filter(a => a > 0);
    if (nonZeroAlerts.length > 0) {
      const latest = metrics.alerts[metrics.alerts.length - 1];
      anomalies.push({
        severity: latest > 0 ? 'HIGH' : 'MEDIUM',
        metric: 'alerts',
        message: `Active alerts detected: ${nonZeroAlerts.length} event(s) with alerts > 0 (latest: ${latest})`,
        value: latest,
      });
    }
  }
  
  // Firmware version changes
  if (firmwareChanges.length > 0) {
    firmwareChanges.forEach(change => {
      anomalies.push({
        severity: 'LOW',
        metric: 'firmware',
        message: `Firmware changed from ${change.from} to ${change.to}`,
        value: `${change.from} → ${change.to}`,
        timestamp: change.at,
      });
    });
  }
  
  return anomalies;
}

/**
 * Analyze device health from timeline events and S3 payloads
 */
export async function analyzeDeviceHealth(
  deviceId: string,
  events: DynamoIndexRecord[],
  s3Payloads: S3StorageRecord[]
): Promise<HealthSummary> {
  if (events.length === 0) {
    return {
      deviceId,
      eventCount: 0,
      timeSpan: {
        first: '',
        last: '',
        hours: 0,
      },
      metrics: {},
      firmwareVersions: [],
      firmwareChanges: [],
      anomalies: [],
      parsingErrors: 0,
    };
  }
  
  // Collect all metrics across payloads
  const allMetrics: HealthMetrics = {
    battery: [],
    connecttime: [],
    resets: [],
    alerts: [],
    occupancy: [],
    dailyoccupancy: [],
    temperature: [],
    firmwareVersions: [],
    timestamps: [],
  };
  
  let parsingErrors = 0;
  
  // Extract metrics from each payload
  s3Payloads.forEach((payload, idx) => {
    try {
      const metrics = extractMetricsFromPayload(payload);
      
      if (metrics.battery) allMetrics.battery!.push(...metrics.battery);
      if (metrics.connecttime) allMetrics.connecttime!.push(...metrics.connecttime);
      if (metrics.resets) allMetrics.resets!.push(...metrics.resets);
      if (metrics.alerts) allMetrics.alerts!.push(...metrics.alerts);
      if (metrics.occupancy) allMetrics.occupancy!.push(...metrics.occupancy);
      if (metrics.dailyoccupancy) allMetrics.dailyoccupancy!.push(...metrics.dailyoccupancy);
      if (metrics.temperature) allMetrics.temperature!.push(...metrics.temperature);
      
      // Track firmware version and timestamp
      const fwVersion = payload.particle?.fw_version || payload.parsed?.fw_version;
      if (fwVersion) {
        allMetrics.firmwareVersions.push(String(fwVersion));
      }
      
      const timestamp = events[idx]?.eventTime || payload.parsed?.publishedAt;
      if (timestamp) {
        allMetrics.timestamps.push(timestamp);
      }
    } catch (error) {
      parsingErrors++;
    }
  });
  
  // Calculate time span
  const firstEvent = events[0].eventTime;
  const lastEvent = events[events.length - 1].eventTime;
  const firstTime = new Date(firstEvent);
  const lastTime = new Date(lastEvent);
  const hours = (lastTime.getTime() - firstTime.getTime()) / (1000 * 60 * 60);
  
  // Calculate statistics for each metric
  const metricStats: HealthSummary['metrics'] = {};
  if (allMetrics.battery && allMetrics.battery.length > 0) {
    metricStats.battery = calculateStats(allMetrics.battery);
  }
  if (allMetrics.connecttime && allMetrics.connecttime.length > 0) {
    metricStats.connecttime = calculateStats(allMetrics.connecttime);
  }
  if (allMetrics.resets && allMetrics.resets.length > 0) {
    metricStats.resets = calculateStats(allMetrics.resets);
  }
  if (allMetrics.alerts && allMetrics.alerts.length > 0) {
    metricStats.alerts = calculateStats(allMetrics.alerts);
  }
  if (allMetrics.occupancy && allMetrics.occupancy.length > 0) {
    metricStats.occupancy = calculateStats(allMetrics.occupancy);
  }
  if (allMetrics.dailyoccupancy && allMetrics.dailyoccupancy.length > 0) {
    metricStats.dailyoccupancy = calculateStats(allMetrics.dailyoccupancy);
  }
  if (allMetrics.temperature && allMetrics.temperature.length > 0) {
    metricStats.temperature = calculateStats(allMetrics.temperature);
  }
  
  // Track unique firmware versions
  const uniqueFirmwareVersions = [...new Set(allMetrics.firmwareVersions)];
  
  // Detect firmware version changes
  const firmwareChanges: Array<{ from: string; to: string; at: string }> = [];
  for (let i = 1; i < allMetrics.firmwareVersions.length; i++) {
    if (allMetrics.firmwareVersions[i] !== allMetrics.firmwareVersions[i - 1]) {
      firmwareChanges.push({
        from: allMetrics.firmwareVersions[i - 1],
        to: allMetrics.firmwareVersions[i],
        at: allMetrics.timestamps[i] || 'unknown',
      });
    }
  }
  
  // Detect anomalies
  const anomalies = detectHealthAnomalies(allMetrics, firmwareChanges);
  
  return {
    deviceId,
    eventCount: events.length,
    timeSpan: {
      first: firstEvent,
      last: lastEvent,
      hours: parseFloat(hours.toFixed(1)),
    },
    metrics: metricStats,
    firmwareVersions: uniqueFirmwareVersions,
    firmwareChanges,
    anomalies,
    parsingErrors,
  };
}
