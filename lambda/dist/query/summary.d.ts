/**
 * Summary Query Endpoint
 *
 * GET /device/{deviceId}/summary
 *
 * Returns high-level device statistics aggregated from DynamoDB.
 */
import { SummaryResponse } from '../types';
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
export declare function handleSummaryQuery(pathParameters: Record<string, string | undefined> | undefined, queryParameters: Record<string, string | undefined> | undefined): Promise<SummaryResponse>;
//# sourceMappingURL=summary.d.ts.map