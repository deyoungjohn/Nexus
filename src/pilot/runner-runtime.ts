import { constants } from 'node:fs';
import { open, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { SessionStore } from '../application/session.js';
import { WorkspaceService } from '../application/workspace.js';
import { createBStocksExecutionRuntime } from '../execution/bstocks-runtime.js';
import { createBscSnapshotReader, ChainBootstrapService } from '../execution/chain-bootstrap.js';
import { decodeExecutionJson } from '../execution/execution-json.js';
import { parseRecoveryConfig, recoveryConfigurationRecord, type RecoveryConfig } from '../execution/recovery-config.js';
import { runBscRecoveryOnce } from '../execution/recovery-worker.js';
import { parseTokenSecurityReviews } from '../security/token-security.js';
import { securityDigest } from '../security/token-security.js';
import { DomainError, requireInput } from '../domain/errors.js';
import { fetchChainlinkBscSettlement, fetchPilotFeedObservation } from '../market-gate/chainlink-bsc.js';
import type { BStocksProductionReviewPorts } from '../market-gate/bstocks-production.js';
import type { InstrumentInput } from '../domain/instrument.js';
import type { CoordinatorPolicy } from '../coordinator/plan.js';
import { validatePilotProfile, type PilotAdmissionProfile } from './profile.js';
import { validatePilotManualRecords, type PilotManualRecords } from './manual-records.js';
import { PilotPlanningService } from './planning.js';
import { privateOutputPath } from './private-output.js';
import { discoverNvdabProspectuses } from './prospectus-register.js';
import { fetchNyseSession } from '../market-gate/nyse-calendar.js';
import { regularSessionOpen } from '../market-gate/session.js';
import type { RunnerEvidence } from './runner-evidence.js';

type CompositionInput = Parameters<typeof createBStocksExecutionRuntime>[0];
export type PilotRunnerConfig = Omit<CompositionInput, 'pool' | 'sessions' | 'recoveryConfig' | 'securityReviews' | 'pilotRecords'> & {
  readonly deployment: CompositionInput['deployment'] & { readonly pilotProfile: PilotAdmissionProfile };
  readonly route: NonNullable<CompositionInput['route']>;
  readonly pilotInstrument: InstrumentInput;
  readonly pilotCoordinatorPolicy: CoordinatorPolicy;
};
export async function privateJson(path: string): Promise<unknown> {
  const target = await privateOutputPath(path);
  requireInput(target === path, 'PRIVATE_CONFIG_REQUIRED', 'Use an absolute private path without symlinks.');
  const file = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { const stat = await file.stat();
    requireInput(stat.isFile() && (stat.mode & 0o077) === 0 && stat.size <= 8_000_000,
      'PRIVATE_CONFIG_REQUIRED', 'Configuration must be bounded and mode 0600 outside the repository.');
    return JSON.parse(await file.readFile('utf8'));
  } finally { await file.close(); }
}
export function validateRunnerConfig(config: PilotRunnerConfig): void {
  requireInput(!!config?.deployment?.pilotProfile && !!config.route && !!config.pilotInstrument && !!config.pilotCoordinatorPolicy,
    'INVALID_PILOT_CONFIG', 'Use the extracted reviewed configurationCandidate, not the inspection wrapper.');
  validatePilotProfile(config.deployment.pilotProfile);
  requireInput(config.deployment.broadcastEnabled === undefined || typeof config.deployment.broadcastEnabled === 'boolean',
    'INVALID_PILOT_CONFIG', 'Broadcast flag must be a boolean.');
  requireInput(config.route.maxGasLimit === config.deployment.maxGasLimit && config.route.maxFeePerGas === config.deployment.maxFeePerGas,
    'INVALID_PILOT_CONFIG', 'Route and deployment gas limits must match.');
}
export function requireRunnerBroadcast(config: PilotRunnerConfig, requested: boolean): void {
  requireInput(requested && config.deployment.broadcastEnabled === true,
    'BROADCAST_DISABLED', 'Both deployment.broadcastEnabled=true and --broadcast are required.');
}
const unresolved: Omit<BStocksProductionReviewPorts, 'quote' | 'simulation'> = {
  accessPolicy: null, reviewedControl: null, access: { async session() { return { active: false, binding: null }; },
    async jurisdiction() { return null; }, async country() { return null; }, async product() { return null; } },
  async economicQuantity() { return null; }, async portfolioValuations() { return null; }, async event() { return null; }, async providerEvent() { return null; }
};

/** Same trusted services used by web; no user-supplied market evidence or signer in the runtime. */
export function composePilotRunner(pool: Pool, config: PilotRunnerConfig, recovery: RecoveryConfig,
  records: PilotManualRecords | null, securityReviews: CompositionInput['securityReviews'], origin: string, evidence?: RunnerEvidence) {
  validateRunnerConfig(config);
  const sessions = new SessionStore(pool, origin), workspace = new WorkspaceService(pool, origin);
  const reader = createBscSnapshotReader(recovery);
  const bootstrap = new ChainBootstrapService(pool, sessions, recovery, reader);
  const profile = config.deployment.pilotProfile;
  const planning = new PilotPlanningService(pool, sessions, profile, config.pilotInstrument, config.pilotCoordinatorPolicy, reader,
    now => fetchChainlinkBscSettlement({ rpcUrl: config.rpcUrl, now, maxBlockAgeMs: config.deployment.marketPolicy.maxStatusAgeMs,
      maxReferenceAgeMs: config.settlementMaxAgeMs, uncertaintyBps: config.settlementUncertaintyBps, maxPegDeviationBps: config.settlementMaxPegDeviationBps }));
  const executor = records ? createBStocksExecutionRuntime({ ...config, pool, sessions, recoveryConfig: recovery,
    securityReviews, pilotRecords: records }, unresolved, fetch, evidence ? async (context, observation) => {
      await evidence.append('market.collected', { context, evidence: observation });
    } : undefined) : null;
  return { pool, config, recovery, records, sessions, workspace, reader, bootstrap, planning, executor,
    async recover(legId?: string) { return runBscRecoveryOnce(pool, recovery, fetch, 25,
      { wallet: profile.wallet, ...(legId ? { legId } : {}) }); } };
}
export type PilotRunnerRuntime = ReturnType<typeof composePilotRunner>;
export async function loadPilotRunnerRuntime(evidence?: RunnerEvidence): Promise<PilotRunnerRuntime> {
  requireInput(!!process.env.NEXUS_EXECUTION_CONFIG && !!process.env.DATABASE_URL,
    'RUNNER_CONFIG_REQUIRED', 'Set NEXUS_EXECUTION_CONFIG and DATABASE_URL.');
  const config = decodeExecutionJson<PilotRunnerConfig>(await privateJson(process.env.NEXUS_EXECUTION_CONFIG!));
  validateRunnerConfig(config);
  const recovery = parseRecoveryConfig(JSON.parse(await readFile(process.env.NEXUS_RECOVERY_CONFIG ?? 'config/bsc-recovery.json', 'utf8')));
  const reviews = parseTokenSecurityReviews(JSON.parse(await readFile(process.env.NEXUS_TOKEN_SECURITY_REVIEWS ?? 'config/token-security-reviews.json', 'utf8')));
  const records = process.env.NEXUS_PILOT_RECORDS ? decodeExecutionJson<PilotManualRecords>(await privateJson(process.env.NEXUS_PILOT_RECORDS)) : null;
  if (records) validatePilotManualRecords(config.deployment.pilotProfile, records);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8, connectionTimeoutMillis: 5000 });
  try {
    const migrated = await pool.query("SELECT 1 FROM schema_migrations WHERE name='0010_pilot_evidence.sql'");
    requireInput(migrated.rowCount === 1, 'DATABASE_MIGRATION_REQUIRED', 'Migrate the application database through 0010 before running.');
    return composePilotRunner(pool, config, recovery, records, reviews, process.env.NEXUS_APP_ORIGIN ?? 'http://localhost:3000', evidence);
  } catch (error) { await pool.end(); throw error; }
}

