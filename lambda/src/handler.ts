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
import { handleIngestion } from './ingestion';
import { handleQuery } from './query';

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
export async function handler(event: InboundEvent | QueryEvent): Promise<LambdaResponse> {
  // Detect event format and extract HTTP method
  // HTTP API v2 uses requestContext.http.method and has version/routeKey fields
  let method: string;
  let path: string;
  
  // Type guard: Check for QueryEvent (HTTP API v2)
  const isQueryEvent = (evt: InboundEvent | QueryEvent): evt is QueryEvent => {
    return 'version' in evt && 'routeKey' in evt && 'requestContext' in evt;
  };

  if (isQueryEvent(event)) {
    // HTTP API v2 format (production)
    method = event.requestContext.http.method;
    path = event.requestContext.http.path;
  } else {
    // Legacy InboundEvent format (tests/backward compat)
    method = 'POST';
    path = '/particle/log';
  }

  console.log('Request:', {
    method,
    path,
    routeKey: isQueryEvent(event) ? event.routeKey : undefined,
    deviceId: isQueryEvent(event) ? event.pathParameters?.deviceId : undefined,
  });

  // Route to appropriate handler based on HTTP method
  if (method === 'POST') {
    // POST /particle/log → Ingestion (exact Phase 1 + 2A behavior)
    // Both InboundEvent and QueryEvent are compatible with handleIngestion
    return handleIngestion(event);
  }

  if (method === 'GET') {
    // GET /device/... → Query API (Phase 2B)
    // Must be a QueryEvent with full structure
    if (!isQueryEvent(event)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'bad_request',
          message: 'Query requests require full HTTP API v2 event structure',
        }),
      };
    }
    return handleQuery(event);
  }

  // Unsupported method
  return {
    statusCode: 405,
    body: JSON.stringify({
      error: 'method_not_allowed',
      message: `Method ${method} not allowed`,
    }),
  };
}
