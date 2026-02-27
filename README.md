# skills
Skeleton outline of 1Shot API skills

1. Server Wallets
    - create server wallet
    - list server wallets
    - update server wallet metadata
    - get signatures from server wallets
        - EIP-3009
        - permit2
            - authorize permit2
    - delegations
        - create delegation
        - list delegations
        - redelegate
            - from stored
            - from provided
2. Smart Contracts
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
3. Executing Transactions
    - single execute
    - delegated single execute
    - batch execute
    - delegated batch execute
4. Webhooks
    - Create a webhook
        - endpoint
        - triggers
        - public key & sig verification
    - update a webhook
    - delete a webhook
5. x402
    - facilitator
6. 1ShotPay
    - client-side integration
        - one-time payments
            - x402Fetch
            - get3009Signature
        - subscription payments
    - Server-side integration
        - paylinks
    - Agent Wallets