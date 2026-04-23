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

### `webauthn-prf-wallet`

Guides a coding agent in implementing an **iframe-isolated, passkey-derived Ethereum wallet** using the WebAuthn PRF extension. The private key is deterministically derived from a user's passkey, lives only inside a same-origin isolated iframe (so the parent page's JavaScript can never read it), and the server never sees the key or anything derived from it. Includes a LongBlob + recovery-phrase fallback for platforms that don't support PRF.

```bash
npx skills add 1Shot-API/skills/webauthn-prf-wallet
```

Example prompts that trigger this skill:

- "Add a passkey-based Ethereum wallet to my Next.js app."
- "Derive a private key from a WebAuthn credential using the PRF extension."
- "I want a non-custodial wallet that doesn't require a seed phrase."
- "Check if the browser supports WebAuthn PRF before letting the user register."

Contents:

- PRF output → secp256k1 key derivation (HKDF-SHA-256, range-validated)
- Browser/OS/webview platform-support gating
- Iframe isolation via Postmate RPC, including the `display:none` / user-activation gotchas
- LongBlob (`credBlob` / `largeBlob`) and AES-encrypted recovery-phrase fallback
- Framework-agnostic server integration (WebAuthn RP endpoints, challenge storage)
- Concrete Next.js App Router walkthrough
- Copy-ready TypeScript assets: `prfToValidEthPrivKey.ts`, `platformSupport.ts`, `WalletIframeSketch.ts`

## TODOs

- execution simulation for batch and delegated transactions
- gasLimit for `execute`
- re-fork x402 and create new facilitator client
- update client-sdk patterns in 1shotpay readme
- block range limit for event reads
