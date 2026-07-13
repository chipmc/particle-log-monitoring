/**
 * Timeline Query Endpoint
 *
 * GET /device/{deviceId}/timeline
 *
 * Returns chronological event list with normalized fields from Phase 2A.
 */
import { TimelineResponse } from '../types';
/**
 * Handle timeline query request
 *
 * Query parameters:
 * - hours: Query last N hours (default: 24, max: 168)
 * - start: Explicit start time (ISO8601)
 * - end: Explicit end time (ISO8601)
 * - limit: Max events to return (default: 100, max: 1000)
 *
 * @param pathParameters - Path parameters from API Gateway
 * @param queryParameters - Query string parameters
 * @returns Timeline response
 */
export declare function handleTimelineQuery(pathParameters: Record<string, string | undefined> | undefined, queryParameters: Record<string, string | undefined> | undefined): Promise<TimelineResponse>;
//# sourceMappingURL=timeline.d.ts.map