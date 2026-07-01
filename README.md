Particle Log Monitoring

Unified telemetry ingestion and query platform for Particle IoT devices.

Purpose

This system captures and provides query access to:

* structured device telemetry
* watchdog/reset forensic events
* raw serial runtime logs

into AWS for long-term observability and diagnostics.

⸻

## Features

**Ingestion (Phase 1 + 2A):**
- Particle Product Webhook ingestion
- Raspberry Pi Serial Forwarder support
- Immutable raw event storage in S3
- Fast indexed retrieval via DynamoDB
- Normalized telemetry fields and event classification

**Query API (Phase 2B):**
- Read-only HTTP API for device telemetry
- Timeline queries with time range filtering
- Health metrics and anomaly detection
- Device summary statistics
- Browser/API-based observability foundation

⸻

Current Telemetry Sources

Particle Product Webhooks

Captures:

* occupancy
* dailyoccupancy
* battery
* temperature
* alerts
* resets
* connecttime
* watchdog
* status

⸻

Raspberry Pi Serial Forwarder

Captures:

* boot logs
* modem lifecycle
* reconnect behavior
* sleep/wake transitions
* runtime diagnostics

⸻

AWS Architecture

Particle / Pi
→ API Gateway
→ Lambda (modular TypeScript)
→ S3 raw archive
→ DynamoDB indexed events

**API Endpoints:**
- `POST /particle/log` - Webhook ingestion
- `GET /device/{deviceId}/timeline` - Event timeline
- `GET /device/{deviceId}/health` - Health metrics
- `GET /device/{deviceId}/summary` - Device summary
- `GET /device/{deviceId}/anomalies` - Anomaly detection

See [docs/API.md](docs/API.md) for complete API reference.

⸻

Production Traffic Pattern

**Burst traffic:** ~500 devices at top of each hour
**Reporting window:** 6:00am–10:00pm Eastern Time
**Normal frequency:** Once per hour per device

**Preferred deployment window:** Bottom of the hour (e.g., 7:30am, 8:30am) to minimize risk during top-of-hour bursts.

⸻

Development

Lambda source:

```bash
cd lambda
npm install
npm run build
npm test
```

See `lambda/README.md` for Lambda development guide.

⸻

Query API

See `docs/API.md` for complete API documentation.

Quick example:

```bash
# Get device timeline
curl "https://<api-url>/device/<deviceId>/timeline?hours=24" \
  -H "x-particle-webhook-secret: <secret>"

# Get device health
curl "https://<api-url>/device/<deviceId>/health?hours=24" \
  -H "x-particle-webhook-secret: <secret>"
```

⸻

Deploy

```bash
cd infra
npm install
cdk deploy
```

Preferred deployment: bottom of the hour to avoid top-of-hour burst traffic.

⸻

Tail Lambda Logs

AWS_PROFILE=particle-admin aws logs tail "/aws/lambda/InfraStack-ParticleLogIngestionFunctionD5193211-ckpMn4aFdjbe" --region us-east-1 --follow

⸻

Query DynamoDB

AWS_PROFILE=particle-admin aws dynamodb query \
  --table-name InfraStack-ParticleLogEventsTableF654D709-OMOORL9AXLQM \
  --key-condition-expression "deviceId = :d" \
  --expression-attribute-values '{":d":{"S":"DEVICE_ID"}}'

⸻

Inspect Device Timeline

Local read-only tool for device event inspection:

```bash
cd scripts
npm install
npm run timeline -- --deviceId <deviceId> --hours 24
```

**Features:**
- Query device timeline by deviceId
- Time-range filtering (hours, start/end)
- Display chronological events
- Fetch raw S3 event data
- **Analytics summary mode** (gaps, bursts, anomalies, performance)
- **Health diagnostics mode** (battery, connection time, resets, alerts, temperature)
- **Event correlation mode** (identify patterns and causal relationships across event types)
- Read-only (no AWS modification)

**Quick examples:**
```bash
# Last 24 hours
npm run timeline -- --deviceId e00fce68e4fa8ab3f8faa207 --hours 24

# With analytics summary
npm run timeline -- --deviceId e00fce68e4fa8ab3f8faa207 --hours 24 --summary

# With health diagnostics
npm run timeline -- --deviceId e00fce68e4fa8ab3f8faa207 --hours 24 --health

# With event correlation
npm run timeline -- --deviceId e00fce68e4fa8ab3f8faa207 --hours 24 --correlate

# Specific time range
npm run timeline -- --deviceId e00fce68e4fa8ab3f8faa207 \
  --start 2026-06-26T00:00:00Z --end 2026-06-26T23:59:59Z

# With raw S3 data
npm run timeline -- --deviceId e00fce68e4fa8ab3f8faa207 --hours 24 --show-raw
```

See `docs/tools.md` and `scripts/README.md` for complete documentation.

⸻

Current State

Working:

✓ webhook ingestion
✓ watchdog/status ingestion
✓ serial forwarder ingestion
✓ S3 storage
✓ DynamoDB indexing
✓ device timeline reconstruction
✓ modular Lambda architecture
✓ unit test coverage

Next:

* Phase 2: schema normalization (canonical event envelope)
* Phase 2: event enrichment (severity, reset cause, network state)
* log parsing
* event correlation
* AI diagnostics