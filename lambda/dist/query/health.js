"use strict";
/**
 * Health Query Endpoint
 *
 * GET /device/{deviceId}/health
 *
 * Returns device health metrics and anomaly detection based on normalized
 * Phase 2A DynamoDB fields. Does NOT fetch S3 payloads.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleHealthQuery = handleHealthQuery;
const dynamo_read_1 = require("../storage/dynamo-read");
const query_params_1 = require("../utils/query-params");
const anomaly_detection_1 = require("../utils/anomaly-detection");
/**
 * Handle health query request
 *
 * Query parameters:
 * - hours: Analysis window (default: 24, max: 168)
 * - start: Explicit start time (ISO8601)
 * - end: Explicit end time (ISO8601)
 *
 * @param pathParameters - Path parameters from API Gateway
 * @param queryParameters - Query string parameters
 * @returns Health response with metrics and anomalies
 */
async function handleHealthQuery(pathParameters, queryParameters) {
    const tableName = process.env.LOG_EVENTS_TABLE_NAME;
    if (!tableName) {
        throw new Error('LOG_EVENTS_TABLE_NAME environment variable not set');
    }
    // Extract device ID from path
    const deviceId = (0, query_params_1.extractDeviceId)(pathParameters);
    // Parse and validate query parameters
    const params = (0, query_params_1.parseQueryParams)(queryParameters || {}, {
        defaultHours: 24,
        maxHours: 168,
        defaultLimit: 1000, // Get more events for health analysis
        maxLimit: 1000,
    });
    // Query events from DynamoDB
    const events = await (0, dynamo_read_1.queryDeviceEvents)(tableName, deviceId, params.timeRange.start, params.timeRange.end, params.limit, false // oldest first for chronological analysis
    );
    if (events.length === 0) {
        throw new Error(`No data found for device: ${deviceId}`);
    }
    // Calculate time span
    const firstEvent = events[0].eventTime;
    const lastEvent = events[events.length - 1].eventTime;
    const hours = calculateHours(firstEvent, lastEvent);
    const timeSpan = {
        start: firstEvent,
        end: lastEvent,
        hours,
    };
    // Extract metrics from normalized fields
    const batteryValues = extractMetric(events, 'battery');
    const connectTimeValues = extractMetric(events, 'connectTime');
    const resetCountValues = extractMetric(events, 'resetCount');
    const alertCountValues = extractMetric(events, 'alertCount');
    const temperatureValues = extractMetric(events, 'temperature');
    const occupancyValues = extractMetric(events, 'occupancy');
    const firmwareVersions = extractFirmwareVersions(events);
    // Calculate statistics
    const response = {
        deviceId,
        timeSpan,
        eventCount: events.length,
        firmwareVersions,
        anomalies: [],
    };
    if (batteryValues.length > 0) {
        response.battery = calculateStats(batteryValues);
    }
    if (connectTimeValues.length > 0) {
        response.connectTime = calculateStats(connectTimeValues);
    }
    if (resetCountValues.length > 0) {
        response.resetCount = calculateStats(resetCountValues);
    }
    if (alertCountValues.length > 0) {
        response.alertCount = calculateStats(alertCountValues);
    }
    if (temperatureValues.length > 0) {
        response.temperature = calculateStats(temperatureValues);
    }
    if (occupancyValues.length > 0) {
        response.occupancy = {
            latest: occupancyValues[occupancyValues.length - 1],
            total: occupancyValues.reduce((sum, v) => sum + v, 0),
        };
    }
    // Detect anomalies
    const anomalies = (0, anomaly_detection_1.detectAnomalies)(events);
    response.anomalies = (0, anomaly_detection_1.sortAnomalies)(anomalies);
    return response;
}
/**
 * Extract metric values from events
 */
function extractMetric(events, field) {
    const values = [];
    for (const event of events) {
        const value = event[field];
        if (value !== undefined && value !== null && typeof value === 'number') {
            values.push(value);
        }
    }
    return values;
}
/**
 * Extract unique firmware versions
 */
function extractFirmwareVersions(events) {
    const versions = new Set();
    for (const event of events) {
        if (event.fwVersion && typeof event.fwVersion === 'string') {
            versions.add(event.fwVersion);
        }
    }
    return Array.from(versions).sort();
}
/**
 * Calculate statistics for a metric
 */
function calculateStats(values) {
    if (values.length === 0) {
        throw new Error('Cannot calculate stats for empty array');
    }
    const latest = values[values.length - 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const average = values.reduce((sum, v) => sum + v, 0) / values.length;
    const change = values.length > 1 ? latest - values[0] : undefined;
    return {
        latest: parseFloat(latest.toFixed(2)),
        min: parseFloat(min.toFixed(2)),
        max: parseFloat(max.toFixed(2)),
        average: parseFloat(average.toFixed(2)),
        ...(change !== undefined && { change: parseFloat(change.toFixed(2)) }),
    };
}
/**
 * Calculate hours between two timestamps
 */
function calculateHours(start, end) {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const hours = (endTime - startTime) / (1000 * 60 * 60);
    return parseFloat(hours.toFixed(1));
}
//# sourceMappingURL=health.js.map