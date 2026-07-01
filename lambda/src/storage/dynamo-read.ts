/**
 * DynamoDB read operations for query endpoints
 * 
 * Provides read-only query capabilities for device timeline and metrics.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoIndexRecord } from '../types';

// Initialize client at module level
const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

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
export async function queryDeviceEvents(
  tableName: string,
  deviceId: string,
  startTime: string,
  endTime: string,
  limit: number = 100,
  newestFirst: boolean = true
): Promise<DynamoIndexRecord[]> {
  const params = {
    TableName: tableName,
    KeyConditionExpression: 'deviceId = :deviceId AND eventTime BETWEEN :start AND :end',
    ExpressionAttributeValues: {
      ':deviceId': deviceId,
      ':start': startTime,
      ':end': endTime,
    },
    Limit: limit,
    ScanIndexForward: !newestFirst, // false = descending (newest first)
  };

  try {
    const result = await ddb.send(new QueryCommand(params));
    return (result.Items || []) as DynamoIndexRecord[];
  } catch (error) {
    console.error('DynamoDB query error:', error);
    throw new Error(`Failed to query device events: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Query device events and check if any exist
 * 
 * Efficient check for device data existence without fetching all events.
 * 
 * @param tableName - DynamoDB table name
 * @param deviceId - Device partition key
 * @returns True if device has any events
 */
export async function deviceHasEvents(
  tableName: string,
  deviceId: string
): Promise<boolean> {
  const params = {
    TableName: tableName,
    KeyConditionExpression: 'deviceId = :deviceId',
    ExpressionAttributeValues: {
      ':deviceId': deviceId,
    },
    Limit: 1,
    Select: 'COUNT' as const,
  };

  try {
    const result = await ddb.send(new QueryCommand(params));
    return (result.Count || 0) > 0;
  } catch (error) {
    console.error('DynamoDB count query error:', error);
    return false;
  }
}

/**
 * Get latest event for a device
 * 
 * @param tableName - DynamoDB table name
 * @param deviceId - Device partition key
 * @returns Latest event or null if no events
 */
export async function getLatestEvent(
  tableName: string,
  deviceId: string
): Promise<DynamoIndexRecord | null> {
  const params = {
    TableName: tableName,
    KeyConditionExpression: 'deviceId = :deviceId',
    ExpressionAttributeValues: {
      ':deviceId': deviceId,
    },
    Limit: 1,
    ScanIndexForward: false, // Get newest first
  };

  try {
    const result = await ddb.send(new QueryCommand(params));
    const items = result.Items as DynamoIndexRecord[] | undefined;
    return items && items.length > 0 ? items[0] : null;
  } catch (error) {
    console.error('DynamoDB latest event query error:', error);
    return null;
  }
}

/**
 * Get first event for a device
 * 
 * @param tableName - DynamoDB table name
 * @param deviceId - Device partition key
 * @returns First event or null if no events
 */
export async function getFirstEvent(
  tableName: string,
  deviceId: string
): Promise<DynamoIndexRecord | null> {
  const params = {
    TableName: tableName,
    KeyConditionExpression: 'deviceId = :deviceId',
    ExpressionAttributeValues: {
      ':deviceId': deviceId,
    },
    Limit: 1,
    ScanIndexForward: true, // Get oldest first
  };

  try {
    const result = await ddb.send(new QueryCommand(params));
    const items = result.Items as DynamoIndexRecord[] | undefined;
    return items && items.length > 0 ? items[0] : null;
  } catch (error) {
    console.error('DynamoDB first event query error:', error);
    return null;
  }
}

// Export for testing
export { ddb };
