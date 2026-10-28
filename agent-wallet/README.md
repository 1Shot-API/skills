# agent-wallet

Agent skill: local EOA via Foundry encrypted keystores + non-interactive Node CLI (`scripts/aw.mjs`). Sign messages/txs and build EIP-7710 delegations without printing private keys into chat.

## Install (Cursor / agentskills)

```bash
npx skills add 1Shot-API/skills/agent-wallet -g -a cursor -y
```

Then:

1. Install [Foundry](https://getfoundry.sh) (`foundryup`) so `cast` is on `PATH`.
2. `cd` into the installed skill’s `scripts/` directory and run `npm install` (EIP-7710 deps).
3. `node scripts/aw.mjs doctor` then `node scripts/aw.mjs create`.

## Layout

```text
agent-wallet/
  SKILL.md
  README.md
  scripts/
    aw.mjs
    package.json
    lib/
  references/
```

## License

MIT — see skill frontmatter.
