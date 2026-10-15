# Run the funded-EOA pilot

Updated 2026-10-02. P5.5e/P7.1/P7.2/P7.5/P9.4;
[ADR 0032](../decisions/0032-supervised-eoa-acceptance-runner.md).
This runner tests the accepted owner-only pilot through Nexus's actual services.
The live sequence is one exact USDT approval followed by one NVDAB buy, at most
five USDT. The buy/sell round trip runs on a local Anvil fork. A second mainnet buy
or a mainnet sale needs a separately approved scope; this runner cannot send one.

## 1. Prerequisites and private files

Use Node 22, `npm ci`, PostgreSQL and `anvil` on PATH. Existing private reviewed
recovery configuration must serve canonical balances/receipts and the historical
state required by the recovery module. No stock-market subscription or Agentic
Wallet account is needed. The free BSC feeds must be current enough; live trade
preparation still blocks outside regular NYSE hours or before a same-session NVDA
update. The script records the source clocks and block reasons automatically.

Use a dedicated intended EOA containing sufficient USDT for the configured spend
(at most 5 USDT) and BNB for approval/trade gas plus the configured native reserve.
The inspection candidate retains a 0.001-BNB reserve and a separately reviewed
gas cap. Actual required gas depends on the configured ceilings; the runner checks
real funds. No initial NVDAB holding or pending/external nonce is permitted.

Do not paste a key into chat, a command argument, the repository, an environment
variable, a screen recording or project memory. The default signing path prompts
for the key locally with terminal echo disabled. An optional existing key file must
be an absolute, symlink-free regular file outside the repository, mode 0600, with
one `0x`-prefixed 64-hex-digit key and optional trailing newline. Keep any such file
on your own protected host. A wrong key fails before any transaction signature.

Create a private directory outside the repository, such as your own home directory:

```bash
mkdir -p "$HOME/.local/state/nexus-owner-pilot"
chmod 700 "$HOME/.local/state/nexus-owner-pilot"
export NEXUS_PILOT_EVIDENCE_DIR="$HOME/.local/state/nexus-owner-pilot/evidence"
export NEXUS_EXECUTION_CONFIG="$HOME/.local/state/nexus-owner-pilot/execution.json"
export NEXUS_RECOVERY_CONFIG="$HOME/.local/state/nexus-owner-pilot/recovery.json"
export NEXUS_APP_ORIGIN="http://localhost:3000"
# Set DATABASE_URL privately to your application database; never the disposable test schema.
npm run db:migrate
```

Apply all migrations through `0010_pilot_evidence.sql`. The runner verifies migration
0010 is recorded; it does not run migrations or install Anvil automatically.
For repository verification, set the separate `TEST_DATABASE_URL` and run
`./scripts/check.sh` before live use.

Generate the intended-wallet configuration using `npm run pilot:inspect` as described
in the [owner runbook](owner-pilot.md). Extract `configurationCandidate` into
`execution.json`; the outer inspection wrapper is deliberately rejected. Review
the fingerprints, original scanner findings, explicitly accepted issuer-trust cautions,
route hashes, fee/source limits and profile v2. Use the intended EOA, not a copied
test wallet. Keep the private execution file mode 0600. Inspection does not accept
findings, fill jurisdiction lists or create your local-law decision.

Review the recovery source/asset guards and save `recovery.json` privately. The
checked-in `config/bsc-recovery.json` is a candidate to review, not an independence
certificate. Ordinary receipt recovery does not require the separate two-upstream
R1 review; that review is required only if an actual R1 correction is needed.

## 2. Collect diagnostics before spending

```bash
./scripts/test-eoa-pilot.sh check
# Equivalent: npm run pilot:eoa -- check
```

This records chain balances/nonce, source clocks, current prospectus discovery,
dated NYSE session, Anvil availability and database evidence. It neither prompts
for a key nor signs, sends, bootstraps, unpauses or creates a plan. Missing sources
are recorded as unavailable; diagnostics are not trading clearance.
`run` without `--broadcast` has this same diagnostic behavior.

## 3. Enable broadcasting explicitly

In the private extracted `execution.json`, set this nested field to a JSON boolean:

```json
{
  "deployment": {
    "broadcastEnabled": true
  }
}
```

This snippet shows the field location, not a replacement for the complete file.
Retain the profile, policy, instrument, route and all reviewed limits. Optional local
command to change only that field (preserving private permissions):

