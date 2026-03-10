# x402 Facilitator

Use this guide when integrating x402 payments with 1Shot API: provisioning, token setup, and facilitator configuration in a TypeScript/Node service compatible with the Coinbase x402 npm suite.

## Prerequisites

1. **Server wallet** — Provision a server wallet on the target EVM network (see [server-wallets.md](server-wallets.md)). Deposit sufficient gas into the server wallet to cover payment transaction costs; the 1Shot API gas station can convert USDC into gas on supported chains.
2. **EIP-3009 token** — Import an EIP-3009 compatible token (exposes `transferWithAuthorization`) into your 1Shot API account. In the 1Shot Prompts directory, filter by the x402 category, open the token, then under "Write Functions" select `transferWithAuthorization` and click "Add to My Contract Methods", or use "Create Contract Methods for All Functions".
   - **Signature / ABI compatibility** — EIP-3009 defines `transferWithAuthorization` with a signature as separate `v`, `r`, and `s` parameters. Some tokens (e.g. USDC) also expose an overload that takes a single signature bytes string. 1Shot API requires the **v, r, s** form to be present in the token’s contract ABI. The x402 `/verify` and `/settle` endpoints accept the signature in the format specified by the x402 standard; 1Shot API splits that signature into v, r, and s and calls `transferWithAuthorization` accordingly. This allows support for tokens such as PYUSD.

## Install

```bash
npm install @1shotapi/x402-facilitator
```

## Package exports

- **facilitator** — A `FacilitatorConfig` object that reads 1Shot API credentials from environment variables (for use with x402 middleware).
- **createFacilitatorConfig(apiKey, apiSecret)** — Builds a `FacilitatorConfig` from explicit credentials.

## Environment contract

| Variable | Required | Purpose |
|----------|----------|---------|
| `ONESHOT_API_KEY` | Yes | API key from 1Shot API business account |
| `ONESHOT_API_SECRET` | Yes | API secret from 1Shot API business account |

Optional: if the package supports a custom base URL, use `ONESHOT_API_BASE_URL` when provided in the package docs.

## Minimal Express example

```ts
import { config } from "dotenv";
import express from "express";
import { paymentMiddleware } from "x402-express";
import { createFacilitatorConfig } from "@1shotapi/x402-facilitator";

config();

const payTo = process.env.PAY_TO_ADDRESS!; // recipient of x402 payments

const facilitatorConfig = createFacilitatorConfig(
  process.env.ONESHOT_API_KEY!,
  process.env.ONESHOT_API_SECRET!,
);

// Or use env implicitly: import { facilitator } from "@1shotapi/x402-facilitator";
// const facilitatorConfig = facilitator;

const app = express();

app.use(
  paymentMiddleware(
    payTo,
    {
      "GET /weather": {
        price: "$0.001",
        network: "base-sepolia", // or "base" for mainnet
        config: {
          description: "Access to weather data",
          mimeType: "application/json",
        },
      },
      "GET /premium": {
        price: "$0.01",
        network: "base-sepolia",
        config: {
          description: "Access to premium content",
          mimeType: "application/json",
        },
      },
    },
    facilitatorConfig,
  ),
);

app.get("/weather", (req, res) => res.json({ temp: 72 }));
app.get("/premium", (req, res) => res.json({ content: "premium" }));

app.listen(3000);
```

## Recommended bootstrap (facilitator module)

1. **Dedicated module** — Create a `facilitator` module that owns config and health checks; keep it separate from business logic.
2. **Load env at startup** — Load `ONESHOT_API_KEY` and `ONESHOT_API_SECRET` at startup; fail fast if missing when facilitator is required.
3. **Health-check** — Implement a function that verifies connectivity and auth (e.g. a lightweight API call or readiness endpoint).
4. **Single entry** — Expose one initialization: `initializeFacilitator(config): Promise<void>` that validates config, performs the health-check, and throws on failure so the process does not start in an invalid state.

## Integration pattern

- Keep facilitator wiring (env, `createFacilitatorConfig`, `paymentMiddleware`) separate from route handlers and business logic.
- Surface startup-time failures immediately; do not defer facilitator errors to first request.
- For transient boot failures (e.g. network), retry with bounded backoff and then fail closed.

## Operational checks

- **Logging** — Log facilitator identifier and environment (e.g. network name) at startup; never log secrets.
- **Readiness probe** — If running as a service, expose a readiness endpoint that depends on facilitator setup being verified (e.g. health-check passed).
- **Fail closed** — When facilitator setup cannot be verified, do not start the server or accept paid routes.

## Config contract (implementation)

Use the following in code and env docs:

- `ONESHOT_API_KEY` — API key from 1Shot API business account.
- `ONESHOT_API_SECRET` — API secret from 1Shot API business account.
- `ONESHOT_API_BASE_URL` — Optional; use only if the package supports a custom base URL.

## Validation

- Ensure `ONESHOT_API_KEY` and `ONESHOT_API_SECRET` are set before starting the app when using the facilitator.
- Call the health-check (or hit the readiness probe) after startup to confirm facilitator connectivity and auth.
- Test a paid route (e.g. `GET /weather`) with a client that sends a valid x402 payment to confirm end-to-end flow.
