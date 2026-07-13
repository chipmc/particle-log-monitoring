/**
 * Particle Log Monitoring Lambda - Main Handler
 *
 * Routes requests between ingestion and query handlers:
 * - POST /particle/log → Ingestion (Phase 1 + 2A)
 * - GET /device/... → Query API (Phase 2B)
 *
 * Phase 1: Extracted from inline CDK code (exact behavior preservation)
 * Phase 2A: Additive normalization and enrichment pipeline
 * Phase 2B: Read-only query API for browser/API observability
 */
import { InboundEvent, QueryEvent, LambdaResponse } from './types';
/**
 * Main Lambda handler - Route dispatcher
 *
 * Preserves exact ingestion behavior for POST /particle/log.
 * Adds new GET endpoints for telemetry queries.
 *
 * Accepts both:
 * - InboundEvent (simple POST with body/headers only) - for backward compat
 * - QueryEvent (HTTP API v2 format) - primary production format
 *
 * @param event - API Gateway event (HTTP API v2 or legacy format)
 * @returns Lambda response
 */
export declare function handler(event: InboundEvent | QueryEvent): Promise<LambdaResponse>;
//# sourceMappingURL=handler.d.ts.map