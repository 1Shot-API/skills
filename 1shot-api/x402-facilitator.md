# x402 Facilitator

Implement setup guidance for the 1Shot API facilitator path.

## Objective

Help the user bootstrap facilitator configuration in a TypeScript service with clear environment contracts and startup checks.

## Recommended Steps

1. Create a dedicated `facilitator` module.
2. Load required environment variables at startup.
3. Build a health-check function that verifies connectivity and auth.
4. Expose one initialization function:
   - `initializeFacilitator(config): Promise<void>`

## Config Contract (Draft)

Use these placeholders until exact names are finalized:

- `ONESHOT_API_BASE_URL`
- `ONESHOT_API_KEY`
- `ONESHOT_FACILITATOR_ID`
- `ONESHOT_FACILITATOR_SECRET`

## Integration Pattern

- Keep facilitator wiring separate from business logic.
- Surface startup-time failures immediately.
- Retry transient boot errors with bounded backoff.

## Operational Checks

- Log facilitator ID and environment (never secrets).
- Expose a readiness probe if running as a service.
- Fail closed when facilitator setup cannot be verified.
