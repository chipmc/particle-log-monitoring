/**
 * Standardized API response formatting utilities
 * 
 * Provides consistent response structure for all query endpoints.
 */

export interface ApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

/**
 * Create a successful JSON response
 * 
 * @param data - Response data to return
 * @param statusCode - HTTP status code (default: 200)
 * @returns Formatted API Gateway response
 */
export function successResponse(data: any, statusCode: number = 200): ApiResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', // Configure for production
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
    body: JSON.stringify(data),
  };
}

/**
 * Create an error response
 * 
 * @param error - Error code/type
 * @param message - Human-readable error message
 * @param statusCode - HTTP status code
 * @returns Formatted API Gateway error response
 */
export function errorResponse(
  error: string,
  message: string,
  statusCode: number
): ApiResponse {
  const errorBody: ErrorResponse = {
    error,
    message,
    statusCode,
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
    body: JSON.stringify(errorBody),
  };
}

/**
 * Handle caught errors and convert to appropriate response
 * 
 * @param error - Caught error
 * @returns Formatted error response
 */
export function handleError(error: unknown): ApiResponse {
  console.error('Request error:', error);

  if (error instanceof Error) {
    // Check for validation errors (from query-params)
    if (
      error.message.includes('Invalid') ||
      error.message.includes('required') ||
      error.message.includes('must be') ||
      error.message.includes('cannot exceed')
    ) {
      return errorResponse('invalid_parameter', error.message, 400);
    }

    // Check for not found errors
    if (error.message.includes('not found') || error.message.includes('No data')) {
      return errorResponse('not_found', error.message, 404);
    }

    // Generic error
    return errorResponse('internal_error', error.message, 500);
  }

  // Unknown error type
  return errorResponse(
    'internal_error',
    'An unexpected error occurred',
    500
  );
}

/**
 * Create a 401 Unauthorized response
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): ApiResponse {
  return errorResponse('unauthorized', message, 401);
}

/**
 * Create a 404 Not Found response
 */
export function notFoundResponse(message: string = 'Resource not found'): ApiResponse {
  return errorResponse('not_found', message, 404);
}

/**
 * Create a 400 Bad Request response
 */
export function badRequestResponse(message: string): ApiResponse {
  return errorResponse('bad_request', message, 400);
}
