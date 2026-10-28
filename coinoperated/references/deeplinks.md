# CoinOperated agent deeplinks

Canonical public URL (skills emit this shape):

```text
https://coinoperated.finance/agent/link?accountAddress=0x…&name=MyClaudeBot
```

| Query param | Required | Maps to | Notes |
|-------------|----------|---------|--------|
| `accountAddress` | yes | Additional signer EVM address | 20-byte `0x` hex; EIP-55 checksum preferred |
| `name` | no | API `label` | Trim; max 64 characters; URL-encode |

## Behavior

1. `/agent/link` **307-redirects** to `/app/agent/link` with the same query string.
2. Unauthenticated users hitting `/app/agent/link` are sent to `/app?returnTo=/app/agent/link?…`, complete SIWE, then return.
3. The authenticated page asks the owner to confirm adding the address (skipped if already an additional signer), then opens Add Delegation so they can sign a periodic Arc USDC grant.

Local development: use the same path on the app origin (e.g. `http://localhost:3200/agent/link?…`).
