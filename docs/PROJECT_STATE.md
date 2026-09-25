# Project state

Last updated: 2026-09-23

## Objective

Not yet defined. Requirements will be established with the user before implementation.

## Current status

- Cross-agent workspace initialized.
- Application implementation has not started.
- Product requirements remain to be defined.

## Architecture

- Language and framework: To be selected based on project requirements
- Build tooling: To be selected
- Test framework: To be selected

## Required verification

Run:

```bash
./scripts/check.sh
```

Extend that script when the project stack is chosen. It must remain the single
entry point for all required checks.

## Known limitations

- The local MCP memory package should not be written by multiple agent processes
  concurrently. Close one agent and its MCP process before opening the next.
- MCP memory is supplementary and does not replace tests, Git history, decision
  records, specifications, or the change ledger.
