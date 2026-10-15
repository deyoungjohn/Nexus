import type { PilotRunnerRuntime } from './runner-runtime.js';
import { collectPilotPacket } from './runner-runtime.js';
import type { RunnerEvidence } from './runner-evidence.js';
import { confirmRunnerAction, type PilotTradePorts, type RunnerLeg, type RunnerConfirm } from './runner-trade.js';
import type { PilotSigner } from './runner-input.js';
import { requireInput } from '../domain/errors.js';

export async function ownerPilotLeg(runtime: PilotRunnerRuntime): Promise<RunnerLeg | null> {
  const r = await runtime.pool.query<{ id: string; state: string; tx_hash: string; portfolio_id: string }>(
    'SELECT id,state,tx_hash,portfolio_id FROM eoa_execution_legs WHERE wallet=$1 AND chain_id=56 ORDER BY created_at,id',
    [runtime.config.deployment.pilotProfile.wallet]);
  requireInput(r.rows.length <= 1, 'PILOT_ALREADY_USED', 'More than one persisted leg requires operator review.');
  const row = r.rows[0]; return row ? { id: row.id, state: row.state, hash: row.tx_hash, portfolioId: row.portfolio_id } : null;
}
export async function collectRunnerAccounting(runtime: PilotRunnerRuntime, leg: RunnerLeg): Promise<unknown> {
  // Fresh complete connection and repeatable read: excludes monitoring timestamps only.
  const packet = await collectPilotPacket(runtime.pool, runtime.config.deployment.pilotProfile.wallet,
    runtime.config.deployment.pilotProfile.revision) as Record<string, unknown>;
  const legs = packet.legs as Record<string, unknown>[];
  return { portfolios: packet.portfolios, balances: packet.balances, revisions: packet.revisions,
    reservations: packet.reservations, plans: packet.plans, fillProofs: packet.fillProofs,
    leg: legs.find(l => l.id === leg.id), broadcastResults: packet.broadcastResults };
}
export async function recoverPilotUntil(runtime: PilotRunnerRuntime, evidence: RunnerEvidence, leg: RunnerLeg,
  waitSeconds: number): Promise<{ complete: boolean; incident: boolean }> {
  const until = Date.now() + waitSeconds * 1000;
  do {
    const results = await runtime.recover(leg.id);
    await evidence.append('recovery.observed', results);
    const state = await runtime.pool.query<{ state: string; receipt_success: boolean | null; reconciled_at: Date | null }>(
      'SELECT state,receipt_success,reconciled_at FROM eoa_execution_legs WHERE id=$1 AND wallet=$2',
      [leg.id, runtime.config.deployment.pilotProfile.wallet]);
    const row = state.rows[0];
    requireInput(row !== undefined, 'SIGNED_LEG_MISSING', 'Persisted owner leg required.');
    if (results.some(r => r.outcome === 'manual-review') || ['reverted', 'reorged', 'replaced'].includes(row.state)) {
      return { complete: false, incident: true };
    }
    if (row.reconciled_at !== null && row.receipt_success === true) {
      const proof = await runtime.pool.query('SELECT 1 FROM eoa_fill_proofs WHERE leg_id=$1 AND allowance_proof IS NOT NULL', [leg.id]);
      return { complete: proof.rowCount === 1 && results.some(r => ['reconciled', 'monitored'].includes(r.outcome)), incident: false };
    }
    if (Date.now() >= until || row.state === 'signed') break;
    await new Promise(resolve => setTimeout(resolve, Math.min(3000, Math.max(1, until - Date.now()))));
  } while (Date.now() < until);
  return { complete: false, incident: false };
}

