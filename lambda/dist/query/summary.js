"use strict";
/**
 * Summary Query Endpoint
 *
 * GET /device/{deviceId}/summary
 *
 * Returns high-level device statistics aggregated from DynamoDB.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSummaryQuery = handleSummaryQuery;
const dynamo_read_1 = require("../storage/dynamo-read");
const query_params_1 = require("../utils/query-params");
const anomaly_detection_1 = require("../utils/anomaly-detection");
/**
 * Handle summary query request
 *
 * Query parameters:
 * - hours: Summary window (default: 168, max: 720)
 *
 * @param pathParameters - Path parameters from API Gateway
 * @param queryParameters - Query string parameters
 * @returns Summary response with aggregated statistics
 */
async function handleSummaryQuery(pathParameters, queryParameters) {
    const tableName = process.env.LOG_EVENTS_TABLE_NAME;
    if (!tableName) {
        throw new Error('LOG_EVENTS_TABLE_NAME environment variable not set');
    }
    // Extract device ID from path
    const deviceId = (0, query_params_1.extractDeviceId)(pathParameters);
    // Parse and validate query parameters (longer default window for summary)
    const params = (0, query_params_1.parseQueryParams)(queryParameters || {}, {
        defaultHours: 168, // 7 days
        maxHours: 720, // 30 days
        defaultLimit: 1000,
        maxLimit: 1000,
    });
    // Query events from DynamoDB
    const events = await (0, dynamo_read_1.queryDeviceEvents)(tableName, deviceId, params.timeRange.start, params.timeRange.end, params.limit, false // oldest first
    );
    if (events.length === 0) {
        throw new Error(`No data found for device: ${deviceId}`);
    }
    // Get absolute first and last events for the device
    const firstEvent = await (0, dynamo_read_1.getFirstEvent)(tableName, deviceId);
    const latestEvent = await (0, dynamo_read_1.getLatestEvent)(tableName, deviceId);
    // Aggregate statistics
    const eventCounts = aggregateEventCounts(events);
    const planes = aggregatePlanes(events);
    const firmwareVersions = extractUniqueFirmwareVersions(events);
    // Detect recent anomalies
    const anomalies = (0, anomaly_detection_1.detectAnomalies)(events);
    const recentAnomalyCount = anomalies.length;
    // Calculate time span
    const firstEventTime = firstEvent?.eventTime || events[0].eventTime;
    const lastEventTime = latestEvent?.eventTime || events[events.length - 1].eventTime;
    const hours = calculateHours(firstEventTime, lastEventTime);
    return {
        deviceId,
        eventCount: events.length,
        firstEventTime,
        lastEventTime,
        timeSpan: {
            hours,
        },
        eventCounts,
        planes,
        firmwareVersions,
        recentAnomalyCount,
    };
}
/**
 * Aggregate event counts by eventType
 */
function aggregateEventCounts(events) {
    const counts = {};
    for (const event of events) {
        const eventType = event.eventType || event.eventName || 'unknown';
        counts[eventType] = (counts[eventType] || 0) + 1;
    }
    // Sort by count (descending)
    return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}
/**
 * Aggregate event counts by plane
 */
function aggregatePlanes(events) {
    const planes = {};
    for (const event of events) {
        const plane = event.plane || 'unknown';
        planes[plane] = (planes[plane] || 0) + 1;
    }
    return planes;
}
/**
 * Extract unique firmware versions (sorted)
 */
function extractUniqueFirmwareVersions(events) {
    const versions = new Set();
    for (const event of events) {
        if (event.fwVersion && typeof event.fwVersion === 'string') {
            versions.add(event.fwVersion);
        }
        else if (event.fw_version && typeof event.fw_version === 'string') {
            versions.add(event.fw_version);
        }
    }
    return Array.from(versions).sort();
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
//# sourceMappingURL=summary.js.map