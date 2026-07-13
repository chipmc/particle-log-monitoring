/**
 * Particle Log Ingestion Handler
 *
 * Extracted from handler.ts to separate ingestion from query logic.
 * Preserves exact Phase 1 + Phase 2A behavior.
 *
 * This module handles POST /particle/log webhook ingestion.
 */
import { InboundEvent, LambdaResponse } from './types';
/**
 * Handle ingestion of Particle webhook events
 *
 * Preserves exact current behavior:
 * - 401 if webhook secret missing/invalid
 * - 400 if JSON body invalid
 * - 200 on successful storage
 * - Same logging output
 *
 * @param event - API Gateway event
 * @returns Lambda response
 */
export declare function handleIngestion(event: InboundEvent): Promise<LambdaResponse>;
//# sourceMappingURL=ingestion.d.ts.map