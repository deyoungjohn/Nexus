# ADR 0001: Use versioned project memory with supplementary MCP recall

- Status: accepted
- Date: 2026-09-22
- Owners: project owner and Codex

## Context

The project must support handoffs among different coding agents, retain useful
context across sessions, explain every material change, and minimize regressions.
The owner prefers not to install Docker or redirect native model subscriptions
through an LLM proxy.

## Decision

Use Git-tracked instructions, project state, specifications, decision records,
and a change ledger as the authoritative memory. Add the official MCP reference
memory server as a local, project-scoped recall aid. All clients point to the
same per-project JSONL file through `scripts/memory-mcp.sh`.

## Consequences

- Agents retain their native authentication and subscriptions.
- Project history remains reviewable even if MCP memory is unavailable.
- Agents must deliberately maintain the versioned documents.
- Concurrent MCP writers are unsupported, so agent sessions using the shared
  memory must run sequentially.
- Tests and CI remain responsible for regression detection.

## Alternatives considered

- Full TencentDB Agent Memory: deferred because its supported turnkey deployment
  uses Docker and its proxy changes model routing and billing.
- Native TencentDB MemoryCore: deferred because cross-client capture requires
  custom adapters and a separate LLM API key.
- Per-agent built-in memory: rejected as the shared source because it is not
  portable between agent products.

## Verification

Validate that each configured client can list the `project-memory` tools, write a
non-secret test observation, and retrieve it in a later session. Continue to run
`./scripts/check.sh` for repository-level verification.
