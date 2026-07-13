"use strict";
/**
 * Anomalies Query Endpoint
 *
 * GET /device/{deviceId}/anomalies
 *
 * Returns detected anomalies and issues based on normalized Phase 2A fields.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAnomaliesQuery = handleAnomaliesQuery;
const dynamo_read_1 = require("../storage/dynamo-read");
const query_params_1 = require("../utils/query-params");
const anomaly_detection_1 = require("../utils/anomaly-detection");
/**
 * Handle anomalies query request
 *
 * Query parameters:
 * - hours: Detection window (default: 24, max: 168)
 * - start: Explicit start time (ISO8601)
 * - end: Explicit end time (ISO8601)
 * - severity: Filter by minimum severity (low|medium|high)
 *
 * @param pathParameters - Path parameters from API Gateway
 * @param queryParameters - Query string parameters
 * @returns Anomalies response with detected issues
 */
async function handleAnomaliesQuery(pathParameters, queryParameters) {
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
        defaultLimit: 1000, // Get more events for anomaly detection
        maxLimit: 1000,
    });
    // Query events from DynamoDB
    const events = await (0, dynamo_read_1.queryDeviceEvents)(tableName, deviceId, params.timeRange.start, params.timeRange.end, params.limit, false // oldest first for chronological analysis
    );
    if (events.length === 0) {
        // No events is not an error for anomalies endpoint
        return {
            deviceId,
            count: 0,
            anomalies: [],
        };
    }
    // Detect anomalies
    let anomalies = (0, anomaly_detection_1.detectAnomalies)(events);
    // Filter by severity if requested
    if (params.severity) {
        anomalies = (0, anomaly_detection_1.filterBySeverity)(anomalies, params.severity);
    }
    // Sort by severity and time
    anomalies = (0, anomaly_detection_1.sortAnomalies)(anomalies);
    return {
        deviceId,
        count: anomalies.length,
        anomalies,
    };
}
//# sourceMappingURL=anomalies.js.map