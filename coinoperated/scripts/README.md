# CoinOperated example scripts

## `arc-usdc-transfer.mjs`

Runnable Path **D2** example: agent-wallet signing + public-relayer estimate/send on Arc.

```bash
# From repo: skills/coinoperated/scripts
# Requires sibling skills/agent-wallet/scripts with npm install

# Direct: user asked to send $1 to a recipient
node arc-usdc-transfer.mjs --parent ./parent.json --to 0xRecipient… --amount 1 --max-fee 0.05

# Pull: fund the agent wallet for later trading
node arc-usdc-transfer.mjs --parent ./parent.json --amount 5
```

Working directory: this `scripts/` folder (or any cwd if `--parent` is absolute).  
`aw.mjs` is resolved from `../../agent-wallet/scripts/aw.mjs` or `AGENT_WALLET_AW`.

See [../references/spend-paths.md](../references/spend-paths.md) for when to use direct vs pull.
