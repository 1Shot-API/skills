# 1Shot skills — AGENTS.md

This repository is the **canonical source** for first-party 1Shot Agent Skills. Product repos (CoinOperated, embedded-wallet, relayer, …) point here and never vendor these skills; developers install them at user level with `npx skills add 1Shot-API/skills/<skill> -g -a claude-code -y` (`~/.claude/skills` is read by both Claude Code and Cursor).

## Layout

- One skill per top-level folder: `<skill>/SKILL.md` (required) plus optional `references/`, `scripts/`, `assets/`, `README.md`.
- `SKILL.md` starts with YAML frontmatter (`name`, `description`, `license`, `metadata.version`, `metadata.repository`). The `description` is what triggers the skill, so keep it specific to the task the skill solves.
- Keep `SKILL.md` short and procedural; move long schemas, examples, and background into `references/*.md` and link to them.
- Scripts must be non-interactive, print JSON to stdout, and never print secrets (see `agent-wallet/references/security.md`).

## Conventions

- Install snippets use `-g -a claude-code -y`. Do not reintroduce `-a cursor` or `~/.cursor/skills` paths (the `coinoperated` script keeps `~/.cursor/skills` only as a lookup fallback for older installs).
- When a product surface changes (1Shot API SDK, embedded wallet Host RPC / EIP-1193, public-relayer JSON-RPC, CoinOperated REST API), update the matching skill here in the same effort and bump `metadata.version`.
- After editing `coinoperated`, `agent-wallet`, or `public-relayer`, regenerate the hosted discovery archives from the CoinOperated repo (`yarn skills:sync-discovery`) and commit them there.
- `skills-lock.json` tracks the project-installed `skill-creator` helper only; `.claude/`, `.cursor/`, and `.agents/` are gitignored so local installs are never committed.

## Agent Tooling (Claude Code + Cursor)

- `AGENTS.md` is the single source of truth. Cursor reads it natively; `CLAUDE.md` just imports it (`@AGENTS.md`). Do not add `.cursorrules`, `.cursor/rules`, or Claude-only guidance elsewhere.
- There are no project skills, hooks, or MCP servers configured for this repo.
