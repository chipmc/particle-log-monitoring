/**
 * DynamoDB read operations for query endpoints
 *
 * Provides read-only query capabilities for device timeline and metrics.
 */
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoIndexRecord } from '../types';
declare const ddb: DynamoDBDocumentClient;
/**
 * Query device events within a time range
 *
 * Uses deviceId partition key and eventTime sort key for efficient range queries.
 * Returns events sorted by time (newest first by default).
 *
 * @param tableName - DynamoDB table name
 * @param deviceId - Device partition key
 * @param startTime - Start of time range (ISO8601)
 * @param endTime - End of time range (ISO8601)
 * @param limit - Maximum number of events to return
 * @param newestFirst - Sort order (default: true for newest first)
 * @returns Array of device events
 */
export declare function queryDeviceEvents(tableName: string, deviceId: string, startTime: string, endTime: string, limit?: number, newestFirst?: boolean): Promise<DynamoIndexRecord[]>;
/**
 * Query device events and check if any exist
 *
 * Efficient check for device data existence without fetching all events.
 *
 * @param tableName - DynamoDB table name
 * @param deviceId - Device partition key
 * @returns True if device has any events
 */
export declare function deviceHasEvents(tableName: string, deviceId: string): Promise<boolean>;
/**
 * Get latest event for a device
 *
 * @param tableName - DynamoDB table name
 * @param deviceId - Device partition key
 * @returns Latest event or null if no events
 */
export declare function getLatestEvent(tableName: string, deviceId: string): Promise<DynamoIndexRecord | null>;
/**
 * Get first event for a device
 *
 * @param tableName - DynamoDB table name
 * @param deviceId - Device partition key
 * @returns First event or null if no events
 */
export declare function getFirstEvent(tableName: string, deviceId: string): Promise<DynamoIndexRecord | null>;
export { ddb };
//# sourceMappingURL=dynamo-read.d.ts.map