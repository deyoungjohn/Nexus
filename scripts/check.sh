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
  scripts/inspect-bstocks-governance.mjs
  scripts/inspect-bstocks-governance.test.mjs
  scripts/verify-bstocks-governance-sources.mjs
  docs/decisions/0027-local-source-recovery-governance-evidence.md
  docs/integrations/2026-10-01-bstocks-governance.md
  docs/integrations/2026-10-01-bstocks-governance.json
  docs/research/bstocks-governance/README.md
  docs/research/bstocks-governance/LICENSE.OpenZeppelin
  docs/research/bstocks-governance/beacon-standard-input.json
  docs/research/bstocks-governance/source-rebuilds.json
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
  config/token-security-reviews.json
  src/security/token-security.ts
  src/security/bsc-token-security.ts
  src/security/token-security-cli.ts
  src/security/reviewed-source-pins.ts
  src/security/bstocks-governance.ts
  src/security/review-publishers.ts
  src/security/review-artifact.ts
  test/security-collector.test.ts
  test/security-collector-fixture.ts
  docs/decisions/0028-source-governance-and-independent-review-intake.md
  docs/integrations/2026-10-01-security-collector.md
  docs/integrations/2026-10-01-security-collector.json
  docs/decisions/0026-full-token-security-evidence.md
  docs/specifications/0008-token-security.md
  docs/runbooks/token-security.md
  migrations/0003_eoa_execution.sql
  migrations/0004_eoa_receipt_effects.sql
  migrations/0006_web_sessions.sql
  migrations/0007_recovery_worker.sql
  migrations/0008_eoa_execution_reviews.sql
  src/application/session.ts
  src/execution/production.ts
  src/execution/bstocks-runtime.ts
  src/execution/bsc-execution-chain.ts
  src/execution/execution-json.ts
  src/execution/market-revalidation.ts
  src/execution/recovery-worker.ts
  src/execution/recovery-contracts.ts
  src/market-gate/bstocks-access.ts
  src/market-gate/bstocks-production.ts
  config/bsc-recovery.json
  test/production-execution.test.ts
  test/production-execution-fixture.ts
  docs/decisions/0029-production-eoa-evidence-orchestration.md
  docs/runbooks/eoa-execution.md
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
  node --test scripts/inspect-bstocks-governance.test.mjs
  npm run lint --if-present
  npm run typecheck --if-present
  npm run build --if-present
fi

echo "All configured project checks passed."
