/**
 * Display formatters for timeline output
 * Plain text formatting (no color dependencies)
 */

import { DynamoIndexRecord, S3StorageRecord } from '../types';
import { TimelineSummary } from './analytics';
import { HealthSummary, MetricStats } from './health';
import { CorrelationAnalysis, CorrelationWindow } from './correlation';

/**
 * Format timeline event for console display
 */
export function formatTimelineEvent(event: DynamoIndexRecord, index: number): string {
  const lines: string[] = [];
  
  // Header with index
  lines.push(`\n[${index + 1}] ================================================================`);
  
  // Core fields
  lines.push('Event:      ' + event.eventName);
  lines.push('Time:       ' + event.eventTime);
  lines.push('Received:   ' + event.receivedAt);
  lines.push('Data Type:  ' + event.dataType);
  
  // Optional fields
  if (event.fw_version) {
    lines.push('Firmware:   ' + event.fw_version);
  }
  
  if (event.deviceName) {
    lines.push('Device:     ' + event.deviceName);
  }
  
  if (event.sourceType) {
    lines.push('Source:     ' + event.sourceType);
  }
  
  if (event.collectorId) {
    lines.push('Collector:  ' + event.collectorId);
  }
  
  if (event.eventType) {
    lines.push('Type:       ' + event.eventType);
  }
  
  if (event.logLine) {
    lines.push('Log:        ' + event.logLine.substring(0, 80));
  }
  
  // S3 reference
  lines.push('S3 Key:     ' + event.s3Key);
  
  return lines.join('\n');
}

/**
 * Format timeline summary header
 */
export function formatTimelineHeader(deviceId: string, count: number, startTime?: string, endTime?: string): string {
  const lines: string[] = [];
  lines.push('\n================================================================');
  lines.push('  Device Timeline');
  lines.push('================================================================');
  lines.push('');
  lines.push('Device ID:   ' + deviceId);
  
  if (startTime) {
    lines.push('Start Time:  ' + startTime);
  }
  
  if (endTime) {
    lines.push('End Time:    ' + endTime);
  }
  
  lines.push('Event Count: ' + count.toString());
  
  return lines.join('\n');
}

/**
 * Format raw S3 event data
 */
export function formatRawEvent(record: S3StorageRecord): string {
  const lines: string[] = [];
  
  lines.push('\n================================================================');
  lines.push('Raw Event Data (from S3)');
  lines.push('================================================================');
  
  lines.push('');
  lines.push('Particle Webhook:');
  lines.push(JSON.stringify(record.particle, null, 2));
  
  lines.push('');
  lines.push('Parsed Data:');
  lines.push(JSON.stringify(record.parsed, null, 2));
  
  return lines.join('\n');
}

/**
 * Format error message
 */
