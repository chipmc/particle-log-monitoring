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
export declare function successResponse(data: any, statusCode?: number): ApiResponse;
/**
 * Create an error response
 *
 * @param error - Error code/type
 * @param message - Human-readable error message
 * @param statusCode - HTTP status code
 * @returns Formatted API Gateway error response
 */
export declare function errorResponse(error: string, message: string, statusCode: number): ApiResponse;
/**
 * Handle caught errors and convert to appropriate response
 *
 * @param error - Caught error
 * @returns Formatted error response
 */
export declare function handleError(error: unknown): ApiResponse;
/**
 * Create a 401 Unauthorized response
 */
export declare function unauthorizedResponse(message?: string): ApiResponse;
/**
 * Create a 404 Not Found response
 */
export declare function notFoundResponse(message?: string): ApiResponse;
/**
 * Create a 400 Bad Request response
 */
export declare function badRequestResponse(message: string): ApiResponse;
//# sourceMappingURL=response.d.ts.map