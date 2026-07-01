# Lambda Development

## Overview

Unified Lambda handler for Particle telemetry ingestion and query API.

**Capabilities:**
- POST /particle/log - Webhook ingestion (Phase 1 + 2A)
- GET /device/... - Read-only query API (Phase 2B)

## Directory Structure

```
lambda/
├── src/
│   ├── handler.ts           # Main Lambda entry point (route dispatcher)
│   ├── ingestion.ts         # Webhook ingestion handler (Phase 1 + 2A)
│   ├── query.ts             # Query API route handler (Phase 2B)
│   ├── query/
│   │   ├── timeline.ts      # GET /device/{deviceId}/timeline
│   │   ├── health.ts        # GET /device/{deviceId}/health
│   │   ├── summary.ts       # GET /device/{deviceId}/summary
│   │   └── anomalies.ts     # GET /device/{deviceId}/anomalies
│   ├── storage/
│   │   ├── s3.ts            # S3 write operations
│   │   ├── dynamo.ts        # DynamoDB write operations
│   │   └── dynamo-read.ts   # DynamoDB query operations (Phase 2B)
│   ├── utils/
│   │   ├── parse.ts         # Event parsing and normalization
│   │   ├── query-params.ts  # Query parameter parsing (Phase 2B)
│   │   ├── response.ts      # API response formatting (Phase 2B)
│   │   └── anomaly-detection.ts # Health anomaly detection (Phase 2B)
│   └── types/
│       └── index.ts         # TypeScript type definitions
├── tests/                   # Unit tests
├── package.json
├── tsconfig.json
└── jest.config.js
```

## Request Flow

### Ingestion (POST /particle/log)

```
API Gateway
  → handler.ts (dispatcher)
    → ingestion.ts
      → parse.ts (normalize event)
      → s3.ts (store raw)
      → dynamo.ts (index)
    → Response: {ok: true, stored: true}
```

### Query (GET /device/{deviceId}/...)

```
API Gateway
  → handler.ts (dispatcher)
    → query.ts (route handler)
      → timeline.ts | health.ts | summary.ts | anomalies.ts
        → dynamo-read.ts (query DynamoDB)
        → anomaly-detection.ts (detect issues)
    → Response: JSON telemetry data
```

## Development Workflow

### Install Dependencies

```bash
cd lambda
npm install
```

### Build

```bash
npm run build
```

Output: `dist/` directory with compiled JavaScript
Request Routing (Phase 2B)

The main `handler.ts` dispatches requests based on HTTP method:

- **POST requests** → `ingestion.ts` (unchanged Phase 1 + 2A behavior)
- **GET requests** → `query.ts` → specific query endpoint

This preserves the existing ingestion path while adding read-only query capabilities.

### Current Behavior (Phase 2A)

Ingestion implementation preserves Phase 1 behavior and adds best-effort normalization:

- Authentication via webhook secret header
- S3 immutable raw event storage
- DynamoDB fast indexed retrieval
- Unchanged `deviceId` partition key and `eventTime` sort key
- Existing DynamoDB attributes retained
- Stable `plane` and `eventType` classification
- Common Particle webhook metrics extracted into normalized fields
- Serial severity extraction from `logLine`
- Deterministic event IDs and S3 `rawRef`
- Synthetic timestamp marking
- Unknown and malformed payloads accepted

Normalized attributes are added to the existing DynamoDB item. Raw S3 object remains immutable.

### Query API (Phase 2B)

New read-only endpoints for device telemetry:

- **Timeline**: Chronological event list with normalized fields
- **Health**: Device health metrics and anomaly detection
- **Summary**: High-level device statistics and aggregations
- **Anomalies**: Detected issues based on health rules

**Data Source:** DynamoDB normalized fields (no S3 reads required)

**Authentication:** Currently reuses webhook secret. Should migrate to separate API keys/OAuth for production browser access.

See `../docs/API.md` for complete API documentation.
3. Deploy to AWS and test with real webhooks

## Testing

### Unit Tests

- `tests/handler.test.ts` - Handler integration tests
- `tests/storage/*.test.ts` - Storage module tests
- `tests/utils/*.test.ts` - Parser utility tests

Coverage threshold: 80% lines/functions, 70% branches

### Integration Testing

After deployment, test with:

```bash
curl -X POST https://<api-gateway-url>/particle/log \
  -H "Content-Type: application/json" \
  -H "X-Particle-Webhook-Secret: <secret>" \
  -d '{"event":"test","coreid":"device123","published_at":"2026-06-26T14:30:00.000Z"}'
```

Expected: `{"ok":true,"stored":true}`

## Architecture Notes

### Current Behavior (Phase 2A)

This implementation preserves the Phase 1 ingestion path and adds best-effort
normalization:

- Authentication via webhook secret header
- S3 immutable raw event storage
- DynamoDB fast indexed retrieval
- Unchanged `deviceId` partition key and `eventTime` sort key
- Existing DynamoDB attributes retained
- Stable `plane` and `eventType` classification
- Common Particle webhook metrics extracted into normalized fields
- Serial severity extraction from `logLine`
- Deterministic event IDs and S3 `rawRef`
- Synthetic timestamp marking
- Unknown and malformed payloads accepted

Normalized attributes are added to the existing DynamoDB item. Raw S3 object
keys and bodies are unchanged. If normalization unexpectedly throws, the
handler logs a warning and continues the original index write without the
normalized attributes.

For serial lifecycle compatibility, canonical `eventType` is stored alongside
the inbound classification retained as `sourceEventType`.

See `docs/contracts/canonical-event-envelope.md` for canonical schema.

## Performance Considerations

### Production Traffic Pattern

- **Burst traffic:** ~500 devices at top of each hour
- **Reporting window:** 6:00am–10:00pm Eastern Time
- **Normal frequency:** Once per hour per device

### Optimization Notes

- Storage operations are async (non-blocking)
- No synchronous validation or transformation
- Lambda can handle concurrent invocations without serialization
- Test suite includes burst traffic simulation (500 concurrent requests)

## Deployment

Deployed via CDK from `infra/` directory.

CDK automatically compiles TypeScript and bundles Lambda code.

See `infra/README.md` for deployment instructions.

### Preferred Deployment Window

**Bottom of the hour** (e.g., 7:30am, 8:30am, 9:30am ET)

This minimizes risk of lost telemetry during top-of-hour reporting bursts.

### Post-Deploy Validation

1. **Immediate validation:**
   - Test webhook endpoint responds (200 OK)
   - Verify S3 raw event stored
   - Verify DynamoDB index created
   - Check CloudWatch logs for errors

2. **Next top-of-hour validation:**
   - Monitor CloudWatch metrics during burst
   - Verify all devices successfully ingested
   - Check for throttling or timeout errors
   - Confirm S3/DynamoDB write success rates

## Environment Variables

Required:

- `PARTICLE_WEBHOOK_SECRET` - Webhook authentication secret
- `RAW_LOGS_BUCKET_NAME` - S3 bucket for raw events
- `LOG_EVENTS_TABLE_NAME` - DynamoDB table for indexed events

Set by CDK during deployment.

## Troubleshooting

### Build Errors

- Verify TypeScript version: `5.5.x`
- Check `node_modules` installed: `npm install`
- Clear build cache: `rm -rf dist && npm run build`

### Test Failures

- Check AWS SDK mocks in test setup
- Verify environment variables in test config
- Run tests individually to isolate failures

### Runtime Errors

- Check CloudWatch logs: `/aws/lambda/<function-name>`
- Verify environment variables set correctly
- Test authentication with curl command above
- Verify S3/DynamoDB permissions granted by CDK