export async function collectRunnerDiagnostics(runtime: PilotRunnerRuntime): Promise<unknown> {
  const now = new Date().toISOString(), config = runtime.config, date = new Intl.DateTimeFormat('en-CA',
    { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
  const probes = [
    ['chainSnapshot', () => runtime.reader.read(config.deployment.pilotProfile.wallet)],
    ['equityFeed', () => fetchPilotFeedObservation({ rpcUrl: config.rpcUrl, now, maxBlockAgeMs: 120000,
      maxReferenceAgeMs: config.deployment.pilotProfile.price.heartbeatMs }, 'equity')],
    ['settlementFeed', () => fetchPilotFeedObservation({ rpcUrl: config.rpcUrl, now, maxBlockAgeMs: 120000, maxReferenceAgeMs: 1350000 }, 'settlement')],
    ['prospectuses', () => discoverNvdabProspectuses()],
    ['session', () => fetchNyseSession(date)],
    ['anvil', async () => (await promisify(execFile)('anvil', ['--version'], { timeout: 5000, maxBuffer: 4096 })).stdout.trim()]
  ] as const;
  const results = await Promise.allSettled(probes.map(([, run]) => run()));
  const observations = Object.fromEntries(results.map((r, i) => [probes[i]![0], r.status === 'fulfilled' ? r.value : { unavailable: true }]));
  return { observedAt: now, configurationHash: securityDigest(config), recoveryConfigurationHash: recoveryConfigurationRecord(runtime.recovery).hash,
    broadcastEnabled: config.deployment.broadcastEnabled ?? false, manualRecordsPresent: runtime.records !== null,
    regularSessionOpen: observations.session ? regularSessionOpen(new Date(now), observations.session as NonNullable<Awaited<ReturnType<typeof fetchNyseSession>>>) : false,
    observations, scope: 'Read-only diagnostics; only the production prepare/persist/claim gate grants admission.' };
}

/** Explicit owner-only export, excluding login tokens and unbounded server error objects. */
export async function collectPilotPacket(pool: Pool, wallet: string, profileRevision: string): Promise<unknown> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const portfolios = await client.query('SELECT * FROM portfolios WHERE owner_wallet=$1 AND chain_id=56 ORDER BY id', [wallet]);
    const ids = portfolios.rows.map(p => p.id as string);
    const queries: [string, string, unknown[]][] = [
      ['balances', 'SELECT * FROM balances WHERE portfolio_id=ANY($1::text[]) ORDER BY portfolio_id,asset_id', [ids]],
      ['revisions', 'SELECT * FROM portfolio_revisions WHERE portfolio_id=ANY($1::text[]) ORDER BY portfolio_id,revision', [ids]],
      ['decisions', 'SELECT * FROM decision_records WHERE portfolio_id=ANY($1::text[]) ORDER BY recorded_at,id', [ids]],
      ['plans', 'SELECT * FROM plans WHERE portfolio_id=ANY($1::text[]) ORDER BY id', [ids]],
      ['reservations', 'SELECT * FROM reservations WHERE portfolio_id=ANY($1::text[]) ORDER BY id', [ids]],
      ['snapshots', 'SELECT * FROM chain_snapshot_reviews WHERE portfolio_id=ANY($1::text[]) ORDER BY created_at,id', [ids]],
      ['tradeReviews', 'SELECT * FROM eoa_execution_reviews WHERE portfolio_id=ANY($1::text[]) ORDER BY created_at,id', [ids]],
      ['legs', 'SELECT * FROM eoa_execution_legs WHERE wallet=$1 AND chain_id=56 ORDER BY created_at,id', [wallet]],
      ['fillProofs', 'SELECT f.* FROM eoa_fill_proofs f JOIN eoa_execution_legs l ON l.id=f.leg_id WHERE l.wallet=$1 ORDER BY f.leg_id', [wallet]],
      ['recoveryEvidence', 'SELECT e.* FROM eoa_recovery_evidence e JOIN eoa_execution_legs l ON l.id=e.leg_id WHERE l.wallet=$1 ORDER BY e.id', [wallet]],
      ['recoveryAttempts', 'SELECT a.* FROM eoa_recovery_attempts a JOIN eoa_execution_legs l ON l.id=a.leg_id WHERE l.wallet=$1 ORDER BY a.started_at,a.id', [wallet]],
      ['broadcastResults', 'SELECT b.* FROM eoa_broadcast_results b JOIN eoa_execution_legs l ON l.id=b.review_id WHERE l.wallet=$1 ORDER BY b.review_id', [wallet]],
      ['priceObservations', 'SELECT * FROM pilot_price_observations WHERE profile_revision=$1 ORDER BY id', [profileRevision]],
      ['feedHighwater', 'SELECT * FROM pilot_feed_highwater ORDER BY source', []]
    ];
    const packet: Record<string, unknown> = { collectedAt: new Date().toISOString(), portfolios: portfolios.rows,
      priceScope: 'Profile cadence may include concurrent observations of the same configured profile; feed high-water is global by source.' };
    for (const [name, sql, params] of queries) packet[name] = (await client.query(sql, params)).rows;
    await client.query('COMMIT'); return packet;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function lockPilotOperator(pool: Pool, wallet: string) {
  const client = await pool.connect();
  const key = `nexus-pilot-operator:${wallet}`;
  let r;
  try { r = await client.query<{ acquired: boolean }>('SELECT pg_try_advisory_lock(hashtextextended(current_schema() || $1,0)) acquired', [key]); }
  catch (error) { client.release(true); throw error; }
  if (!r.rows[0]?.acquired) { client.release(); throw new DomainError('RUNNER_LOCKED', 'Another operator runner is active for this wallet.'); }
  let lost = false;
  const onError = () => { lost = true; }; client.on('error', onError);
  return { async assertHeld() { requireInput(!lost, 'RUNNER_LOCK_LOST', 'Operator database lock lost.'); await client.query('SELECT 1'); },
    async close() { try { if (!lost) await client.query('SELECT pg_advisory_unlock(hashtextextended(current_schema() || $1,0))', [key]); }
      finally { client.off('error', onError); client.release(lost); } } };
}
