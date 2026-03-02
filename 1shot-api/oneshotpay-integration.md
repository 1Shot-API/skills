# 1ShotPay Integration

Implement client and server integration paths:

- client-side one-time payments (`x402Fetch`, `get3009Signature`)
- client-side subscription payments
- server-side paylinks
- MCP capabilities (agent wallets, paylink generation)

## Client-Side Workflow

1. Create a `paymentsClient` module.
2. Add one-time payment helpers:
   - `payOnceWithX402Fetch(...)`
   - `get3009SignatureForPayment(...)`
3. Add subscription helper:
   - `createSubscriptionPayment(...)`
4. Return typed status objects so UI can render pending/success/failure.

## Server-Side Workflow

1. Create a `paylinksService` module.
2. Add:
   - `createPaylink(input)`
   - `listPaylinks(filter?)`
   - `disablePaylink(id)`
3. Validate amount/currency/network before creating links.

## MCP Capability Guidance

When using 1ShotPay MCP capabilities:

- **Agent wallets**: provide explicit wallet ownership and scope constraints.
- **Generate paylinks**: include metadata for traceability (user ID, purpose, correlation ID).

## Security Notes

- Never expose server credentials to client bundles.
- Treat payment signatures as sensitive and short-lived.
- Validate callback and redirect URLs against an allowlist.

## Draft Interfaces

```ts
export interface Paylink {
  id: string;
  url: string;
  amount: string;
  currency: string;
  network?: string;
  active: boolean;
}
```
