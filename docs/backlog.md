# Backlog

## Direction

Current initiative: Fleet Operations Platform – Phase 4B.

Telemetry is now considered an input into a larger Fleet Operations Platform, not the platform's endpoint.

## North Star

When a device behaves unexpectedly—or when deploying or configuring a new device—the first response should be to use the Fleet Operations Platform, not connect a USB cable or open the AWS Console.

## Platform Responsibilities

- Firmware: authoritative device behavior, reliable execution, minimal structured telemetry, no operational policy.
- Particle Cloud: fleet membership, software delivery, Ledgers, cloud connectivity, device identity.
- Fleet Operations Platform: immutable history, current-state projections, derived operational insight, fleet health, onboarding projection, configuration management, operational workflows.
- CLI: primary operator interface for fleet visibility, diagnostics, monitoring, configuration, and onboarding.
- Web Console (future): browser-based Fleet Operations Center using the same backend and APIs as CLI, with no duplicate business logic.

## Operating Scale

Current deployment:

- Approximately 470 deployed devices
- Six Particle products
- AWS backend
- Particle Cloud
- Ubidots

New platform features should assume multi-product operation from the beginning.

## Architectural Sequence

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

## Current

- Generalized Core Counter firmware has demonstrated excellent stability during multi-device soak testing.
- Shift emphasis from generating additional telemetry to improving fleet operations and operational insight.
- Keep Fleet Operations Platform – Phase 4B Ledger refresh deployment-ready with product-level eligibility for soak product `41915`.
- Use `./tools/telemetry` as the primary operator entry point for device inventory, current state, timeline, and watch workflows.
- Validate `watch` against firmware development and soak sessions, especially serial bursts, lifecycle `status` events, and Ledger snapshot updates.
- Keep V1 watch client-side only: Timeline API polling plus `DeviceCurrentState`, no streaming infrastructure.

## Next

- Expand soak fleet.
- Improve operational visibility.
- Improve onboarding workflow.
- Deliver Fleet Summary V1.
- Develop an evidence-based health model.
- Prepare the web operations interface.
- Deploy Phase 4B Ledger refresh configuration when ready:
  - `PARTICLE_LEDGER_REFRESH_ENABLED=true`
  - `PARTICLE_LEDGER_REFRESH_DEVICE_IDS=`
  - `PARTICLE_LEDGER_REFRESH_PRODUCT_IDS=41915`
  - `PARTICLE_LEDGER_REFRESH_EVENT_NAMES=Ubidots-Sensor-Hook-v1`
  - `PARTICLE_LEDGER_REFRESH_MIN_INTERVAL_SECONDS=60`
- Run post-deploy validation for product-level Ledger refresh using soak devices.
- Exercise `./tools/telemetry watch P2-NewCode-Dev --since 2m` during firmware build/flash cycles.
- Add optional shared terminal color highlighting for `watch` and `timeline`, respecting non-TTY output and `NO_COLOR`.
- Review whether Timeline API needs a first-class server cursor or pagination token after real watch usage.

## Future Onboarding Projection

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

## Phase 5

- Introduce a dedicated read-only query authentication model instead of reusing the webhook secret.
- Build the Fleet Operations Web Console on top of the current Timeline, Fleet, and CurrentState APIs.
- Add durable query pagination/cursors if operator workflows outgrow client-side polling windows.
- Expand fleet-level soak reporting around lifecycle events, runtime Ledger freshness, serial health, and firmware cohorts.
- Consider alerting/notification workflows after the read model and operator surfaces settle.
- Add analytics and trend reporting.

## Completed

- Extracted Lambda ingestion from inline CDK into modular TypeScript.
- Added canonical event normalization and DynamoDB timeline/query read paths.
- Added `DeviceCurrentState` projection and Fleet query endpoints.
- Implemented product-qualified `device-status` Particle Ledger refresh.
- Added Ledger refresh gating, cooldown, in-flight de-duplication, product ID caching, and structured logging.
- Added product-level Ledger refresh eligibility through `PARTICLE_LEDGER_REFRESH_PRODUCT_IDS`.
- Built the `./tools/telemetry` operator CLI for `devices`, `device`, and `timeline`.
- Unified enriched device inventory and selector resolution across CLI commands.
- Added `./tools/telemetry watch` as a client-side near-live tail.
- Added watch/timeline category terminology: `SERIAL`, `TELEMETRY`, `OCCUPANCY`, `LIFECYCLE`, `RUNTIME`, `DATA`, `EVENT`, `ERROR`.
- Documented telemetry CLI usage and watch workflows in `docs/tools.md`.
