# Fleet Operations Platform Evolution

## Purpose

This document describes the major architectural phases of the Particle Log Monitoring platform as it evolves into the Fleet Operations Platform. Telemetry remains a core input, but the platform direction has moved beyond collection toward operational visibility, onboarding, configuration, and fleet workflows.

---

# Current Status 

Current initiative: Fleet Operations Platform – Phase 4B
Status: Active planning and implementation
Repository status: Source reconciled with deployed infrastructure. The repository is now the authoritative source for both Lambda code and AWS infrastructure.

---

# Design Principles

## North Star

When a device behaves unexpectedly—or when deploying or configuring a new device—the first response should be to use the Fleet Operations Platform, not connect a USB cable or open the AWS Console.

This principle should guide future design decisions.

1. Immutable Event History
    * Every received event is archived and indexed.
    * Event history is never modified.
2. Derived Current State
    * DeviceCurrentState is a projection derived from immutable events.
    * It may always be rebuilt from event history.
3. Best-Effort Enrichment
    * External enrichments (Particle API, future integrations) must never block ingestion.
    * Core telemetry is always preserved.
4. Canonical Event Envelope
    * All producers normalize into a common schema.
    * Consumers should never depend on producer-specific formats.
5. Infrastructure as Code
    * AWS infrastructure is defined entirely in CDK.
    * The repository is the authoritative source of truth.
6. Observability First
    * Rich logging, health indicators, and diagnostics are built into every layer.

---

# Platform Responsibilities

## Firmware

- Authoritative device behavior
- Reliable execution
- Minimal structured telemetry
- No operational policy

## Particle Cloud

- Fleet membership
- Software delivery
- Ledgers
- Cloud connectivity
- Device identity

## Fleet Operations Platform

- Immutable history
- Current-state projections
- Derived operational insight
- Fleet health
- Onboarding projection
- Configuration management
- Operational workflows

## CLI

- Primary operator interface
- Fleet visibility
- Diagnostics
- Monitoring
- Configuration
- Onboarding

## Web Console (Future)

- Browser-based Fleet Operations Center
- Same backend and APIs as CLI
- No duplicate business logic

---

# Operating Scale

Current deployment:

- Approximately 470 deployed devices
- Six Particle products
- AWS backend
- Particle Cloud
- Ubidots

New platform features should assume multi-product operation from the beginning.

---

# Architectural Sequence

```text
Signal inventory
↓
State models
↓
Fleet Summary V1
↓
Onboarding Projection
↓
Configuration Acknowledgement Model
↓
Fleet Operations Web Console
```

---

# Current Priorities

Generalized Core Counter firmware has demonstrated excellent stability during multi-device soak testing. Current emphasis shifts from generating additional telemetry to improving fleet operations and operational insight.

Priorities:

1. Expand soak fleet
2. Improve operational visibility
3. Improve onboarding workflow
4. Fleet Summary V1
5. Evidence-based health model
6. Web operations interface

---

# Future Onboarding Projection

```text
Product Assignment
↓
First Cloud Contact
↓
Device OS Convergence
↓
Firmware Convergence
↓
Product Defaults Synchronization
↓
Runtime Status
↓
Device Settings (optional)
↓
Configuration Acknowledgement
↓
First Scheduled Report
↓
READY
```

This is an operational projection derived from existing evidence rather than a firmware state machine.

---- 

# Phase 0 – Log Collection

## Objective

Capture Particle webhook events reliably for later analysis.

## Architecture

Particle Webhook
        │
        ▼
API Gateway
        │
        ▼
Lambda
        │
        ├── Raw Logs (S3)
        └── Event History (DynamoDB)

## Major Capabilities

- Secure webhook ingestion
- Raw event archival
- Immutable event history
- Replay capability

---

# Phase 1 – Event Normalization

## Objective

Convert heterogeneous Particle events into a canonical event model.

## Added Components

- Canonical Event Envelope
- Event classification
- Severity normalization
- Device/project identification
- Serial log parsing

## Major Capabilities

- Uniform event model
- Consistent API contracts
- Easier analytics

---

# Phase 2 – Device Intelligence

## Objective

Provide historical device diagnostics and querying.

## Added Components

- Timeline API
- Health API
- Summary API
- Anomaly API

## Major Capabilities

- Device timelines
- Historical health
- Event correlation
- Diagnostic APIs

---

# Phase 3 – Fleet Intelligence

## Objective

Transform historical telemetry into real-time fleet state.

## Added Components

- DeviceCurrentState table
- Current-state projection
- Fleet Summary API
- Fleet Offline API
- Fleet Anomalies API
- Particle API device-name enrichment

## Major Capabilities

- Live fleet state
- Fleet-wide health
- Offline detection foundation
- Device name resolution
- Operational REST APIs
- Full CDK-managed infrastructure
- Complete unit test coverage
- Source repository reconciled with deployed infrastructure

## Deliverables

- DeviceCurrentState projection
- Fleet REST endpoints
- Phase 3 parser
- Current-state storage
- Infrastructure parity
- 68 automated tests
- Reproducible deployment from source

---

# Phase 4B – Fleet Operations Platform (Current)

## Objective

Provide operational visibility and proactive fleet management across multiple Particle products.

### Planned Capabilities

- Fleet dashboard
- Confidence score
- Incident detection
- Advanced offline engine
- Event correlation
- Alerting
- Historical trends
- Fleet analytics

---

# Phase 5 – Fleet Operations Web Console

## Objective

Provide a browser-based Fleet Operations Center using the same backend and APIs as the CLI, without duplicating business logic.

## Implementation Roadmap

1. Fleet Summary V1: single-pane view of the soak fleet
2. Health model V1: derived from existing evidence
3. Onboarding projection: track product migration progress
4. Configuration management: merged Product Defaults and Device Settings
5. Fleet Operations Web Console
6. Analytics and trend reporting


# Summary

Phase                           Theme                   Primary Outcome

Phase 0                         Data Collection         Reliable ingestion and archival

Phase 1                         Normalization           Canonical event model

Phase 2                         Device Intelligence     Historical diagnostics and APIs

Phase 3                         Fleet Intelligence      Real-time fleet state and operational APIs

Phase 4B                        Fleet Operations Platform Multi-product operations, onboarding, configuration, fleet workflows

Phase 5                         Web Operations Center   Browser-based operations console and analytics