export function formatError(message: string, error?: Error): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('ERROR: ' + message);
  if (error) {
    lines.push(error.message);
    if (error.stack) {
      lines.push('');
      lines.push('Stack trace:');
      lines.push(error.stack);
    }
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Format timeline summary
 */
export function formatTimelineSummary(summary: TimelineSummary, deviceId: string): string {
  const lines: string[] = [];
  
  lines.push('\n================================================================');
  lines.push('  TIMELINE SUMMARY');
  lines.push('================================================================');
  lines.push('');
  lines.push('Device ID:     ' + deviceId);
  lines.push('Total Events:  ' + summary.totalEvents);
  
  if (summary.firstEventTime && summary.lastEventTime) {
    lines.push('First Event:   ' + summary.firstEventTime);
    lines.push('Last Event:    ' + summary.lastEventTime);
    
    const durationMs = new Date(summary.lastEventTime).getTime() - new Date(summary.firstEventTime).getTime();
    const durationHours = Math.round(durationMs / (1000 * 60 * 60) * 10) / 10;
    lines.push('Time Span:     ' + durationHours + ' hours');
  }
  
  lines.push('');
  lines.push('--- INGEST PERFORMANCE ---');
  lines.push('Average Delay: ' + summary.averageIngestDelayMs + 'ms');
  lines.push('Min Delay:     ' + summary.minIngestDelayMs + 'ms');
  lines.push('Max Delay:     ' + summary.maxIngestDelayMs + 'ms');
  
  // Event counts
  lines.push('');
  lines.push('--- EVENT COUNTS ---');
  const sortedEvents = Object.entries(summary.eventCounts)
    .sort((a, b) => b[1] - a[1]);
  
  for (const [eventName, count] of sortedEvents) {
    lines.push(eventName.padEnd(30) + ' ' + count);
  }
  
  // Firmware versions
  if (summary.firmwareVersions.length > 0) {
    lines.push('');
    lines.push('--- FIRMWARE VERSIONS ---');
    for (const version of summary.firmwareVersions) {
      lines.push('  ' + version);
    }
  }
  
  // Serial lifecycle counts
  const hasSerialEvents = 
    summary.serialLifecycleCounts.SERIAL_CONNECTED > 0 ||
    summary.serialLifecycleCounts.SERIAL_DISCONNECTED > 0 ||
    summary.serialLifecycleCounts.SERIAL_MISSING > 0 ||
    summary.serialLifecycleCounts.LOG > 0;
  
  if (hasSerialEvents) {
    lines.push('');
    lines.push('--- SERIAL LIFECYCLE ---');
    lines.push('SERIAL_CONNECTED:      ' + summary.serialLifecycleCounts.SERIAL_CONNECTED);
    lines.push('SERIAL_DISCONNECTED:   ' + summary.serialLifecycleCounts.SERIAL_DISCONNECTED);
    lines.push('SERIAL_MISSING:        ' + summary.serialLifecycleCounts.SERIAL_MISSING);
    lines.push('LOG:                   ' + summary.serialLifecycleCounts.LOG);
  }
  
  // Time gaps
  if (summary.gaps.length > 0) {
    lines.push('');
    lines.push('--- TIME GAPS (> threshold) ---');
    for (const gap of summary.gaps) {
      lines.push(`  ${gap.durationMinutes} minutes gap`);
      lines.push(`    From: ${gap.startTime} (${gap.eventBefore})`);
      lines.push(`    To:   ${gap.endTime} (${gap.eventAfter})`);
      lines.push('');
    }
  } else {
    lines.push('');
    lines.push('--- TIME GAPS ---');
    lines.push('No significant gaps detected');
  }
  
  // Bursts
  if (summary.bursts.length > 0) {
    lines.push('');
    lines.push('--- EVENT BURSTS (3+ events within 10 min) ---');
    for (const burst of summary.bursts) {
      lines.push(`  ${burst.eventCount} events from ${burst.startTime} to ${burst.endTime}`);
      const eventSummary = Object.entries(
        burst.events.reduce((acc, e) => {
          acc[e] = (acc[e] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([name, count]) => `${name}(${count})`).join(', ');
      lines.push(`    Events: ${eventSummary}`);
      lines.push('');
    }
  }
  
  // Anomalies
  if (summary.anomalies.length > 0) {
    lines.push('');
    lines.push('--- ANOMALIES ---');
    for (const anomaly of summary.anomalies) {
      const severityLabel = `[${anomaly.severity.toUpperCase()}]`;
      lines.push(`  ${severityLabel.padEnd(10)} ${anomaly.description}`);
    }
  } else {
    lines.push('');
    lines.push('--- ANOMALIES ---');
    lines.push('No anomalies detected');
  }
  
  lines.push('');
  lines.push('================================================================');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Format metric statistics for health summary
 */
function formatMetricStats(label: string, stats: MetricStats, unit: string = ''): string {
  const lines: string[] = [];
  const unitStr = unit ? ` ${unit}` : '';
  
  lines.push(`${label}:`);
  lines.push(`  Latest:  ${stats.latest.toFixed(2)}${unitStr}`);
  lines.push(`  Min:     ${stats.min.toFixed(2)}${unitStr}`);
  lines.push(`  Max:     ${stats.max.toFixed(2)}${unitStr}`);
  lines.push(`  Average: ${stats.average.toFixed(2)}${unitStr}`);
  
  if (stats.change !== undefined) {
    const changeStr = stats.change > 0 ? `+${stats.change.toFixed(2)}` : stats.change.toFixed(2);
    lines.push(`  Change:  ${changeStr}${unitStr} (over ${stats.count} readings)`);
  } else {
    lines.push(`  Readings: ${stats.count}`);
  }
  
  return lines.join('\n');
}

/**
 * Format health summary
 */
export function formatHealthSummary(health: HealthSummary): string {
  const lines: string[] = [];
  
  lines.push('\n================================================================');
  lines.push('  DEVICE HEALTH SUMMARY');
  lines.push('================================================================');
  lines.push('');
  lines.push('Device ID:     ' + health.deviceId);
  lines.push('Total Events:  ' + health.eventCount);
  
  if (health.timeSpan.first && health.timeSpan.last) {
    lines.push('First Event:   ' + health.timeSpan.first);
    lines.push('Last Event:    ' + health.timeSpan.last);
    lines.push('Time Span:     ' + health.timeSpan.hours + ' hours');
  }
  
  // Health metrics
  lines.push('');
  lines.push('--- HEALTH METRICS ---');
  lines.push('');
  
  if (health.metrics.battery) {
    lines.push(formatMetricStats('Battery', health.metrics.battery, '%'));
    lines.push('');
  }
  
  if (health.metrics.connecttime) {
    lines.push(formatMetricStats('Connection Time', health.metrics.connecttime, 's'));
    lines.push('');
  }
  
  if (health.metrics.resets) {
    lines.push(formatMetricStats('Reset Count', health.metrics.resets));
    lines.push('');
  }
  
  if (health.metrics.alerts) {
    lines.push(formatMetricStats('Alert Count', health.metrics.alerts));
    lines.push('');
  }
  
  if (health.metrics.temperature) {
    lines.push(formatMetricStats('Temperature', health.metrics.temperature, '°C'));
    lines.push('');
  }
  
  if (health.metrics.occupancy) {
    lines.push(formatMetricStats('Occupancy', health.metrics.occupancy));
    lines.push('');
  }
  
  if (health.metrics.dailyoccupancy) {
    lines.push(formatMetricStats('Daily Occupancy', health.metrics.dailyoccupancy));
    lines.push('');
  }
  
  // Check if we have any metrics at all
  const hasMetrics = Object.keys(health.metrics).length > 0;
  if (!hasMetrics) {
    lines.push('No parseable health metrics found in payloads.');
    lines.push('');
  }
  
  // Firmware versions
  if (health.firmwareVersions.length > 0) {
    lines.push('--- FIRMWARE VERSIONS ---');
    for (const version of health.firmwareVersions) {
      lines.push('  ' + version);
    }
    lines.push('');
  }
  
  // Firmware changes
  if (health.firmwareChanges.length > 0) {
    lines.push('--- FIRMWARE CHANGES ---');
    for (const change of health.firmwareChanges) {
      lines.push(`  ${change.from} → ${change.to}`);
      lines.push(`    At: ${change.at}`);
    }
    lines.push('');
  }
  
  // Anomalies
  if (health.anomalies.length > 0) {
    lines.push('--- ANOMALIES DETECTED ---');
    
    // Group by severity
    const high = health.anomalies.filter(a => a.severity === 'HIGH');
    const medium = health.anomalies.filter(a => a.severity === 'MEDIUM');
    const low = health.anomalies.filter(a => a.severity === 'LOW');
    
    if (high.length > 0) {
      lines.push('');
      lines.push('HIGH SEVERITY:');
      for (const anomaly of high) {
        lines.push(`  [${anomaly.metric.toUpperCase()}] ${anomaly.message}`);
        if (anomaly.timestamp) {
          lines.push(`    Time: ${anomaly.timestamp}`);
        }
      }
    }
    
    if (medium.length > 0) {
      lines.push('');
      lines.push('MEDIUM SEVERITY:');
      for (const anomaly of medium) {
        lines.push(`  [${anomaly.metric.toUpperCase()}] ${anomaly.message}`);
        if (anomaly.timestamp) {
          lines.push(`    Time: ${anomaly.timestamp}`);
        }
      }
    }
    
    if (low.length > 0) {
      lines.push('');
      lines.push('LOW SEVERITY:');
      for (const anomaly of low) {
        lines.push(`  [${anomaly.metric.toUpperCase()}] ${anomaly.message}`);
        if (anomaly.timestamp) {
          lines.push(`    Time: ${anomaly.timestamp}`);
        }
      }
    }
    
    lines.push('');
  } else {
    lines.push('--- ANOMALIES ---');
    lines.push('No anomalies detected');
    lines.push('');
  }
  
  // Data quality
  if (health.parsingErrors > 0) {
    lines.push('--- DATA QUALITY ---');
    lines.push(`Warning: ${health.parsingErrors} payload(s) could not be parsed`);
    lines.push('');
  }
  
  lines.push('================================================================');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Format correlation window for display
 */
function formatCorrelationWindow(window: CorrelationWindow, index: number): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push(`Window ${index + 1}`);
  lines.push('----------------------------------------------------------------');
  lines.push(`Time Range: ${window.startTime} to ${window.endTime}`);
  lines.push(`Duration:   ${window.durationMinutes} minutes`);
  lines.push(`Events:     ${window.events.length}`);
  lines.push('');
  
  // Telemetry
  if (window.telemetry.length > 0) {
    lines.push('TELEMETRY:');
    for (const tel of window.telemetry) {
      const metrics: string[] = [];
      if (tel.battery !== undefined) metrics.push(`battery=${tel.battery.toFixed(1)}%`);
      if (tel.connecttime !== undefined) metrics.push(`connecttime=${tel.connecttime}s`);
      if (tel.temperature !== undefined) metrics.push(`temp=${tel.temperature.toFixed(1)}°C`);
      if (tel.resets !== undefined) metrics.push(`resets=${tel.resets}`);
      if (tel.alerts !== undefined) metrics.push(`alerts=${tel.alerts}`);
      if (tel.occupancy !== undefined) metrics.push(`occupancy=${tel.occupancy}`);
      
      lines.push(`  - ${tel.eventName}: ${metrics.join(', ')}`);
    }
    lines.push('');
  }
  
  // Watchdog
  if (window.watchdog.length > 0) {
    lines.push('WATCHDOG:');
    for (const wd of window.watchdog) {
      if (wd.resetCause) {
        lines.push(`  - ${wd.eventName}: reset cause=${wd.resetCause}`);
      } else {
        lines.push(`  - ${wd.eventName}`);
      }
      if (wd.details) {
        lines.push(`    ${wd.details.substring(0, 80)}`);
      }
    }
    lines.push('');
  }
  
  // Status
  if (window.status.length > 0) {
    lines.push('STATUS:');
    for (const st of window.status) {
      const metrics: string[] = [];
      if (st.cloudRecoverStage !== undefined) metrics.push(`cloudRecoverStage=${st.cloudRecoverStage}`);
      if (st.networkState) metrics.push(`networkState=${st.networkState}`);
      if (st.queueDepth !== undefined) metrics.push(`queueDepth=${st.queueDepth}`);
      
      if (metrics.length > 0) {
        lines.push(`  - ${st.eventName}: ${metrics.join(', ')}`);
      } else {
        lines.push(`  - ${st.eventName}`);
      }
    }
    lines.push('');
  }
  
  // Serial Lifecycle
  if (window.serialLifecycle.length > 0) {
    lines.push('SERIAL LIFECYCLE:');
    for (const sl of window.serialLifecycle) {
      lines.push(`  - ${sl.eventType}`);
      if (sl.details) {
        lines.push(`    ${sl.details.substring(0, 80)}`);
      }
    }
    lines.push('');
  }
  
  // Serial Logs
  if (window.serialLogs.length > 0) {
    lines.push('SERIAL LOGS:');
    const displayCount = Math.min(5, window.serialLogs.length);
    for (let i = 0; i < displayCount; i++) {
      const log = window.serialLogs[i];
      lines.push(`  - [${log.category}] ${log.logLine.substring(0, 70)}`);
    }
    if (window.serialLogs.length > displayCount) {
      lines.push(`  ... and ${window.serialLogs.length - displayCount} more logs`);
    }
    lines.push('');
  }
  
  // Inferences
  if (window.inferences.length > 0) {
    lines.push('INFERENCES:');
    for (const inf of window.inferences) {
      const severityLabel = `[${inf.severity}]`.padEnd(12);
      lines.push(`  ${severityLabel} ${inf.message}`);
      lines.push(`    Category: ${inf.category}`);
      if (inf.evidence.length > 0) {
        lines.push(`    Evidence:`);
        for (const ev of inf.evidence.slice(0, 3)) {
          lines.push(`      - ${ev.substring(0, 70)}`);
        }
        if (inf.evidence.length > 3) {
          lines.push(`      ... and ${inf.evidence.length - 3} more`);
        }
      }
    }
    lines.push('');
  } else {
    lines.push('INFERENCES:');
    lines.push('  No significant patterns detected');
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Format correlation analysis summary
 */
export function formatCorrelationAnalysis(analysis: CorrelationAnalysis): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('================================================================');
  lines.push('  EVENT CORRELATION ANALYSIS');
  lines.push('================================================================');
  lines.push('');
  lines.push('Device ID:       ' + analysis.deviceId);
  lines.push('Time Range:      ' + analysis.startTime + ' to ' + analysis.endTime);
  lines.push('Window Duration: ' + analysis.windowDurationMinutes + ' minutes');
  lines.push('Window Count:    ' + analysis.windowCount);
  lines.push('');
  
  // Summary
  lines.push('--- SUMMARY ---');
  lines.push(`Total Inferences: ${analysis.summary.totalInferences}`);
  lines.push(`  Critical:       ${analysis.summary.criticalCount}`);
  lines.push(`  Warning:        ${analysis.summary.warningCount}`);
  lines.push(`  Info:           ${analysis.summary.infoCount}`);
  lines.push('');
  
  if (Object.keys(analysis.summary.topCategories).length > 0) {
    lines.push('Top Categories:');
    const sorted = Object.entries(analysis.summary.topCategories)
      .sort((a, b) => b[1] - a[1]);
    for (const [category, count] of sorted) {
      lines.push(`  ${category.padEnd(15)} ${count}`);
    }
    lines.push('');
  }
  
  lines.push('================================================================');
  lines.push('');
  
  // Windows
  for (let i = 0; i < analysis.windows.length; i++) {
    lines.push(formatCorrelationWindow(analysis.windows[i], i));
  }
  
  lines.push('================================================================');
  lines.push('');
  
  return lines.join('\n');
}
