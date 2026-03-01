# skills
This is a skeleton outline of 1Shot API skills. This Skill is intended to guide a coding agent in building a typescript project that leverages 1Shot API for onchain reads and transaction management. 1Shot API has native support for the [MetaMask Delegation Framework](https://github.com/MetaMask/delegation-framework) enabling transactions that meet specific requirements to be executed on a user's behalf even when they are not online. 

This skill specifically helps agents use the [1Shot API node SDK](https://github.com/1Shot-API/1Shot-API-SDK/tree/main/clients/node) for building robusted onchain applications.

## Install and use

Install this skill from your published GitHub repository with `npx skills add`:

```bash
npx skills add <github-owner>/<github-repo>/1shot-api
```

Example (replace with your actual repo path):

```bash
npx skills add your-org/skills/1shot-api
```

Use the skill by prompting your coding agent with 1Shot API tasks, for example:

- "Set up server wallet creation and listing with the 1Shot API Node SDK."
- "Simulate a smart contract write and query indexed events."
- "Implement delegated batch transaction execution using stored delegations."

This repository contains the skill at:

```text
1shot-api/
```

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