export function createRunnerTradePorts(runtime: PilotRunnerRuntime, evidence: RunnerEvidence, waitSeconds: number,
  assertOperatorLock: () => Promise<void>): PilotTradePorts & { close(): Promise<void> } {
  let token: string | null = null;
  const sessionToken = () => { requireInput(token !== null, 'SESSION_REQUIRED', 'Local owner authentication required.'); return token; };
  return {
    existingLeg: () => ownerPilotLeg(runtime),
    async authenticate(signer: PilotSigner, confirm: RunnerConfirm) {
      const challenge = await runtime.sessions.challenge(signer.address, new Date());
      await confirmRunnerAction(confirm, evidence, 'SIGN-IN', challenge);
      const signed = await signer.signMessage(challenge.message);
      const session = await runtime.sessions.verify(challenge.id, signed, new Date());
      token = session.token;
      await evidence.append('session.authenticated', { wallet: session.wallet, expiresAt: session.expiresAt });
    },
    async initialize(signer, confirm) {
      // Workspace create is idempotent per owner; preserve existing policy/portfolio.
      const result = await runtime.workspace.command(sessionToken(), new Date(), { kind: 'create-portfolio' });
      const rows = await runtime.pool.query<{ data_mode: string; execution_paused: boolean; revision: string }>(
        'SELECT data_mode,execution_paused,revision FROM portfolios WHERE id=$1 AND owner_wallet=$2', [result.portfolioId, signer.address]);
      const p = rows.rows[0]; requireInput(p !== undefined && ['unverified', 'chain'].includes(p.data_mode), 'PILOT_SCOPE', 'Fixture portfolios cannot be used.');
      if (p.data_mode === 'unverified') {
        requireInput(p.execution_paused, 'PORTFOLIO_NOT_PAUSED', 'Pause the portfolio before initialization.');
        const review = await runtime.bootstrap.prepare({ sessionToken: sessionToken(), portfolioId: result.portfolioId,
          kind: 'bootstrap', reason: 'Supervised funded-EOA pilot initialization after exact allowance setup.' });
        await confirmRunnerAction(confirm, evidence, 'SIGN-BOOTSTRAP', review);
        const signature = await signer.signTypedData(review.typedData.domain, review.typedData.types, review.typedData.value);
        await evidence.append('bootstrap.activated', await runtime.bootstrap.activate({ sessionToken: sessionToken(), reviewId: review.reviewId, ownerSignature: signature }));
      }
      const current = await runtime.workspace.read(sessionToken(), new Date(), result.portfolioId);
      requireInput(current.portfolio !== null, 'PORTFOLIO_UNAVAILABLE', 'Owner portfolio required.');
      if (current.portfolio.paused) {
        await confirmRunnerAction(confirm, evidence, 'UNPAUSE', { portfolioId: result.portfolioId, revision: current.portfolio.revision });
        await evidence.append('portfolio.unpaused', await runtime.workspace.command(sessionToken(), new Date(), {
          kind: 'set-pause', portfolioId: result.portfolioId, expectedRevision: current.portfolio.revision, paused: false }));
      }
      return result.portfolioId;
    },
    plan: (portfolioId, requestId) => runtime.planning.prepare({ sessionToken: sessionToken(), portfolioId, requestId }),
    async prepare(planId) {
      requireInput(runtime.executor !== null, 'PILOT_RECORDS_REQUIRED', 'Reviewed signed records required.');
      return runtime.executor.prepare({ sessionToken: sessionToken(), planId, legIndex: 0 });
    },
    async persist(reviewId, ownerSignature, rawSignedTransaction) {
      requireInput(runtime.executor !== null, 'PILOT_RECORDS_REQUIRED', 'Reviewed signed records required.');
      await assertOperatorLock();
      return runtime.executor.persist({ sessionToken: sessionToken(), reviewId, ownerSignature, rawSignedTransaction });
    },
    async broadcast(reviewId) {
      requireInput(runtime.executor !== null, 'PILOT_RECORDS_REQUIRED', 'Reviewed signed records required.');
      await assertOperatorLock();
      return runtime.executor.broadcast({ sessionToken: sessionToken(), reviewId });
    },
    recover: leg => recoverPilotUntil(runtime, evidence, leg, waitSeconds),
    accounting: leg => collectRunnerAccounting(runtime, leg),
    async close() { if (token !== null) { await runtime.sessions.logout(token, new Date()); token = null; } }
  };
}
