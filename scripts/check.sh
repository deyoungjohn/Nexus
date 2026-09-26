#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/.." && pwd)"
cd "$project_root"

required_files=(
  AGENTS.md
  CLAUDE.md
  README.md
  docs/PROJECT_STATE.md
  docs/CHANGELOG.md
  docs/IMPLEMENTATION_PLAN.md
  docs/PROJECT_LOG.md
  docs/ENGINEERING_LOG.md
  docs/integrations/2026-09-25-phase-2.md
  docs/decisions/0001-cross-agent-memory.md
  docs/decisions/0002-domain-foundation.md
  docs/decisions/0003-p2-integration-gates.md
  docs/decisions/0004-postgresql-ledger.md
  docs/decisions/0005-coordinator-sequential-bounds.md
  docs/specifications/0001-domain-foundation.md
  docs/specifications/0002-durable-ledger.md
  docs/specifications/0003-portfolio-coordinator.md
  migrations/0001_ledger.sql
  migrations/0002_coordinator.sql
  package.json
  package-lock.json
  tsconfig.json
  tsconfig.test.json
  test/run.ts
  .mcp.json
  .agents/mcp_config.json
  .codex/config.toml
  opencode.json
  docs/hermes-mcp.yaml
  scripts/memory-mcp.sh
)

for file in "${required_files[@]}"; do
  if [[ ! -s "$file" ]]; then
    echo "Missing or empty required file: $file" >&2
    exit 1
  fi
done

bash -n scripts/check.sh scripts/memory-mcp.sh

node -e '
  const fs = require("fs");
  for (const file of [".mcp.json", ".agents/mcp_config.json", "opencode.json"]) {
    JSON.parse(fs.readFileSync(file, "utf8"));
  }
'

if command -v python3 >/dev/null 2>&1; then
  python3 - <<'PY'
from pathlib import Path
import tomllib

tomllib.loads(Path(".codex/config.toml").read_text())
PY
fi

if [[ -f package.json ]]; then
  npm test --if-present
  npm run lint --if-present
  npm run typecheck --if-present
  npm run build --if-present
fi

echo "All configured project checks passed."