```bash
python3 - <<'PY'
import json, os
path = os.environ['NEXUS_EXECUTION_CONFIG']
with open(path, encoding='utf-8') as f:
    config = json.load(f)
config['deployment']['broadcastEnabled'] = True
with open(path, 'w', encoding='utf-8') as f:
    json.dump(config, f, indent=2)
    f.write('\n')
os.chmod(path, 0o600)
PY
```

Both this setting and the command's `--broadcast` flag are required. The script does
not set the file's flag automatically. Obtain fresh reviews after changing the
configuration; existing signed trade approvals bind the deployment policy and may
be invalidated. Web execution uses the same file flag and still requires the separate
persist/submit steps. Restart a long-running web deployment after changing its
operator environment paths. Return the file flag to `false` after the pilot.

## 4. Submit exact allowance setup once

```bash
./scripts/test-eoa-pilot.sh allowance --broadcast
```

Enter the intended EOA key into the hidden local prompt. Review chain 56, the full
USDT address, full router/spender, exact raw amount, nonce, estimated gas plus 20%
headroom, and absolute native/USDT fee ceilings. Type `APPROVE-USDT` only if those
exact fields are acceptable. There is no unlimited allowance or implicit reset.

USDT: `0x55d398326f99059ff775485246999027b3197955`.
Spender: `0x1b81d678ffb9c0263b24a97847620c99d213eb14`.
For the default cap the amount is `5000000000000000000` raw units (5 USDT).
If you want a smaller test, review a smaller `pilotProfile.maximumSpendRaw` and
revise the profile and bound records before starting. There is no CLI amount override.

The runner refuses new setup after an activated bootstrap or persisted wallet leg,
with existing allowance, changed security/router controls, insufficient funding or
gas outside its limits. It writes the exact signed setup bytes and a no-retry claim
before sending. The approval stays an external owner setup, not a Nexus execution
leg. It waits up to 180 seconds for a canonical successful unique exact Approval
event with at least 12 confirmations, or the larger recovery depth.

The output reports the transaction hash; `allowance-result.json` contains its
receipt and finality result. A timeout is pending, not failed. Repeat `allowance`
with the **same evidence directory** to inspect that hash; it does not resend.
An existing exact approval made separately can instead supply its canonical hash
directly to private records; do not create a second approval.

## 5. Complete and sign reviewed records

Follow the v2 `PilotManualRecords` table in the [owner runbook](owner-pilot.md).
Supply the actual finalized `allowanceApprovalTransactionHash`, current reviewed
prospectus manifest and document/restriction digests/lists, mapping/control record,
company/provider notices, expiring owner representations and dated local-law
decision/rules revision. These are owner/operator review inputs. The script does
not turn unreviewed documents into permission or make a legal decision for you.

```bash
export NEXUS_PILOT_RECORDS="$HOME/.local/state/nexus-owner-pilot/reviewed-records.json"
chmod 600 "$NEXUS_PILOT_RECORDS"
./scripts/test-eoa-pilot.sh declaration \
  --signed-records-output "$HOME/.local/state/nexus-owner-pilot/signed-records.json"
export NEXUS_PILOT_RECORDS="$HOME/.local/state/nexus-owner-pilot/signed-records.json"
```

Review all private records and exact profile/records/declaration hashes, then type
`SIGN-DECLARATION`. The new signed file is exclusive-created; the original review
file is preserved. Use a new output filename for a renewed declaration. The issuer
lists, current source bytes, signature expiry and all transfer/price/control facts
are rechecked by Nexus at trade time. This command only signs an owner statement;
it sends no transaction and does not silently renew dates or affirmations.

## 6. Run the single supervised buy

```bash
./scripts/test-eoa-pilot.sh run --broadcast --wait-seconds 180
```

The runner signs in through the normal wallet challenge, creates/selects the owned
portfolio, requests and displays finalized chain initialization, signs/activates it
while paused, explicitly unpauses, and prepares the one-buy plan and production
trade review. A valid existing initialization is reused; external balance/nonce
changes require a separately signed resync through the existing workspace flow.

Confirm each displayed action exactly: `SIGN-IN`, `SIGN-BOOTSTRAP`, `UNPAUSE`,
`SIGN-TRADE`, then `SEND-TRADE`. The signature review includes the raw input,
minimum output, calldata, gas/nonce/chain, price and evidence hashes and pilot
deferrals. `SIGN-TRADE` signs the typed permission and offline exact type-2 bytes;
Nexus re-collects the production evidence and persists the signed bytes in PostgreSQL.
`SEND-TRADE` triggers a separate fresh gate check and the existing one-time claim.
No direct swap/sendTransaction fallback is available.

