/**
 * Tests for timeline analytics
 */

import { analyzeTimeline } from '../src/lib/analytics';
import { DynamoIndexRecord } from '../src/types';

describe('Timeline Analytics', () => {
  describe('analyzeTimeline', () => {
    it('should handle empty timeline', () => {
      const summary = analyzeTimeline([]);
      
      expect(summary.totalEvents).toBe(0);
      expect(summary.firstEventTime).toBeNull();
      expect(summary.lastEventTime).toBeNull();
      expect(summary.gaps).toHaveLength(0);
      expect(summary.bursts).toHaveLength(0);
    });
    
    it('should count events by name', () => {
      const events: DynamoIndexRecord[] = [
        {
          deviceId: 'test',
          eventTime: '2026-06-28T10:00:00.000Z',
          receivedAt: '2026-06-28T10:00:01.000Z',
          eventName: 'Ubidots-Sensor-Hook-v1',
          s3Key: 'test',
          dataType: 'string',
        },
        {
          deviceId: 'test',
          eventTime: '2026-06-28T11:00:00.000Z',
          receivedAt: '2026-06-28T11:00:01.000Z',
          eventName: 'Ubidots-Sensor-Hook-v1',
          s3Key: 'test',
          dataType: 'string',
        },
        {
          deviceId: 'test',
          eventTime: '2026-06-28T12:00:00.000Z',
          receivedAt: '2026-06-28T12:00:01.000Z',
          eventName: 'watchdog',
          s3Key: 'test',
          dataType: 'string',
        },
      ];
      
      const summary = analyzeTimeline(events);
      
      expect(summary.totalEvents).toBe(3);
      expect(summary.eventCounts['Ubidots-Sensor-Hook-v1']).toBe(2);
      expect(summary.eventCounts['watchdog']).toBe(1);
    });
    
    it('should calculate ingest delays', () => {
      const events: DynamoIndexRecord[] = [
        {
          deviceId: 'test',
          eventTime: '2026-06-28T10:00:00.000Z',
          receivedAt: '2026-06-28T10:00:01.500Z', // 1500ms delay
          eventName: 'test-event',
          s3Key: 'test',
          dataType: 'string',
        },
        {
          deviceId: 'test',
          eventTime: '2026-06-28T11:00:00.000Z',
          receivedAt: '2026-06-28T11:00:00.500Z', // 500ms delay
          eventName: 'test-event',
          s3Key: 'test',
          dataType: 'string',
        },
      ];
      
      const summary = analyzeTimeline(events);
      
      expect(summary.averageIngestDelayMs).toBe(1000); // (1500 + 500) / 2
      expect(summary.maxIngestDelayMs).toBe(1500);
      expect(summary.minIngestDelayMs).toBe(500);
    });
    
    it('should detect gaps', () => {
      const events: DynamoIndexRecord[] = [
        {
          deviceId: 'test',
          eventTime: '2026-06-28T10:00:00.000Z',
          receivedAt: '2026-06-28T10:00:01.000Z',
          eventName: 'event1',
          s3Key: 'test',
          dataType: 'string',
        },
        {
          deviceId: 'test',
          eventTime: '2026-06-28T12:00:00.000Z', // 2 hour gap
          receivedAt: '2026-06-28T12:00:01.000Z',
          eventName: 'event2',
          s3Key: 'test',
          dataType: 'string',
        },
      ];
      
      const summary = analyzeTimeline(events, 90); // 90 minute threshold
      
      expect(summary.gaps).toHaveLength(1);
      expect(summary.gaps[0].durationMinutes).toBe(120);
      expect(summary.gaps[0].eventBefore).toBe('event1');
      expect(summary.gaps[0].eventAfter).toBe('event2');
    });
    
    it('should detect bursts', () => {
      const events: DynamoIndexRecord[] = [
        {
          deviceId: 'test',
          eventTime: '2026-06-28T10:00:00.000Z',
          receivedAt: '2026-06-28T10:00:01.000Z',
          eventName: 'burst1',
          s3Key: 'test',
          dataType: 'string',
        },
        {
          deviceId: 'test',
          eventTime: '2026-06-28T10:01:00.000Z', // 1 min later
          receivedAt: '2026-06-28T10:01:01.000Z',
          eventName: 'burst2',
          s3Key: 'test',
          dataType: 'string',
        },
        {
          deviceId: 'test',
          eventTime: '2026-06-28T10:02:00.000Z', // 2 min later
          receivedAt: '2026-06-28T10:02:01.000Z',
          eventName: 'burst3',
          s3Key: 'test',
          dataType: 'string',
        },
      ];
      
      const summary = analyzeTimeline(events);
      
      expect(summary.bursts).toHaveLength(1);
      expect(summary.bursts[0].eventCount).toBe(3);
    });
    
    it('should collect firmware versions', () => {
      const events: DynamoIndexRecord[] = [
        {
          deviceId: 'test',
          eventTime: '2026-06-28T10:00:00.000Z',
          receivedAt: '2026-06-28T10:00:01.000Z',
          eventName: 'test',
          s3Key: 'test',
          dataType: 'string',
          fw_version: '14',
        },
        {
          deviceId: 'test',
          eventTime: '2026-06-28T11:00:00.000Z',
          receivedAt: '2026-06-28T11:00:01.000Z',
          eventName: 'test',
          s3Key: 'test',
          dataType: 'string',
          fw_version: '14',
        },
        {
          deviceId: 'test',
          eventTime: '2026-06-28T12:00:00.000Z',
          receivedAt: '2026-06-28T12:00:01.000Z',
          eventName: 'test',
          s3Key: 'test',
          dataType: 'string',
          fw_version: '15',
        },
      ];
      
      const summary = analyzeTimeline(events);
      
      expect(summary.firmwareVersions).toEqual(['14', '15']);
    });
  });
});
