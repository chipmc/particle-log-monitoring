"use strict";
/**
 * DynamoDB operations for event indexing
 *
 * Preserves the Phase 1 index shape and adds Phase 2A normalized fields:
 * - Fast indexed retrieval by deviceId + eventTime
 * - Unchanged partition and sort key model
 * - Extended fields from serial forwarder
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ddb = void 0;
exports.indexEvent = indexEvent;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
// Initialize client at module level to allow mocking
const client = new client_dynamodb_1.DynamoDBClient({});
const ddb = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
exports.ddb = ddb;
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
async function indexEvent(tableName, deviceId, eventTime, eventName, receivedAt, s3Key, body, parsedData, normalized) {
    const item = {
        deviceId,
        eventTime,
        eventName,
        receivedAt,
        s3Key,
        fw_version: body.fw_version,
        public: body.public,
        dataType: typeof parsedData,
        // Extended fields from serial forwarder
        sourceType: body.sourceType,
        collectorId: body.collectorId,
        transport: body.transport,
        eventType: body.eventType,
        sourceEventType: body.eventType,
        deviceName: body.deviceName,
        logLine: body.logLine,
        // Additive normalized/enriched fields. Canonical eventType intentionally
        // supersedes the inbound value; sourceEventType retains the raw value.
        ...normalized,
    };
    await ddb.send(new lib_dynamodb_1.PutCommand({
        TableName: tableName,
        Item: item,
    }));
}
//# sourceMappingURL=dynamo.js.map