The normal gate proves both mapping interpretations, true prices/session/peg,
current controls and access records, real-state quote/simulation and the full-size
local Anvil buy/sell round trip. Changed facts or unavailable sources block. Gas is
additional to the principal and outside the price band, within its absolute caps.

After sending, the runner collects canonical receipt effects, raw before/after
balances, consumed USDT, received NVDAB, actual gas, zero receipt-block allowance,
reconciled revision and recovery-source provenance. It invokes the worker again
and compares accounting, original proof, reservations and broadcast claims. A
successful replay does not create a second fill/revision/send. Wait timeout exits
with code 2 and keeps the persisted identity; no funds are released on ambiguity.

`run-state.json` preserves the plan request ID. If a blocked unsigned plan expires,
use the workspace's paused, owner-signed resync to invalidate its old held plan,
then use a new evidence directory for a fresh explicit plan attempt; retain the
old packet. Do not delete signed legs, reset caps or rewrite database balances.
The wallet-wide cap still applies across evidence directories/portfolios.

## 7. Restart and verify recovery

Exit the runner completely, then use a new process:

```bash
./scripts/test-eoa-pilot.sh recover --wait-seconds 180
```

No key is needed. Recovery processes only the configured wallet's persisted leg,
does not sign/broadcast and leaves the existing claim intact. A still-signed,
unclaimed trade is not broadcast by `recover`; `run --broadcast` can request its
stored one-time claim after fresh sign-in and `SEND-STORED`, within the existing
review lease. An expired review/persisted leg remains an operator diagnosis; no
replacement approval or nonce is invented.

Keep the successful run's packet, stop/start packet and immutable original proof.
The timeline is cumulative; packet exports are refreshed atomically. To preserve a
separate restart packet, use `--evidence-dir /another/private/directory` for `recover`.
Compare revision, confirmed balances, fill/proof count, reservation states, tx
identity and claimed send before/after. Newly appended monitoring attempts are
expected. An in-process second worker invocation is reported as replay, not an
actual OS restart.

## Evidence and incident handling

Collection is mandatory: no `--no-collect` option. Default location is
`~/.local/state/nexus-pilot/<configured-wallet>` unless overridden as above.
Directory mode is 0700 and JSON/JSONL files are 0600; repository/symlink targets are
rejected. The directory contains personal wallet data and signatures and must not
be copied wholesale into Git, MCP memory, public issues or an agent conversation.
Private keys, login tokens, database credentials and raw infrastructure errors are
excluded; ethers signs offline as documented in its
[official wallet API](https://docs.ethers.org/v6/api/wallet/).

| Artifact | Purpose |
| --- | --- |
| `timeline.jsonl` | Append-only timestamped confirmations, source evidence, blocks, sends, recovery and failure codes; flushed before progressing |
| `configuration.json`, `diagnostics.json` | Reviewed configuration/hash and independent read-only source/tool observations |
| `manual-records-evidence.json` | Private exact reviewed records and owner declaration when configured; needed to verify bound hashes/signature |
| `allowance.json`, `allowance-result.json` | Exact external signed setup identity/no-retry claim and canonical finality result |
| `trade-review.json` | Exact production review or gate rejection |
| `database-evidence.json` | Owner-only consistent snapshot of balances/revisions/plans/reservations/reviews/legs, full original fill proof/zero allowance, recovery observations and private price cadence |
| `accounting-before-restart.json`, `accounting-after-restart.json` | Within-run fresh worker replay comparison; filenames retained as acceptance checkpoints, not proof of an OS restart |
| `summary.json` | Outcome, collected scope and explicit limits |

Exit 0 means that command completed; `check`/`declaration`/`allowance` alone never
mean the trade gate is complete. Exit 2 means pending/manual-review recovery or
finality. Exit 1 means a bounded failure code; inspect private evidence and the
existing owner runbook before another action. Nothing is sent on a blocked gate.

A killed process can leave `runner.lock`. Verify its recorded PID no longer belongs
to an active runner before removing that stale file. Retain `allowance.json` and
all PostgreSQL records; removing a lock is never permission to resend. If a setup
was durably claimed but never sent, diagnose it manually instead of creating a
new approval. Nonzero post-fill allowance, conflicting/replaced/reorged effects or
changed accounting are incidents; the runner never substitutes a repair/resync.
R1 has its separate signed correction; R2/R3 remain outside scope. Mainnet acceptance
is still open until the owner actually runs these steps successfully.
