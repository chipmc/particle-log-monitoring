/**
 * Anomalies Query Endpoint
 * 
 * GET /device/{deviceId}/anomalies
 * 
 * Returns detected anomalies and issues based on normalized Phase 2A fields.
 */

import { AnomaliesResponse, DynamoIndexRecord } from '../types';
import { queryDeviceEvents } from '../storage/dynamo-read';
import { parseQueryParams, extractDeviceId } from '../utils/query-params';
import { detectAnomalies, filterBySeverity, sortAnomalies } from '../utils/anomaly-detection';

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
export async function handleAnomaliesQuery(
  pathParameters: Record<string, string | undefined> | undefined,
  queryParameters: Record<string, string | undefined> | undefined
): Promise<AnomaliesResponse> {
  const tableName = process.env.LOG_EVENTS_TABLE_NAME;
  if (!tableName) {
    throw new Error('LOG_EVENTS_TABLE_NAME environment variable not set');
  }

  // Extract device ID from path
  const deviceId = extractDeviceId(pathParameters);

  // Parse and validate query parameters
  const params = parseQueryParams(queryParameters || {}, {
    defaultHours: 24,
    maxHours: 168,
    defaultLimit: 1000, // Get more events for anomaly detection
    maxLimit: 1000,
  });

  // Query events from DynamoDB
  const events = await queryDeviceEvents(
    tableName,
    deviceId,
    params.timeRange.start,
    params.timeRange.end,
    params.limit,
    false // oldest first for chronological analysis
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
  let anomalies = detectAnomalies(events);

  // Filter by severity if requested
  if (params.severity) {
    anomalies = filterBySeverity(anomalies, params.severity);
  }

  // Sort by severity and time
  anomalies = sortAnomalies(anomalies);

  return {
    deviceId,
    count: anomalies.length,
    anomalies,
  };
}
