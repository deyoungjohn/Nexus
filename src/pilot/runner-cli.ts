import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { executionJson, decodeExecutionJson } from '../execution/execution-json.js';
import { requireInput } from '../domain/errors.js';
import { securityDigest } from '../security/token-security.js';
import { pilotDeclarationTypedData, validatePilotManualRecords } from './manual-records.js';
import { privateOutputPath } from './private-output.js';
import { PilotEvidence, runnerErrorCode, evidenceProjection, requireDistinctEvidenceInputs } from './runner-evidence.js';
import { parsePilotRunnerOptions, privateKeySigner, readPrivateKeyFile, terminalInput, type PilotSigner } from './runner-input.js';
import { loadPilotRunnerRuntime, privateJson, collectRunnerDiagnostics, collectPilotPacket, requireRunnerBroadcast,
  lockPilotOperator, validateRunnerConfig, type PilotRunnerConfig } from './runner-runtime.js';
import { assertPilotSigner, confirmRunnerAction, runPilotTrade, type RunnerConfirm } from './runner-trade.js';
import { createSetupApprovalPort, runSetupApproval } from './runner-allowance.js';
import { createRunnerTradePorts, ownerPilotLeg, recoverPilotUntil } from './runner-services.js';

const help = `Nexus supervised EOA pilot (BSC, one NVDAB buy <=5 USDT)
Usage: npm run pilot:eoa -- <check|allowance|declaration|run|recover> [options]
  --broadcast              Explicit live send request; also requires reviewed config flag
  --key-file /private/key   Optional mode-0600 local file; otherwise hidden terminal prompt
  --evidence-dir /private   Private 0700 directory; default ~/.local/state/nexus-pilot/<wallet>
  --signed-records-output /private/new.json  Required only for declaration (exclusive create)
  --wait-seconds 0..3600    Bounded receipt/recovery wait, default 180

check and run without --broadcast collect diagnostics only. No key required.
allowance without --broadcast refuses sending. recover never signs or sends.
Live actions require an interactive exact confirmation; no --yes or private-key argument.
Set DATABASE_URL, NEXUS_EXECUTION_CONFIG and reviewed NEXUS_RECOVERY_CONFIG.
Set NEXUS_PILOT_RECORDS for declaration/run. See docs/runbooks/eoa-pilot-runner.md.
`;
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || (args.length === 1 && ['--help', '-h'].includes(args[0]!))) { process.stdout.write(help); return; }
  const options = parsePilotRunnerOptions(args);
  requireInput(!!process.env.NEXUS_EXECUTION_CONFIG, 'RUNNER_CONFIG_REQUIRED', 'Set the private execution configuration.');
  const preliminary = decodeExecutionJson<PilotRunnerConfig>(await privateJson(process.env.NEXUS_EXECUTION_CONFIG!));
  validateRunnerConfig(preliminary);
  const directory = options.evidenceDirectory ?? process.env.NEXUS_PILOT_EVIDENCE_DIR
    ?? resolve(homedir(), '.local/state/nexus-pilot', preliminary.deployment.pilotProfile.wallet);
  requireDistinctEvidenceInputs(directory, [process.env.NEXUS_EXECUTION_CONFIG, process.env.NEXUS_PILOT_RECORDS,
    process.env.NEXUS_RECOVERY_CONFIG, process.env.NEXUS_TOKEN_SECURITY_REVIEWS, options.keyFile, options.signedRecordsOutput]);
  const evidence = await PilotEvidence.create(directory);
  process.stdout.write(`Private evidence: ${evidence.directory}\n`);
  let runtime: Awaited<ReturnType<typeof loadPilotRunnerRuntime>> | null = null;
  let operator: Awaited<ReturnType<typeof lockPilotOperator>> | null = null;
  let ports: ReturnType<typeof createRunnerTradePorts> | null = null;
  let signer: PilotSigner | null = null;
  let outcome = 'failed';
  const confirm: RunnerConfirm = async (action, details) => {
    process.stdout.write(`${action}\n${JSON.stringify(evidenceProjection(details), null, 2)}\n`);
    return await terminalInput(`Type ${action} to confirm this exact action: `) === action;
  };
  try {
    await evidence.append('runner.started', { command: options.command, broadcastRequested: options.broadcast, dataCollection: 'mandatory' });
    runtime = await loadPilotRunnerRuntime(evidence);
    const profile = runtime.config.deployment.pilotProfile;
    await evidence.save('configuration.json', { configuration: runtime.config, configurationHash: securityDigest(runtime.config),
      recordsHash: runtime.records ? securityDigest(runtime.records) : null });
    if (runtime.records) await evidence.save('manual-records-evidence.json', runtime.records);
    await evidence.save('diagnostics.json', await collectRunnerDiagnostics(runtime));
    if (options.command === 'check' || (options.command === 'run' && !options.broadcast)) {
      outcome = 'diagnostics-only';
      process.stdout.write('Collected chain/feed/register/session/tool diagnostics and database evidence. No signature or broadcast.\n');
      return;
    }
    if (options.command === 'recover') {
      const leg = await ownerPilotLeg(runtime);
      requireInput(leg !== null, 'SIGNED_LEG_MISSING', 'No persisted owner trade is available to recover.');
      const r = await recoverPilotUntil(runtime, evidence, leg, options.waitSeconds);
      outcome = r.incident ? 'incident' : r.complete ? 'reconciled' : 'pending';
      if (outcome !== 'reconciled') process.exitCode = 2;
      process.stdout.write(`Recovery: ${outcome}. No signature, resend or additional trade.\n`); return;
    }
    if (options.command === 'allowance' || options.command === 'run') requireRunnerBroadcast(runtime.config, options.broadcast);
    requireInput(process.stdin.isTTY && process.stdout.isTTY, 'INTERACTIVE_TERMINAL_REQUIRED', 'Use a terminal for exact confirmations.');
    if (options.command === 'run' || options.command === 'declaration') requireInput(runtime.records !== null, 'PILOT_RECORDS_REQUIRED', 'Configure reviewed v2 private records.');
    signer = options.keyFile ? await readPrivateKeyFile(options.keyFile) : privateKeySigner(await terminalInput('Enter funded EOA private key (hidden, local only): ', true));
    assertPilotSigner(signer, profile.wallet);
    operator = await lockPilotOperator(runtime.pool, profile.wallet);
    if (options.command === 'declaration') {
      const records = runtime.records!; validatePilotManualRecords(profile, records);
      const { declaration, ...rest } = records, { signature: _signature, ...unsigned } = declaration;
      const typed = pilotDeclarationTypedData(profile, rest, unsigned);
      await confirmRunnerAction(confirm, evidence, 'SIGN-DECLARATION', { records, typedData: typed,
        scope: 'Owner statements only; no source review or local-law decision is created by this script.' });
      const signature = await signer.signTypedData(typed.domain, typed.types, typed.value);
      const output = await privateOutputPath(options.signedRecordsOutput!);
      await writeFile(output, executionJson({ ...records, declaration: { ...declaration, signature } }) + '\n', { mode: 0o600, flag: 'wx' });
      await evidence.append('declaration.signed', { output, recordsHash: securityDigest(rest), profileHash: securityDigest(profile) });
      outcome = 'declaration-signed';
      process.stdout.write('Signed records written privately. Set NEXUS_PILOT_RECORDS to the new file; no transaction sent.\n'); return;
    }
    if (options.command === 'allowance') {
      const port = createSetupApprovalPort(runtime, fetch, evidence);
      const result = await runSetupApproval({ wallet: profile.wallet, signer, port, evidence, confirm, assertOperatorLock: () => operator!.assertHeld() });
      let receipt = result.receipt;
      const until = Date.now() + options.waitSeconds * 1000;
      while (!receipt && Date.now() < until) {
        await new Promise(r => setTimeout(r, Math.min(3000, Math.max(1, until - Date.now()))));
        receipt = await port.verify(result.hash);
        await evidence.append('allowance.finality', { hash: result.hash, receipt });
      }
      await evidence.save('allowance-result.json', { hash: result.hash, receipt, finalityVerified: receipt !== null });
      outcome = receipt ? 'allowance-finalized' : 'allowance-pending';
      if (!receipt) process.exitCode = 2;
      process.stdout.write(`Exact approval: ${result.hash}; ${outcome}. Put this hash in reviewed records before signing/bootstrap.\n`); return;
    }
    ports = createRunnerTradePorts(runtime, evidence, options.waitSeconds, () => operator!.assertHeld());
    let state = await evidence.load<{ requestId: string; wallet: string }>('run-state.json');
    if (!state) { state = { requestId: randomUUID(), wallet: profile.wallet }; await evidence.save('run-state.json', state); }
    requireInput(state.wallet === profile.wallet, 'PILOT_WALLET_MISMATCH', 'Evidence belongs to another wallet.');
    outcome = await runPilotTrade({ wallet: profile.wallet, signer, ports, evidence, confirm, requestId: state.requestId });
    if (outcome !== 'complete') process.exitCode = 2;
    process.stdout.write(`Pilot: ${outcome}. Evidence includes production gate, receipts, effects, zero allowance and recovery replay.\n`);
  } catch (error) {
    await evidence.append('runner.failed', { code: runnerErrorCode(error) });
    throw error;
  } finally {
    signer = null;
    try {
      if (runtime) {
        try { await evidence.save('database-evidence.json', await collectPilotPacket(runtime.pool,
          runtime.config.deployment.pilotProfile.wallet, runtime.config.deployment.pilotProfile.revision)); }
        catch (error) { await evidence.append('packet.failed', { code: runnerErrorCode(error) }); process.exitCode = 1; }
      }
      await evidence.save('summary.json', { outcome, command: options.command, observedAt: new Date().toISOString(),
        dataCollection: 'mandatory', mainnetAcceptance: outcome === 'complete' ? 'successful-owner-trade-and-worker-replay' : 'not-complete',
        remainingScope: 'Process restart is operator-verified with recover; R1 incidents, R2/R3 and public release remain separate.' });
    } finally {
      try { await ports?.close(); } finally {
        try { await operator?.close(); } finally {
          try { await runtime?.pool.end(); } finally { await evidence.close(); }
        }
      }
    }
  }
}
main().catch(error => { process.stderr.write(`${runnerErrorCode(error)}. See the private evidence directory and runner runbook.\n`); process.exitCode = 1; });
