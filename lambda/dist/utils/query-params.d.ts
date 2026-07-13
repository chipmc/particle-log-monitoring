/**
 * Query parameter parsing and validation utilities
 *
 * Handles time range calculation, limit validation, and parameter extraction
 * for read-only query endpoints.
 */
export interface TimeRange {
    start: string;
    end: string;
}
export interface QueryParams {
    hours?: number;
    start?: string;
    end?: string;
    limit?: number;
    severity?: 'low' | 'medium' | 'high';
}
export interface ParsedQueryParams {
    timeRange: TimeRange;
    limit: number;
    severity?: 'low' | 'medium' | 'high';
}
/**
 * Parse and validate query parameters
 *
 * Priority:
 * 1. If start/end provided, use explicit range
 * 2. Otherwise use hours to calculate range from now
 * 3. Default to 24 hours if nothing provided
 *
 * @param params - Raw query parameters from API Gateway
 * @param options - Validation options
 * @returns Parsed and validated parameters
 * @throws Error if parameters are invalid
 */
export declare function parseQueryParams(params: Record<string, string | undefined>, options?: {
    defaultHours?: number;
    maxHours?: number;
    defaultLimit?: number;
    maxLimit?: number;
}): ParsedQueryParams;
/**
 * Extract device ID from path parameters
 */
export declare function extractDeviceId(pathParameters: Record<string, string | undefined> | undefined): string;
//# sourceMappingURL=query-params.d.ts.map