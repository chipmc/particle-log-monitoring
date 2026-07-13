/**
 * Parsing utilities for Particle webhook events
 *
 * Phase 1: Extract current parsing logic (exact behavior preservation)
 * Phase 2A: Add best-effort normalization functions
 */
import { EventSeverity, NormalizedEventFields, ParticleWebhook, ParsedEvent } from '../types';
/**
 * Parse raw request body into ParticleWebhook object
 * Preserves exact current behavior including error handling
 */
export declare function parseEventBody(rawBody: string): ParticleWebhook;
/**
 * Extract device ID from webhook with fallback logic
 * Preserves exact current priority: coreid -> deviceId -> "unknown"
 */
export declare function extractDeviceId(body: ParticleWebhook): string;
/**
 * Extract timestamp from webhook with fallback logic
 * Preserves exact current priority: published_at -> timestamp -> now
 */
export declare function extractTimestamp(body: ParticleWebhook): string;
/**
 * Extract event name from webhook
 * Preserves exact current fallback
 */
export declare function extractEventName(body: ParticleWebhook): string;
/**
 * Safely parse data field which may be JSON string or plain text
 * Preserves exact current behavior: try parse, fallback to raw
 */
export declare function safeParseData(data: any): any;
/**
 * Build the parsed event record
 * Preserves exact current "safeRecord" structure
 */
export declare function buildParsedEvent(body: ParticleWebhook, userAgent?: string, sourceIp?: string): ParsedEvent;
/**
 * Generate S3 key for raw event storage
 * Preserves exact current path format:
 * particle-events/YYYY-MM-DD/{eventName}/{deviceId}/timestamp.json
 */
export declare function generateS3Key(eventName: string, deviceId: string, publishedAt: string): string;
/**
 * Context already established by the handler before normalization.
 */
export interface NormalizationContext {
    deviceId: string;
    eventName: string;
    eventTime: string;
    s3Key: string;
}
/**
 * Normalize an inbound event into the additive fields stored in DynamoDB.
 * Parsing is deliberately best effort: unknown or malformed payloads still
 * receive the base envelope fields and are classified as telemetry.event.
 */
export declare function normalizeEvent(body: ParticleWebhook, parsedData: any, context: NormalizationContext): NormalizedEventFields;
/**
 * Parse serial log severity without rejecting unfamiliar log formats.
 */
export declare function parseSeverity(logLine?: unknown): EventSeverity | null;
export declare function parseResetCause(): string | null;
export declare function parseQueueDepth(logLine?: unknown): number | null;
export declare function parseNetworkState(): string | null;
//# sourceMappingURL=parse.d.ts.map