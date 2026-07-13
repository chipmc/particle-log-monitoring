/**
 * Health Query Endpoint
 *
 * GET /device/{deviceId}/health
 *
 * Returns device health metrics and anomaly detection based on normalized
 * Phase 2A DynamoDB fields. Does NOT fetch S3 payloads.
 */
import { HealthResponse } from '../types';
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
export declare function handleHealthQuery(pathParameters: Record<string, string | undefined> | undefined, queryParameters: Record<string, string | undefined> | undefined): Promise<HealthResponse>;
//# sourceMappingURL=health.d.ts.map