/**
 * Query Route Handler
 *
 * Handles all GET requests for read-only telemetry query endpoints.
 * Routes requests to appropriate query handlers.
 */
import { QueryEvent, LambdaResponse } from './types';
/**
 * Main query route handler
 *
 * Routes GET requests to appropriate query endpoint:
 * - GET /device/{deviceId}/timeline
 * - GET /device/{deviceId}/health
 * - GET /device/{deviceId}/summary
 * - GET /device/{deviceId}/anomalies
 * - GET /fleet/summary
 * - GET /fleet/anomalies
 * - GET /fleet/offline
 *
 * TODO: Separate authentication model for query endpoints.
 * Currently reuses x-particle-webhook-secret for simplicity.
 * Should migrate to API keys or OAuth for read-only access.
 *
 * @param event - API Gateway query event
 * @returns Lambda response
 */
export declare function handleQuery(event: QueryEvent): Promise<LambdaResponse>;
//# sourceMappingURL=query.d.ts.map