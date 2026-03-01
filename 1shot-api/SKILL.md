---
name: 1shot-api
description: Build TypeScript applications with the 1Shot API Node SDK for onchain reads, transaction execution, delegations, and payments. Use when the user asks about 1Shot API, server wallets, smart contract reads/writes, delegated execution, x402 facilitator setup, or 1ShotPay integration.
---

# 1Shot API

Use this skill when building a TypeScript project on top of the 1Shot API Node SDK.

## Quick Start

1. Confirm the user goal:
   - server wallet management
   - smart contract read/simulate/event workflows
   - direct or delegated transaction execution
   - webhook setup
   - x402 facilitator setup
   - 1ShotPay integration
2. Pick the matching reference guide from this skill.
3. Generate production-ready TypeScript examples unless the guide says otherwise.
4. Prefer explicit, copy-pastable code with clear env vars and minimal placeholders.

## Required Working Style

- Use TypeScript-first examples.
- Keep implementation split into small functions rather than large scripts.
- Surface security constraints early (keys, signatures, replay protection, verification).
- If an endpoint detail is unknown, state assumptions and mark TODOs clearly.
- When the user asks to scaffold code, include:
  - dependency list
  - environment variable contract
  - typed function signatures
  - basic error handling and retries

## Guides

- Server wallets: see [server-wallets.md](server-wallets.md)
- Smart contracts: see [smart-contracts.md](smart-contracts.md)
- Transaction execution: see [transaction-execution.md](transaction-execution.md)
- Webhooks (dummy draft): see [webhooks-dummy.md](webhooks-dummy.md)
- x402 facilitator: see [x402-facilitator.md](x402-facilitator.md)
- 1ShotPay integration: see [oneshotpay-integration.md](oneshotpay-integration.md)

## Response Template

Use this structure when answering implementation requests:

```markdown
## Plan
- Concise list of implementation steps.

## Code
- Minimal but complete TypeScript snippets.

## Config
- Required environment variables and expected formats.

## Validation
- Quick checks or tests to verify behavior.

## Risks / TODOs
- Any assumptions, unknown endpoint details, and follow-up work.
```
