/**
 * Anomalies Query Endpoint
 *
 * GET /device/{deviceId}/anomalies
 *
 * Returns detected anomalies and issues based on normalized Phase 2A fields.
 */
import { AnomaliesResponse } from '../types';
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
export declare function handleAnomaliesQuery(pathParameters: Record<string, string | undefined> | undefined, queryParameters: Record<string, string | undefined> | undefined): Promise<AnomaliesResponse>;
//# sourceMappingURL=anomalies.d.ts.map