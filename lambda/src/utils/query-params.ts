/**
 * Query parameter parsing and validation utilities
 * 
 * Handles time range calculation, limit validation, and parameter extraction
 * for read-only query endpoints.
 */

export interface TimeRange {
  start: string; // ISO8601
  end: string;   // ISO8601
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
export function parseQueryParams(
  params: Record<string, string | undefined>,
  options: {
    defaultHours?: number;
    maxHours?: number;
    defaultLimit?: number;
    maxLimit?: number;
  } = {}
): ParsedQueryParams {
  const {
    defaultHours = 24,
    maxHours = 168,
    defaultLimit = 100,
    maxLimit = 1000,
  } = options;

  // Parse time range
  let timeRange: TimeRange;

  if (params.start && params.end) {
    // Explicit time range
    timeRange = parseExplicitTimeRange(params.start, params.end);
  } else if (params.hours) {
    // Hours from now
    const hours = parseHours(params.hours, maxHours);
    timeRange = calculateTimeRangeFromHours(hours);
  } else {
    // Default to defaultHours from now
    timeRange = calculateTimeRangeFromHours(defaultHours);
  }

  // Parse limit
  const limit = parseLimit(params.limit, defaultLimit, maxLimit);

  // Parse severity filter (optional)
  const severity = parseSeverity(params.severity);

  return {
    timeRange,
    limit,
    severity,
  };
}

/**
 * Parse explicit start/end time range
 */
function parseExplicitTimeRange(start: string, end: string): TimeRange {
  // Validate ISO8601 format
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (isNaN(startDate.getTime())) {
    throw new Error(`Invalid start time: ${start}. Must be ISO8601 format.`);
  }

  if (isNaN(endDate.getTime())) {
    throw new Error(`Invalid end time: ${end}. Must be ISO8601 format.`);
  }

  // Validate range order
  if (startDate >= endDate) {
    throw new Error('Start time must be before end time');
  }

  // Validate not in future
  const now = new Date();
  if (endDate > now) {
    throw new Error('End time cannot be in the future');
  }

  return {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
  };
}

/**
 * Parse hours parameter
 */
function parseHours(hoursParam: string | undefined, maxHours: number): number {
  if (!hoursParam) {
    throw new Error('Hours parameter is required');
  }

  const hours = parseFloat(hoursParam);

  if (isNaN(hours)) {
    throw new Error(`Invalid hours value: ${hoursParam}. Must be a number.`);
  }

  if (hours <= 0) {
    throw new Error(`Hours must be positive. Got: ${hours}`);
  }

  if (hours > maxHours) {
    throw new Error(`Hours cannot exceed ${maxHours}. Got: ${hours}`);
  }

  return hours;
}

/**
 * Calculate time range from hours back from now
 */
function calculateTimeRangeFromHours(hours: number): TimeRange {
  const end = new Date();
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/**
 * Parse limit parameter
 */
function parseLimit(
  limitParam: string | undefined,
  defaultLimit: number,
  maxLimit: number
): number {
  if (!limitParam) {
    return defaultLimit;
  }

  const limit = parseInt(limitParam, 10);

  if (isNaN(limit)) {
    throw new Error(`Invalid limit value: ${limitParam}. Must be an integer.`);
  }

  if (limit <= 0) {
    throw new Error(`Limit must be positive. Got: ${limit}`);
  }

  if (limit > maxLimit) {
    throw new Error(`Limit cannot exceed ${maxLimit}. Got: ${limit}`);
  }

  return limit;
}

/**
 * Parse severity filter
 */
function parseSeverity(
  severityParam: string | undefined
): 'low' | 'medium' | 'high' | undefined {
  if (!severityParam) {
    return undefined;
  }

  const severity = severityParam.toLowerCase();

  if (severity !== 'low' && severity !== 'medium' && severity !== 'high') {
    throw new Error(
      `Invalid severity: ${severityParam}. Must be one of: low, medium, high`
    );
  }

  return severity as 'low' | 'medium' | 'high';
}

/**
 * Extract device ID from path parameters
 */
export function extractDeviceId(
  pathParameters: Record<string, string | undefined> | undefined
): string {
  if (!pathParameters?.deviceId) {
    throw new Error('deviceId path parameter is required');
  }

  return pathParameters.deviceId;
}
