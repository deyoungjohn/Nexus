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
  docs/specifications/0007-web-workflow.md
  docs/decisions/0021-fixture-web-boundary.md
  migrations/0001_ledger.sql
  migrations/0002_coordinator.sql
  migrations/0007_recovery_worker.sql
  config/bsc-recovery.json
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
  docs/integrations/2026-09-30-full-token-security.md
  docs/integrations/2026-09-30-full-token-security.json
  migrations/0008_eoa_execution_reviews.sql
  src/market-gate/bstocks-route.ts
  src/execution/signing-payload.ts
  src/application/execution.ts
  test/bstocks-route.test.ts
  test/execution-wallet.test.ts
  web/components/execution-panel.tsx
  web/lib/execution-wallet.ts
  web/server/execution.ts
  web/app/api/execution/route.ts
  web/e2e/execution.spec.ts
  docs/decisions/0030-bstocks-route-and-web-approval.md
  docs/decisions/0031-owner-only-bstocks-pilot.md
  docs/runbooks/owner-pilot.md
  docs/runbooks/eoa-pilot-runner.md
  docs/decisions/0032-supervised-eoa-acceptance-runner.md
  scripts/test-eoa-pilot.sh
  src/pilot/runner-cli.ts
  src/pilot/runner-input.ts
  src/pilot/runner-evidence.ts
  src/pilot/runner-runtime.ts
  src/pilot/runner-services.ts
  src/pilot/runner-trade.ts
  src/pilot/runner-allowance.ts
  test/pilot-runner.test.ts
  docs/SENIOR_ENGINEER_FOLLOWUP.md
  docs/integrations/2026-10-02-owner-pilot-sources.md
  docs/integrations/2026-10-02-owner-pilot-sources.json
  docs/0031-amendment-1-pilot-evidence-rules.md
  docs/response002.md
  migrations/0010_pilot_evidence.sql
  src/pilot/prospectus-register.ts
  src/pilot/quantity.ts
  src/pilot/price-integrity.ts
  src/pilot/price-journal.ts
  src/execution/allowance-proof.ts
  src/execution/reanchor-evidence.ts
  src/execution/reanchor.ts
  test/pilot-amendment.test.ts
  test/pilot-recovery.test.ts
  test/reanchor.test.ts
  web/lib/reanchor-wallet.ts
  web/components/reanchor-panel.tsx
  web/server/reanchor.ts
  web/app/api/reanchor/route.ts
  migrations/0009_chain_snapshots.sql
  src/execution/chain-bootstrap.ts
  src/execution/nonce-history.ts
  src/pilot/profile.ts
  src/pilot/manual-records.ts
  src/pilot/allowance.ts
  src/pilot/round-trip.ts
  src/pilot/planning.ts
  src/pilot/private-output.ts
  src/pilot/inspect-cli.ts
  src/pilot/records-cli.ts
  src/pilot/price-monitor.ts
  src/pilot/price-monitor-cli.ts
  test/pilot.test.ts
  test/pilot-manual-records.test.ts
  test/pilot-private-output.test.ts
  test/pilot-price-monitor.test.ts
  test/pilot-round-trip.test.ts
  test/chain-bootstrap.test.ts
  web/components/pilot-panel.tsx
  web/lib/chain-snapshot-wallet.ts
  web/server/chain-snapshot.ts
  web/server/pilot-plan.ts
  web/app/api/chain-snapshot/route.ts
  web/app/api/pilot-plan/route.ts
  docs/integrations/2026-10-01-bstocks-route-adapter.md
  docs/integrations/2026-10-01-bstocks-route-adapter.json
  src/execution/production.ts
  src/execution/bstocks-runtime.ts
  src/execution/bsc-execution-chain.ts
  src/execution/execution-json.ts
  src/execution/market-revalidation.ts
  src/market-gate/bstocks-production.ts
  test/production-execution.test.ts
  test/production-execution-fixture.ts
  docs/decisions/0029-production-eoa-evidence-orchestration.md
  docs/runbooks/eoa-execution.md
  src/execution/recovery-worker.ts
  src/execution/recovery-contracts.ts
  docs/integrations/2026-09-30-token-recovery-semantics.md
  docs/integrations/2026-09-30-token-recovery-semantics.json
  docs/decisions/0025-reviewed-bsc-raw-transfer-recovery.md
  docs/decisions/0024-production-recovery-worker.md
  docs/runbooks/bsc-recovery-worker.md
  package.json
  package-lock.json
  tsconfig.json
  tsconfig.test.json
  test/run.ts
  web/app/page.tsx
  web/lib/workflow.ts
  web/tsconfig.json
  web/e2e/workflow.spec.ts
  playwright.config.ts
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

bash -n scripts/check.sh scripts/memory-mcp.sh scripts/test-eoa-pilot.sh

node -e '
  const fs = require("fs");
  for (const file of [".mcp.json", ".agents/mcp_config.json", "opencode.json", "config/bsc-recovery.json", "config/token-security-reviews.json"]) {
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
  npm run web:build --if-present
fi

echo "All configured project checks passed."
