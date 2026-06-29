/**
 * Tests for health diagnostics module
 */

import { analyzeDeviceHealth } from '../src/lib/health';
import { DynamoIndexRecord, S3StorageRecord } from '../src/types';

describe('Health Diagnostics', () => {
  
  describe('analyzeDeviceHealth', () => {
    
    it('should handle empty events', async () => {
      const health = await analyzeDeviceHealth('test-device', [], []);
      
      expect(health.deviceId).toBe('test-device');
      expect(health.eventCount).toBe(0);
      expect(health.anomalies).toEqual([]);
    });
    
    it('should extract battery metrics from payloads', async () => {
      const events: DynamoIndexRecord[] = [
        {
          deviceId: 'test-device',
          eventTime: '2026-06-28T10:00:00.000Z',
          eventName: 'sensor-hook',
          receivedAt: '2026-06-28T10:00:01.000Z',
          s3Key: 'test-key-1',
          dataType: 'string',
        },
        {
          deviceId: 'test-device',
          eventTime: '2026-06-28T11:00:00.000Z',
          eventName: 'sensor-hook',
          receivedAt: '2026-06-28T11:00:01.000Z',
          s3Key: 'test-key-2',
          dataType: 'string',
        },
      ];
      
      const s3Payloads: S3StorageRecord[] = [
        {
          particle: {
            data: '{"battery": 95.5, "temp": 25.0}',
          },
          parsed: {},
        },
        {
          particle: {
            data: '{"battery": 92.0, "temp": 26.5}',
          },
          parsed: {},
        },
      ];
      
      const health = await analyzeDeviceHealth('test-device', events, s3Payloads);
      
      expect(health.metrics.battery).toBeDefined();
      expect(health.metrics.battery!.latest).toBe(92.0);
      expect(health.metrics.battery!.min).toBe(92.0);
      expect(health.metrics.battery!.max).toBe(95.5);
      expect(health.metrics.battery!.average).toBeCloseTo(93.75, 1);
      expect(health.metrics.battery!.change).toBeCloseTo(-3.5, 1);
    });
    
    it('should handle HTML-encoded JSON data', async () => {
      const events: DynamoIndexRecord[] = [
        {
          deviceId: 'test-device',
          eventTime: '2026-06-28T10:00:00.000Z',
          eventName: 'sensor-hook',
          receivedAt: '2026-06-28T10:00:01.000Z',
          s3Key: 'test-key',
          dataType: 'string',
        },
      ];
      
      const s3Payloads: S3StorageRecord[] = [
        {
          particle: {
            data: '&quot;battery&quot;:90.7,&quot;temp&quot;:29.7}',
          },
          parsed: {},
        },
      ];
      
      const health = await analyzeDeviceHealth('test-device', events, s3Payloads);
      
      // Should parse HTML-encoded data
      expect(health.metrics.battery).toBeDefined();
      expect(health.metrics.battery!.latest).toBe(90.7);
    });
    
    it('should extract metrics from top-level particle fields', async () => {
      const events: DynamoIndexRecord[] = [
        {
          deviceId: 'test-device',
          eventTime: '2026-06-28T10:00:00.000Z',
          eventName: 'sensor-hook',
          receivedAt: '2026-06-28T10:00:01.000Z',
          s3Key: 'test-key',
          dataType: 'string',
        },
      ];
      
      const s3Payloads: S3StorageRecord[] = [
        {
          particle: {
            battery: '85.5',
            temp: '30.2',
            connecttime: '5',
            resets: '0',
            alerts: '0',
          },
          parsed: {},
        },
      ];
      
      const health = await analyzeDeviceHealth('test-device', events, s3Payloads);
      
      expect(health.metrics.battery).toBeDefined();
      expect(health.metrics.battery!.latest).toBe(85.5);
      expect(health.metrics.temperature).toBeDefined();
      expect(health.metrics.temperature!.latest).toBe(30.2);
      expect(health.metrics.connecttime).toBeDefined();
      expect(health.metrics.connecttime!.latest).toBe(5);
    });
    
    it('should detect low battery anomaly', async () => {
      const events: DynamoIndexRecord[] = [
        {
          deviceId: 'test-device',
          eventTime: '2026-06-28T10:00:00.000Z',
          eventName: 'sensor-hook',
          receivedAt: '2026-06-28T10:00:01.000Z',
          s3Key: 'test-key',
          dataType: 'string',
        },
      ];
      
      const s3Payloads: S3StorageRecord[] = [
        {
          particle: {
            data: '{"battery": 25.0}',
          },
          parsed: {},
        },
      ];
      
      const health = await analyzeDeviceHealth('test-device', events, s3Payloads);
      
      const batteryAnomaly = health.anomalies.find(a => a.metric === 'battery');
      expect(batteryAnomaly).toBeDefined();
      expect(batteryAnomaly!.severity).toBe('MEDIUM');
      expect(batteryAnomaly!.message).toContain('Battery critically low');
    });
    
    it('should detect high connection time anomaly', async () => {
      const events: DynamoIndexRecord[] = [
        {
          deviceId: 'test-device',
          eventTime: '2026-06-28T10:00:00.000Z',
          eventName: 'sensor-hook',
          receivedAt: '2026-06-28T10:00:01.000Z',
          s3Key: 'test-key',
          dataType: 'string',
        },
      ];
      
      const s3Payloads: S3StorageRecord[] = [
        {
          particle: {
            data: '{"connecttime": 250}',
          },
          parsed: {},
        },
      ];
      
      const health = await analyzeDeviceHealth('test-device', events, s3Payloads);
      
      const connectAnomaly = health.anomalies.find(a => a.metric === 'connecttime');
      expect(connectAnomaly).toBeDefined();
      expect(connectAnomaly!.severity).toBe('MEDIUM');
      expect(connectAnomaly!.message).toContain('High connection time');
    });
    
    it('should detect reset count increase', async () => {
      const events: DynamoIndexRecord[] = [
        {
          deviceId: 'test-device',
          eventTime: '2026-06-28T10:00:00.000Z',
          eventName: 'sensor-hook',
          receivedAt: '2026-06-28T10:00:01.000Z',
          s3Key: 'test-key-1',
          dataType: 'string',
        },
        {
          deviceId: 'test-device',
          eventTime: '2026-06-28T11:00:00.000Z',
          eventName: 'sensor-hook',
          receivedAt: '2026-06-28T11:00:01.000Z',
          s3Key: 'test-key-2',
          dataType: 'string',
        },
      ];
      
      const s3Payloads: S3StorageRecord[] = [
        {
          particle: { data: '{"resets": 5}' },
          parsed: {},
        },
        {
          particle: { data: '{"resets": 8}' },
          parsed: {},
        },
      ];
      
      const health = await analyzeDeviceHealth('test-device', events, s3Payloads);
      
      const resetAnomaly = health.anomalies.find(a => a.metric === 'resets');
      expect(resetAnomaly).toBeDefined();
      expect(resetAnomaly!.message).toContain('Reset count increased');
      expect(resetAnomaly!.message).toContain('from 5 to 8');
    });
    
    it('should detect active alerts', async () => {
      const events: DynamoIndexRecord[] = [
        {
          deviceId: 'test-device',
          eventTime: '2026-06-28T10:00:00.000Z',
          eventName: 'sensor-hook',
          receivedAt: '2026-06-28T10:00:01.000Z',
          s3Key: 'test-key',
          dataType: 'string',
        },
      ];
      
      const s3Payloads: S3StorageRecord[] = [
        {
          particle: { data: '{"alerts": 2}' },
          parsed: {},
        },
      ];
      
      const health = await analyzeDeviceHealth('test-device', events, s3Payloads);
      
      const alertAnomaly = health.anomalies.find(a => a.metric === 'alerts');
      expect(alertAnomaly).toBeDefined();
      expect(alertAnomaly!.severity).toBe('HIGH');
      expect(alertAnomaly!.message).toContain('Active alerts detected');
    });
    
    it('should track firmware version changes', async () => {
      const events: DynamoIndexRecord[] = [
        {
          deviceId: 'test-device',
          eventTime: '2026-06-28T10:00:00.000Z',
          eventName: 'sensor-hook',
          receivedAt: '2026-06-28T10:00:01.000Z',
          s3Key: 'test-key-1',
          dataType: 'string',
          fw_version: '13',
        },
        {
          deviceId: 'test-device',
          eventTime: '2026-06-28T11:00:00.000Z',
          eventName: 'sensor-hook',
          receivedAt: '2026-06-28T11:00:01.000Z',
          s3Key: 'test-key-2',
          dataType: 'string',
          fw_version: '14',
        },
      ];
      
      const s3Payloads: S3StorageRecord[] = [
        {
          particle: { fw_version: '13' },
          parsed: {},
        },
        {
          particle: { fw_version: '14' },
          parsed: {},
        },
      ];
      
      const health = await analyzeDeviceHealth('test-device', events, s3Payloads);
      
      expect(health.firmwareVersions).toContain('13');
      expect(health.firmwareVersions).toContain('14');
      expect(health.firmwareChanges).toHaveLength(1);
      expect(health.firmwareChanges[0].from).toBe('13');
      expect(health.firmwareChanges[0].to).toBe('14');
      
      const fwAnomaly = health.anomalies.find(a => a.metric === 'firmware');
      expect(fwAnomaly).toBeDefined();
      expect(fwAnomaly!.severity).toBe('LOW');
    });
    
    it('should calculate time span correctly', async () => {
      const events: DynamoIndexRecord[] = [
        {
          deviceId: 'test-device',
          eventTime: '2026-06-28T10:00:00.000Z',
          eventName: 'sensor-hook',
          receivedAt: '2026-06-28T10:00:01.000Z',
          s3Key: 'test-key-1',
          dataType: 'string',
        },
        {
          deviceId: 'test-device',
          eventTime: '2026-06-28T13:00:00.000Z',
          eventName: 'sensor-hook',
          receivedAt: '2026-06-28T13:00:01.000Z',
          s3Key: 'test-key-2',
          dataType: 'string',
        },
      ];
      
      const s3Payloads: S3StorageRecord[] = [
        { particle: {}, parsed: {} },
        { particle: {}, parsed: {} },
      ];
      
      const health = await analyzeDeviceHealth('test-device', events, s3Payloads);
      
      expect(health.timeSpan.first).toBe('2026-06-28T10:00:00.000Z');
      expect(health.timeSpan.last).toBe('2026-06-28T13:00:00.000Z');
      expect(health.timeSpan.hours).toBe(3.0);
    });
    
    it('should handle all health metrics together', async () => {
      const events: DynamoIndexRecord[] = [
        {
          deviceId: 'test-device',
          eventTime: '2026-06-28T10:00:00.000Z',
          eventName: 'sensor-hook',
          receivedAt: '2026-06-28T10:00:01.000Z',
          s3Key: 'test-key',
          dataType: 'string',
        },
      ];
      
      const s3Payloads: S3StorageRecord[] = [
        {
          particle: {
            data: '{"battery": 85.5, "temp": 28.5, "connecttime": 5, "resets": 0, "alerts": 0, "occupancy": 12, "dailyoccupancy": 150}',
          },
          parsed: {},
        },
      ];
      
      const health = await analyzeDeviceHealth('test-device', events, s3Payloads);
      
      expect(health.metrics.battery).toBeDefined();
      expect(health.metrics.temperature).toBeDefined();
      expect(health.metrics.connecttime).toBeDefined();
      expect(health.metrics.resets).toBeDefined();
      expect(health.metrics.alerts).toBeDefined();
      expect(health.metrics.occupancy).toBeDefined();
      expect(health.metrics.dailyoccupancy).toBeDefined();
    });
    
  });
  
});
