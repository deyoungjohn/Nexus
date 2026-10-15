import { randomUUID, createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { amount, type Amount } from "../domain/amount.js";
import { identifier, requireInput } from "../domain/errors.js";
import { createInstrument, type Instrument } from "../domain/instrument.js";
import type { CoordinatorPolicy, PortfolioSnapshot, Proposal } from "../coordinator/plan.js";
import type { GateRequest, MarketGatePolicy } from "../market-gate/evidence.js";
import { evaluateMarketGate } from "../market-gate/gate.js";
import type { ExecutionMarketCollector, ExecutionMarketContext } from "../market-gate/bstocks-production.js";
import { securityDigest } from "../security/token-security.js";
import { Ledger } from "../ledger/ledger.js";
import { EoaExecutionStore, type PrepareSignedEoaLeg } from "./store.js";
import { prepareEoaLegApproval, type ApprovalMetadata } from "./eoa.js";
import { revalidateExecutionMarket, executionMarketExpiry } from "./market-revalidation.js";
import { decodeExecutionJson, executionJson } from "./execution-json.js";
import type { ExecutionChainPort, ExecutionChainState } from "./bsc-execution-chain.js";
import { pilotPriceBand, validatePilotProfile, type PilotAdmissionProfile } from "../pilot/profile.js";

/** Implemented by SessionStore; authenticated sessions are never browser claims. */
export interface ExecutionSessions {
  authenticate(token: string, now: Date, client: PoolClient): Promise<{ wallet: string; expiresAt: string }>;
}
export interface ExecutionDeployment {
  readonly pilotProfile?: PilotAdmissionProfile;
  readonly version: string;
  readonly broadcastEnabled: boolean;
  readonly recoveryConfigurationHash: string;
  readonly routeConfigurationHash?: string;
  readonly marketPolicy: MarketGatePolicy;
  readonly mappingRevisions: Readonly<Record<string, string>>;
  readonly maxGasLimit: bigint;
  readonly maxFeePerGas: bigint;
  readonly approvalLifetimeMs: number;
}
interface Context {
  readonly market: ExecutionMarketContext;
  readonly portfolioId: string; readonly planId: string; readonly reservationId: string;
  readonly policyHash: string; readonly hash: string; readonly sessionExpiresAt: string;
  readonly planStatus: string;
}
interface ReviewRow {
  id: string; portfolio_id: string; plan_id: string; leg_index: number;
  context_hash: string; request: unknown; metadata: unknown; expires_at: Date;
  owner_signature: string | null; tx_hash: string | null;
}
const balances = (s: PortfolioSnapshot): readonly Amount[] => [s.confirmedCash, s.nativeGas, ...s.positions.map(p => p.raw)];
const sameBalances = (a: readonly Amount[], b: readonly Amount[]): boolean => securityDigest([...a].sort((x,y) => x.assetId.localeCompare(y.assetId)))
  === securityDigest([...b].sort((x,y) => x.assetId.localeCompare(y.assetId)));

/** Server orchestration only. Clients submit IDs/signatures, never evidence or policy. */
export class ProductionEoaExecutor {
  private readonly deployment: ExecutionDeployment;
  constructor(private readonly pool: Pool, private readonly sessions: ExecutionSessions,
    deployment: ExecutionDeployment, private readonly market: ExecutionMarketCollector,
    private readonly chain: ExecutionChainPort, private readonly clock: () => Date = () => new Date()) {
    identifier(deployment.version);
    requireInput(typeof deployment.broadcastEnabled === "boolean" && /^[0-9a-f]{64}$/.test(deployment.recoveryConfigurationHash)
      && (deployment.routeConfigurationHash === undefined || /^[0-9a-f]{64}$/.test(deployment.routeConfigurationHash))
      && deployment.maxGasLimit > 0n
      && deployment.maxFeePerGas > 0n && Number.isSafeInteger(deployment.approvalLifetimeMs)
      && deployment.approvalLifetimeMs > 0 && deployment.approvalLifetimeMs <= 300_000,
    "INVALID_EXECUTION_CONFIG", "Versioned deployment and bounded fees/approval lifetime required.");
    this.deployment = structuredClone(deployment);
    if (deployment.pilotProfile) validatePilotProfile(deployment.pilotProfile);
  }
  private async transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      try { const result = await run(client); await client.query("COMMIT"); return result; }
      catch (error) { await client.query("ROLLBACK"); throw error; }
    } finally { client.release(); }
  }
  private now(): Date {
    const now = this.clock();
    requireInput(Number.isFinite(now.getTime()), "INVALID_CLOCK", "Valid server clock required.");
    return now;
  }
  private async context(client: PoolClient, token: string, planId: string, index: number): Promise<Context> {
    identifier(planId);
    requireInput(Number.isSafeInteger(index) && index >= 0, "INVALID_LEG", "Stored leg index required.");
    const now = this.now(), session = await this.sessions.authenticate(token, now, client);
    if (this.deployment.pilotProfile) await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('nexus-pilot:' || $1, 0))", [session.wallet.toLowerCase()]);
    const owned = await client.query<{ id: string; chain_id: number; revision: string; active_policy_id: string | null;
      execution_paused: boolean; data_mode: string; status: string; plan_revision: string }>(`SELECT p.id, p.chain_id,
        p.revision, p.active_policy_id, p.execution_paused, p.data_mode, q.status, q.revision AS plan_revision
      FROM portfolios p JOIN plans q ON q.portfolio_id=p.id WHERE q.id=$1 AND p.owner_wallet=$2 FOR UPDATE OF p,q`,
    [planId, session.wallet.toLowerCase()]);
    const row = owned.rows[0];
    requireInput(row !== undefined, "PLAN_UNAVAILABLE", "Owned plan required.");
    requireInput(!row.execution_paused && row.chain_id === 56 && row.data_mode === "chain",
      "EXECUTION_UNAVAILABLE", "Unpaused chain-backed BSC portfolio required.");
    requireInput(row.revision === row.plan_revision && ["reserved", "executing", "reconciling"].includes(row.status),
      "STALE_REVISION", "Current executable plan required.");
    const record = await client.query<{ body: { policyId: string; reservedPlanId: string;
      proposals: unknown[]; result: { legs: { proposalId: string; instrumentId: string; side: string; amount: unknown }[] } };
      snapshot: unknown; policy: unknown; policy_version: string }>(`SELECT d.body, e.body AS snapshot,
      k.body AS policy, k.version AS policy_version FROM coordination_occurrences c
      JOIN decision_records d ON d.id=c.decision_record_id AND d.portfolio_id=c.portfolio_id
      JOIN evidence_snapshots e ON e.id=$2 AND e.portfolio_id=c.portfolio_id AND e.revision=$3
      JOIN policies k ON k.id=$4 AND k.portfolio_id=c.portfolio_id
      WHERE c.plan_id=$1 AND c.portfolio_id=$5 AND d.kind='coordination' AND d.revision=$3`,
    [planId, `evidence-${planId}`, row.revision, row.active_policy_id, row.id]);
    const stored = record.rows[0], leg = stored?.body.result.legs[index];
    requireInput(stored !== undefined && leg !== undefined && stored.body.policyId === row.active_policy_id
      && stored.body.reservedPlanId === planId, "PLAN_UNAVAILABLE", "Persisted coordination and active policy required.");
    const snapshot = decodeExecutionJson<{ snapshot: PortfolioSnapshot }>({ snapshot: stored.snapshot }).snapshot;
    const policy = decodeExecutionJson<CoordinatorPolicy>(stored.policy);
    requireInput(snapshot.revision === BigInt(row.revision), "STALE_REVISION", "Stored snapshot revision changed.");
    const registered = await client.query<{ instrument_id: string; body: Instrument }>(
      "SELECT instrument_id,body FROM instruments WHERE instrument_id=ANY($1::text[]) FOR SHARE",
      [snapshot.positions.map(p => p.instrument.instrumentId)]);
    for (const p of snapshot.positions) {
      const registry = registered.rows.find(r => r.instrument_id === p.instrument.instrumentId);
      requireInput(registry !== undefined && securityDigest(createInstrument(registry.body)) === securityDigest(p.instrument),
        "INSTRUMENT_METADATA_CHANGED", "Exact immutable registered instruments required.");
    }
    const instrument = snapshot.positions.find(p => p.instrument.instrumentId === leg.instrumentId)?.instrument;
    requireInput(instrument !== undefined, "UNKNOWN_INSTRUMENT", "Plan leg instrument is not in the snapshot.");
    const raw = decodeExecutionJson<Amount>(leg.amount);
    const original = stored.body.proposals.map(p => decodeExecutionJson<Proposal>(p)).find(p => p.id === leg.proposalId);
    requireInput(original !== undefined && original.instrumentId === leg.instrumentId && original.side === leg.side,
      "PLAN_UNAVAILABLE", "Stored proposal must match its accepted leg.");
    const reservationId = `${planId}-${index}`;
    const reservation = await client.query<{ asset_id: string; decimals: number; units: string; state: string; lease_until: Date | null }>(
      "SELECT asset_id,decimals,units,state,lease_until FROM reservations WHERE id=$1 AND plan_id=$2 AND portfolio_id=$3 FOR UPDATE",
      [reservationId, planId, row.id]);
    const r = reservation.rows[0];
    requireInput(r !== undefined && ["held", "submitted"].includes(r.state) && r.asset_id === raw.assetId
      && r.decimals === raw.decimals && BigInt(r.units) === raw.units
      && (r.state !== "held" || (r.lease_until !== null && r.lease_until > now)),
    "RESERVATION_MISMATCH", "Current exact reservation required.");
    const confirmed = await client.query<{ asset_id: string; decimals: number; confirmed_units: string }>(
      "SELECT asset_id,decimals,confirmed_units FROM balances WHERE portfolio_id=$1 FOR SHARE", [row.id]);
    requireInput(sameBalances(balances(snapshot), confirmed.rows.map(r => amount(BigInt(r.confirmed_units),
      { assetId: r.asset_id, decimals: r.decimals }))), "UNRECONCILED_SNAPSHOT", "Stored snapshot must match all confirmed ledger balances.");
    const holds = await client.query<{ asset_id: string; units: string }>(`SELECT asset_id,sum(units) AS units FROM reservations
      WHERE portfolio_id=$1 AND id<>$2 AND state IN ('held','submitted') GROUP BY asset_id`, [row.id, reservationId]);
    const held = new Map(holds.rows.map(r => [r.asset_id, BigInt(r.units)]));
    const currentSnapshot = { ...snapshot, reservedCash: amount(held.get(snapshot.confirmedCash.assetId) ?? 0n, snapshot.confirmedCash),
      positions: snapshot.positions.map(p => ({ ...p, reservedRaw: amount(held.get(p.raw.assetId) ?? 0n, p.raw) })) };
    const baseUnits = original.side === "buy" ? original.spend.units : original.raw.units;
    requireInput(raw.units > 0n && raw.units <= baseUnits, "PLAN_UNAVAILABLE", "Accepted amount exceeds the proposal.");
    const floor = (v: bigint) => v * raw.units / baseUnits;
    const ceil = (v: bigint) => (v * raw.units + baseUnits - 1n) / baseUnits;
    const proposal: Proposal = original.side === "buy" ? { ...original, nominalValue: ceil(original.nominalValue),
      spend: raw, acquiredValueLower: floor(original.acquiredValueLower), acquiredValueUpper: ceil(original.acquiredValueUpper) }
      : { ...original, nominalValue: ceil(original.nominalValue), raw,
        proceeds: amount(floor(original.proceeds.units), original.proceeds), proceedsValueLower: floor(original.proceedsValueLower) };
    const mapping = this.deployment.mappingRevisions[instrument.instrumentId];
    if (this.deployment.pilotProfile) {
      const pilot = this.deployment.pilotProfile;
      requireInput(session.wallet.toLowerCase() === pilot.wallet && instrument.instrumentId === pilot.instrumentId
        && proposal.side === "buy" && raw.units <= pilot.maximumSpendRaw && stored.body.result.legs.length === 1,
      "PILOT_SCOPE", "Pilot permits one bounded owner NVDAB buy only.");
      const prior = await client.query(`SELECT 1 FROM eoa_execution_legs
        WHERE chain_id=56 AND wallet=$1 AND id NOT IN
          (SELECT id FROM eoa_execution_reviews WHERE plan_id=$2) LIMIT 1`, [pilot.wallet, planId]);
      requireInput(prior.rowCount === 0, "PILOT_ALREADY_USED", "A persisted pilot leg consumes the one-buy allowance.");
    }
    requireInput(typeof mapping === "string" && mapping.length > 0, "MISSING_MAPPING_REVIEW", "Reviewed economic mapping revision required.");
    const policyHash = `0x${securityDigest({ policyId: row.active_policy_id, version: stored.policy_version,
      body: stored.policy, deployment: this.deployment })}`;
    const bootstrap=this.deployment.pilotProfile?await client.query<{source_block:string}>(
      `SELECT source_block FROM chain_snapshot_reviews WHERE portfolio_id=$1 AND wallet=$2 AND kind='bootstrap'
        AND activated_revision IS NOT NULL ORDER BY activated_revision LIMIT 1`,[row.id,session.wallet.toLowerCase()]):null;
    const market: ExecutionMarketContext = { now: now.toISOString(), wallet: session.wallet.toLowerCase(),
      ...(this.deployment.pilotProfile ? { pilotProfile: this.deployment.pilotProfile } : {}),
      ...(bootstrap?.rows[0]?{pilotBootstrapBlock:BigInt(bootstrap.rows[0].source_block)}:{}),
      sessionId: createHash("sha256").update(token).digest("hex"), instrument,
      snapshot: currentSnapshot, coordinatorPolicy: policy, proposal,
      marketPolicy: this.deployment.marketPolicy, expectedMappingRevision: mapping };
    return { portfolioId: row.id, planId, reservationId, policyHash, market, sessionExpiresAt: session.expiresAt,
      planStatus: row.status, hash: securityDigest({ portfolioId: row.id, planId, reservationId, policyHash,
        instrument, snapshot: currentSnapshot, proposal, mapping }) };
  }
  private async chainState(context: Context): Promise<ExecutionChainState> {
    const state = await this.chain.state(context.market.wallet, balances(context.market.snapshot), this.now().toISOString());
    requireInput(state !== null && state.chainId === 56 && state.wallet.toLowerCase() === context.market.wallet
      && Number.isSafeInteger(state.nonce) && state.nonce >= 0
      && sameBalances(state.balances, balances(context.market.snapshot)),
    "CHAIN_STATE_CHANGED", "Current EOA nonce and complete tracked balances must match trusted records.");
    if(this.deployment.pilotProfile){
      const r=await this.pool.query<{nonce:string}>(`SELECT greatest(s.tx_nonce,coalesce(
        (SELECT max(l.tx_nonce)+1 FROM eoa_execution_legs l WHERE l.wallet=s.wallet AND l.chain_id=56
          AND l.reconciled_at IS NOT NULL),0)) AS nonce FROM chain_snapshot_reviews s
        WHERE s.portfolio_id=$1 AND s.wallet=$2 AND s.activated_revision IS NOT NULL
        ORDER BY s.activated_revision DESC LIMIT 1`,[context.portfolioId,context.market.wallet]);
      requireInput(r.rows[0]!==undefined&&BigInt(r.rows[0].nonce)===BigInt(state.nonce),
        "UNEXPLAINED_NONCE","Owner must acknowledge chain bootstrap or external activity before execution.");
    }
    return state;
  }
  async prepare(input: { sessionToken: string; planId: string; legIndex: number }) {
    const context = await this.transaction(c => this.context(c, input.sessionToken, input.planId, input.legIndex));
    requireInput(context.planStatus !== "reconciling", "UNRESOLVED_SUBMISSION", "Reconcile the prior leg first.");
    const evidence = await this.market.collect(context.market);
    const request: GateRequest = { ...context.market, now: this.now().toISOString(), evidence };
    const gate = evaluateMarketGate(request);
    if (!gate.allowed) return { kind: "blocked" as const, gate };
    requireInput(evidence.quote!.nativeFeeRaw >= this.deployment.maxGasLimit * this.deployment.maxFeePerGas,
      "FEE_BOUND", "Quoted native fee must cover the full approved signed-transaction gas ceiling.");
    const state = await this.chainState(context);
    const reviewId = randomUUID();
    const metadata: ApprovalMetadata = { portfolioId: context.portfolioId, planId: context.planId, legId: reviewId,
      policyHash: context.policyHash, transactionNonce: state.nonce, authorizationNonce: randomUUID(),
      maxGasLimit: this.deployment.maxGasLimit, maxFeePerGas: this.deployment.maxFeePerGas,
      expiresAt: new Date(Math.min(Date.parse(request.now) + this.deployment.approvalLifetimeMs,
        executionMarketExpiry(request), Date.parse(context.sessionExpiresAt))).toISOString() };
    const approval = prepareEoaLegApproval(request, metadata);
    await this.transaction(async client => {
      const current = await this.context(client, input.sessionToken, input.planId, input.legIndex);
      requireInput(current.hash === context.hash, "EXECUTION_CONTEXT_CHANGED", "Plan/policy/registry changed during collection.");
      await client.query(`INSERT INTO eoa_execution_reviews(id,portfolio_id,plan_id,reservation_id,leg_index,
        context_hash,request,metadata,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9)`,
      [reviewId, context.portfolioId, context.planId, context.reservationId, input.legIndex,
        context.hash, executionJson(request), executionJson(metadata), metadata.expiresAt]);
    });
    return { kind: "review" as const, reviewId, approval,
      ...(request.pilotProfile?{pilotAdmission:{mode:'owner-pilot' as const,profileRevision:request.pilotProfile.revision,
        maximumSpendUnits:request.pilotProfile.maximumSpendRaw.toString(),independentReview:'deferred' as const,
        referenceSourceAt:evidence.reference!.sourceAt,referenceAgeMs:Date.parse(request.now)-Date.parse(evidence.reference!.sourceAt),
        referenceBandBps:pilotPriceBand(request.pilotProfile,Date.parse(request.now)-Date.parse(evidence.reference!.sourceAt)),
        roundTripPassed:evidence.pilotRoundTrip!.success,
        scannerFindings:evidence.tokenSecurity!.flatMap(s=>s.providers.flatMap(p=>p.findings.map(f=>`${s.assetId}/${p.provider}: ${f}`))),
        unknownScannerChecks:evidence.tokenSecurity!.flatMap(s=>s.providers.flatMap(p=>Object.entries(p.coverage??{})
          .filter(([,value])=>value==='unknown').map(([key])=>`${s.assetId}/${p.provider}: ${key}`)))}}:{}) };
  }
  private async review(client: PoolClient, token: string, reviewId: string, lock = false) {
    identifier(reviewId);
    const session = await this.sessions.authenticate(token, this.now(), client);
    const result = await client.query<ReviewRow>(`SELECT r.* FROM eoa_execution_reviews r
      JOIN portfolios p ON p.id=r.portfolio_id WHERE r.id=$1 AND p.owner_wallet=$2 ${lock ? "FOR UPDATE OF r" : ""}`,
    [reviewId, session.wallet.toLowerCase()]);
    const row = result.rows[0];
    requireInput(row !== undefined, "REVIEW_UNAVAILABLE", "Owned server review required.");
    return row;
  }
  private async fresh(token: string, reviewId: string) {
    const value = await this.transaction(async client => {
      const row = await this.review(client, token, reviewId);
      requireInput(row.expires_at > this.now(), "APPROVAL_EXPIRED", "Review expired.");
      const context = await this.context(client, token, row.plan_id, row.leg_index);
      requireInput(context.hash === row.context_hash, "EXECUTION_CONTEXT_CHANGED", "Plan/policy/registry changed since review.");
      return { row, context };
    });
    const request = decodeExecutionJson<GateRequest>(value.row.request);
    const expected = decodeExecutionJson<ApprovalMetadata>(value.row.metadata);
    const recordedHash = securityDigest({ portfolioId: value.context.portfolioId, planId: value.context.planId,
      reservationId: value.context.reservationId, policyHash: value.context.policyHash,
      instrument: request.instrument, snapshot: request.snapshot, proposal: request.proposal, mapping: request.expectedMappingRevision });
    requireInput(recordedHash === value.row.context_hash && request.wallet === value.context.market.wallet
      && securityDigest(request.coordinatorPolicy) === securityDigest(value.context.market.coordinatorPolicy)
      && securityDigest(request.marketPolicy) === securityDigest(value.context.market.marketPolicy)
      && securityDigest(request.pilotProfile ?? null) === securityDigest(value.context.market.pilotProfile ?? null)
      && expected.portfolioId === value.context.portfolioId && expected.planId === value.context.planId
      && expected.legId === value.row.id && expected.policyHash === value.context.policyHash
      && Date.parse(expected.expiresAt) === value.row.expires_at.getTime()
      && expected.maxGasLimit === this.deployment.maxGasLimit && expected.maxFeePerGas === this.deployment.maxFeePerGas,
    "INVALID_EXECUTION_RECORD", "Stored review must bind the exact server-derived context and deployment.");
    const approval = prepareEoaLegApproval(request, expected);
    const evidence = await this.market.collect(value.context.market, request.evidence.quote!);
    const freshRequest = revalidateExecutionMarket(request, evidence, this.now().toISOString());
    const state = await this.chainState(value.context);
    requireInput(state.nonce === expected.transactionNonce, "CHAIN_STATE_CHANGED", "EOA nonce changed since review.");
    return { ...value, approval, expected, freshRequest,
      ...(request.marketPolicy.approvalClock === "refresh-before-submit" ? { approvedRequest: request } : {}) };
  }
  async persist(input: { sessionToken: string; reviewId: string; ownerSignature: string; rawSignedTransaction: string }) {
    const fresh = await this.fresh(input.sessionToken, input.reviewId);
    return this.transaction(async client => {
      const context = await this.context(client, input.sessionToken, fresh.row.plan_id, fresh.row.leg_index);
      const row = await this.review(client, input.sessionToken, input.reviewId, true);
      requireInput(context.hash === fresh.row.context_hash && row.context_hash === fresh.row.context_hash
        && row.expires_at > this.now(), "EXECUTION_CONTEXT_CHANGED", "Execution context changed before persistence.");
      if (context.planStatus === "reserved") await new Ledger(this.pool).startExecution(context.portfolioId, context.planId, client);
      const signed: PrepareSignedEoaLeg = { reservationId: context.reservationId, approval: fresh.approval,
        ...(fresh.approvedRequest ? { approvedRequest: fresh.approvedRequest } : {}),
        expected: fresh.expected, freshRequest: { ...fresh.freshRequest, now: this.now().toISOString() },
        ownerSignature: input.ownerSignature, rawSignedTransaction: input.rawSignedTransaction };
      const result = await new EoaExecutionStore(this.pool).persistSignedLeg(signed, client);
      requireInput(row.tx_hash === null || (row.tx_hash === result.hash && row.owner_signature === input.ownerSignature),
        "STORED_LEG_CHANGED", "A review cannot bind different signed bytes or approval.");
      await client.query("UPDATE eoa_execution_reviews SET owner_signature=$2,tx_hash=$3 WHERE id=$1",
        [row.id, input.ownerSignature, result.hash]);
      return result;
    });
  }
  async broadcast(input: { sessionToken: string; reviewId: string }) {
    requireInput(this.deployment.broadcastEnabled, "BROADCAST_DISABLED", "Deployment broadcasting is disabled.");
    const prior = await this.transaction(async client => {
      const row = await this.review(client, input.sessionToken, input.reviewId);
      const leg = await client.query<{ state: string; signed_transaction: string }>(
        "SELECT state,signed_transaction FROM eoa_execution_legs WHERE id=$1 AND tx_hash=$2", [row.id,row.tx_hash]);
      requireInput(leg.rows[0] !== undefined && row.owner_signature !== null && row.tx_hash !== null, "SIGNED_LEG_MISSING", "Persist signed leg before broadcast.");
      return { row, leg: leg.rows[0] };
    });
    if (prior.leg.state !== "signed") return { outcome: "already-claimed" as const, hash: prior.row.tx_hash! };
    const fresh = await this.fresh(input.sessionToken, input.reviewId);
    const claim = await this.transaction(async client => {
      const context = await this.context(client, input.sessionToken, fresh.row.plan_id, fresh.row.leg_index);
      requireInput(context.hash === fresh.row.context_hash && fresh.row.expires_at > this.now(),
        "EXECUTION_CONTEXT_CHANGED", "Context changed immediately before claim.");
      return new EoaExecutionStore(this.pool).claimBroadcastOnce({ reservationId: context.reservationId,
        ...(fresh.approvedRequest ? { approvedRequest: fresh.approvedRequest } : {}),
        approval: fresh.approval, expected: fresh.expected, freshRequest: { ...fresh.freshRequest, now: this.now().toISOString() },
        ownerSignature: prior.row.owner_signature!, rawSignedTransaction: prior.leg.signed_transaction }, client);
    });
    if (!claim) return { outcome: "already-claimed" as const, hash: prior.row.tx_hash! };
    let outcome: "accepted" | "unknown";
    try { outcome = await this.chain.send(claim); } catch { outcome = "unknown"; }
    try { await this.pool.query("INSERT INTO eoa_broadcast_results(review_id,outcome) VALUES($1,$2)", [prior.row.id, outcome]); }
    catch { outcome = "unknown"; } // A committed claim must never be undone by an outcome-write failure.
    return { outcome, hash: claim.hash };
  }
}
