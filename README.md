# skills

A collection of Agent Skills published by [1Shot API](https://1shotapi.com/) for coding agents (Cursor, Claude, etc.) to build onchain applications. Each skill lives in its own folder and can be installed independently.

## Installing skills

Install an individual skill from this repository with [`skills`](https://www.npmjs.com/package/skills):

```bash
npx skills add 1Shot-API/skills/<skill-name>
```

To update all installed skills to the latest version after new releases:

```bash
npx skills update
```

(Re-run `npx skills add ...` to refresh a specific skill only.)

## Skills in this repo

### `1shot-api`

Guides a coding agent in building a TypeScript project that leverages the [1Shot API Node SDK](https://github.com/1Shot-API/1Shot-API-SDK/tree/main/clients/node) for onchain reads, transaction management, delegations, and payments. 1Shot API has native support for the [MetaMask Delegation Framework](https://github.com/MetaMask/delegation-framework), enabling transactions that meet specific requirements to be executed on a user's behalf even when they are not online.

```bash
npx skills add 1Shot-API/skills/1shot-api
```

Example prompts that trigger this skill:

- "Set up server wallet creation and listing with the 1Shot API Node SDK."
- "Simulate a smart contract write and query indexed events."
- "Implement delegated batch transaction execution using stored delegations."

Contents:

1. Server Wallets Skill
    - list available EVM networks
    - create server wallet
    - list server wallets
    - update server wallet metadata
    - get signatures from server wallets
        - EIP-3009
        - permit2
            - authorize permit2
    - delegations
        - Metamask Smart Accounts Kit
        - create delegation (store in 1Shot API)
        - list stored delegations
        - redelegate from server wallet
            - from stored delegation
            - from provided delegation
2. Smart Contracts Skill
    - search smart contracts
    - Assure methods associated w/ smart contract
    - functions
        - listing imported functions
        - update imported function details
        - reading from read functions
        - simulating write functions
        - estimating gas cost
    - events
        - listing imported events
        - update imported event details
        - querying events w/ indexed arguments
3. Implementing Transaction Execution Skill
    - single execute
    - batch execute
    - delegated single execute
    - delegated batch execute
4. Implementing Webhooks Skill (api not ready yet)
    - Create a webhook
        - endpoint
        - triggers
        - public key & sig verification
    - update a webhook
    - delete a webhook
5. x402 Facilitator Skill
    - setting up the 1Shot API facilitator
6. 1ShotPay Integration Skill
    - client-side integration
        - one-time payments
            - x402Fetch
            - get3009Signature
        - subscription payments
    - Server-side integration
        - paylinks
    - 1ShotPay MCP capabilities
        - agent wallets
        - generate paylinks

### `1shot-wallet`

Guides a coding agent in embedding the **1Shot Wallet** from a Host Layer app using `@1shotapi/ows-provider`. The hosted Branding Layer at `wallet.1shotapi.com` handles passkey onboarding, signing consent, and credentials — your app wires `OWSProxy`, EIP-1193, and optional `configure` theming without building a wallet from scratch.

```bash
npx skills add 1Shot-API/skills/1shot-wallet
```

Example prompts that trigger this skill:

- "Embed wallet.1shotapi.com in my React app with OWSProxy."
- "Theme the 1Shot embedded wallet with configure (product name and primary color)."
- "Wire eth_requestAccounts from my dapp through the 1Shot wallet iframe."
- "Add OID4 credential offer/present flows to my host app via OWS credentials RPC."

Contents:

- OWS three-layer model (Host → Branding → Signing)
- `OWSProxy.create`, `showWallet` / `hideWallet`, and EIP-1193 `request`
- `configure` theming and copy overrides (Zod-validated partial merge)
- `focusWallet` / `unfocusWallet`, `addAsset`, and `createAccount` custom RPC
- Safari `/create/` first-party passkey handoff
- `proxy.analytics` product events and EIP-1193 `chainChanged` / `accountsChanged` subscriptions
- Credentials RPC when enabled in the wallet
- Local dev / HTTPS / secure-context notes for passkeys
- Hard rules: never embed the Signing Layer from the Host

## TODOs

- execution simulation for batch and delegated transactions
- gasLimit for `execute`
- re-fork x402 and create new facilitator client
- update client-sdk patterns in 1shotpay readme
- block range limit for event reads
