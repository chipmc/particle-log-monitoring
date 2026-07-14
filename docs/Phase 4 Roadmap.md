

# Fleet Operations Platform – Phase 4B

Telemetry is now an input into a broader Fleet Operations Platform. Phase 4B focuses on the operational views and projections that should become the first place to look when a device behaves unexpectedly or when deploying/configuring a new device.

## North Star

When a device behaves unexpectedly—or when deploying or configuring a new device—the first response should be to use the Fleet Operations Platform, not connect a USB cable or open the AWS Console.

## Current Context

- Generalized Core Counter firmware has demonstrated excellent stability during multi-device soak testing.
- Current emphasis shifts from generating additional telemetry to improving fleet operations and operational insight.
- Current deployment scale is approximately 470 devices across six Particle products, backed by AWS, Particle Cloud, and Ubidots.
- New platform features should assume multi-product operation from the beginning.

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

## Priorities

1. Expand soak fleet
2. Improve operational visibility
3. Improve onboarding workflow
4. Fleet Summary V1
5. Evidence-based health model
6. Web operations interface

## Epic 1
### Fleet Summary V1

Single-pane view of the soak fleet, derived from existing event history, current-state projections, and Ledger freshness signals.

## Epic 2
### Health Model V1

Evidence-based health model derived from existing telemetry, lifecycle events, serial signals, and runtime Ledger state.

## Epic 3
### Onboarding Projection

Operational projection of product assignment, first cloud contact, Device OS convergence, firmware convergence, defaults synchronization, runtime status, configuration acknowledgement, first scheduled report, and READY state.

## Epic 4
### Configuration Management

Configuration model combining Product Defaults and optional Device Settings, with an acknowledgement path for applied runtime configuration.

## Epic 5
### Fleet Operations Web Console

Browser-based Fleet Operations Center using the same backend and APIs as the CLI, with no duplicate business logic.