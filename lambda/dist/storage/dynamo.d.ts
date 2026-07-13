/**
 * DynamoDB operations for event indexing
 *
 * Preserves the Phase 1 index shape and adds Phase 2A normalized fields:
 * - Fast indexed retrieval by deviceId + eventTime
 * - Unchanged partition and sort key model
 * - Extended fields from serial forwarder
 */
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ParticleWebhook, NormalizedEventFields } from '../types';
declare const ddb: DynamoDBDocumentClient;
/**
 * Index event in DynamoDB for fast retrieval
 *
 * Preserves exact current schema:
 * - Partition key: deviceId
 * - Sort key: eventTime
 * - Includes s3Key reference for raw data replay
 *
 * @param tableName - DynamoDB table name from environment
 * @param deviceId - Device identifier
 * @param eventTime - Event timestamp (published_at)
 * @param eventName - Event name
 * @param receivedAt - Ingestion timestamp
 * @param s3Key - S3 key for raw event
 * @param body - Original webhook body (for extended fields)
 * @param parsedData - Parsed data (for dataType)
 * @param normalized - Best-effort Phase 2 normalization fields
 */
export declare function indexEvent(tableName: string, deviceId: string, eventTime: string, eventName: string, receivedAt: string, s3Key: string, body: ParticleWebhook, parsedData: any, normalized?: NormalizedEventFields): Promise<void>;
export { ddb };
//# sourceMappingURL=dynamo.d.ts.map