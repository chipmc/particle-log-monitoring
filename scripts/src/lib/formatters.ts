/**
 * Display formatters for timeline output
 * Plain text formatting (no color dependencies)
 */

import { DynamoIndexRecord, S3StorageRecord } from '../types';
import { TimelineSummary } from './analytics';

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
