"use strict";
/**
 * Standardized API response formatting utilities
 *
 * Provides consistent response structure for all query endpoints.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.successResponse = successResponse;
exports.errorResponse = errorResponse;
exports.handleError = handleError;
exports.unauthorizedResponse = unauthorizedResponse;
exports.notFoundResponse = notFoundResponse;
exports.badRequestResponse = badRequestResponse;
/**
 * Create a successful JSON response
 *
 * @param data - Response data to return
 * @param statusCode - HTTP status code (default: 200)
 * @returns Formatted API Gateway response
 */
function successResponse(data, statusCode = 200) {
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
function errorResponse(error, message, statusCode) {
    const errorBody = {
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
function handleError(error) {
    console.error('Request error:', error);
    if (error instanceof Error) {
        // Check for validation errors (from query-params)
        if (error.message.includes('Invalid') ||
            error.message.includes('required') ||
            error.message.includes('must be') ||
            error.message.includes('cannot exceed')) {
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
    return errorResponse('internal_error', 'An unexpected error occurred', 500);
}
/**
 * Create a 401 Unauthorized response
 */
function unauthorizedResponse(message = 'Unauthorized') {
    return errorResponse('unauthorized', message, 401);
}
/**
 * Create a 404 Not Found response
 */
function notFoundResponse(message = 'Resource not found') {
    return errorResponse('not_found', message, 404);
}
/**
 * Create a 400 Bad Request response
 */
function badRequestResponse(message) {
    return errorResponse('bad_request', message, 400);
}
//# sourceMappingURL=response.js.map