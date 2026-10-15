import { Transaction } from 'ethers';
import { DomainError, requireInput } from '../domain/errors.js';
import { eoaApprovalTypedData, type EoaLegApproval } from '../execution/signing-payload.js';
import type { RunnerEvidence } from './runner-evidence.js';
import type { PilotSigner } from './runner-input.js';

export type RunnerConfirm = (action: string, details: unknown) => Promise<boolean>;
export interface RunnerLeg { readonly id: string; readonly state: string; readonly hash: string; readonly portfolioId: string }
export interface PilotTradePorts {
  existingLeg(): Promise<RunnerLeg | null>;
  authenticate(signer: PilotSigner, confirm: RunnerConfirm): Promise<void>;
  initialize(signer: PilotSigner, confirm: RunnerConfirm): Promise<string>;
  plan(portfolioId: string, requestId: string): Promise<{ planId: string }>;
  prepare(planId: string): Promise<{ kind: 'blocked'; gate: unknown } | { kind: 'review'; reviewId: string; approval: EoaLegApproval; pilotAdmission?: unknown }>;
  persist(reviewId: string, signature: string, raw: string): Promise<unknown>;
  broadcast(reviewId: string): Promise<unknown>;
  recover(leg: RunnerLeg): Promise<{ complete: boolean; incident: boolean }>;
  accounting(leg: RunnerLeg): Promise<unknown>;
}
export async function confirmRunnerAction(confirm: RunnerConfirm, evidence: RunnerEvidence, action: string, details: unknown): Promise<void> {
  await evidence.append(`${action.toLowerCase()}.review`, details);
  requireInput(await confirm(action, details), 'OPERATOR_CANCELLED', 'Operator did not confirm this exact action.');
  await evidence.append(`${action.toLowerCase()}.confirmed`, { action });
}
export function assertPilotSigner(signer: PilotSigner, wallet: string): void {
  requireInput(signer.address.toLowerCase() === wallet, 'PILOT_WALLET_MISMATCH', 'Private key must match the configured intended EOA.');
}
export async function signRunnerSwap(signer: PilotSigner, approval: EoaLegApproval): Promise<{ ownerSignature: string; rawSignedTransaction: string }> {
  assertPilotSigner(signer, approval.wallet.toLowerCase());
  const typed = eoaApprovalTypedData(approval);
  const ownerSignature = await signer.signTypedData(typed.domain, typed.types, typed.value);
  const rawSignedTransaction = await signer.signTransaction({ type: 2, chainId: 56, to: approval.router, data: approval.calldata,
    value: approval.value, nonce: approval.transactionNonce, gasLimit: approval.maxGasLimit,
    maxFeePerGas: approval.maxFeePerGas, maxPriorityFeePerGas: 0n });
  const tx = Transaction.from(rawSignedTransaction);
  requireInput(tx.isSigned() && tx.chainId === 56n && tx.value === 0n && tx.from?.toLowerCase() === signer.address.toLowerCase(),
    'INVALID_SIGNED_TRANSACTION', 'Exact signed BSC transaction required.');
  return { ownerSignature, rawSignedTransaction };
}

/** One buy through production services, followed by recovery and a fresh no-duplicate check. */
export async function runPilotTrade(input: { wallet: string; signer: PilotSigner; ports: PilotTradePorts;
  evidence: RunnerEvidence; confirm: RunnerConfirm; requestId: string }): Promise<'complete' | 'pending'> {
  const { signer, ports, evidence, confirm } = input;
  assertPilotSigner(signer, input.wallet);
  let leg = await ports.existingLeg();
  if (leg) {
    await evidence.append('trade.resume', leg);
    // A claimed or ambiguous send is ONLY recovered. Never sign another nonce or resend.
    if (leg.state === 'signed') {
      await ports.authenticate(signer, confirm);
      await confirmRunnerAction(confirm, evidence, 'SEND-STORED', leg);
      await evidence.append('trade.submit-requested', { reviewId: leg.id, hash: leg.hash });
      await evidence.append('trade.broadcast', await ports.broadcast(leg.id));
    }
  } else {
    await ports.authenticate(signer, confirm);
    const portfolioId = await ports.initialize(signer, confirm);
    const plan = await ports.plan(portfolioId, input.requestId);
    await evidence.append('trade.plan', plan);
    const review = await ports.prepare(plan.planId);
    await evidence.save('trade-review.json', review);
    await evidence.append('trade.prepare', review);
    if (review.kind === 'blocked') throw new DomainError('MARKET_GATE_BLOCKED', 'Current production market gate blocks this trade.');
    await confirmRunnerAction(confirm, evidence, 'SIGN-TRADE', review);
    const signed = await signRunnerSwap(signer, review.approval);
    // PostgreSQL is the authority: private artifacts cannot authorize sending.
    await evidence.append('trade.signed', { reviewId: review.reviewId, hash: Transaction.from(signed.rawSignedTransaction).hash });
    await evidence.append('trade.persisted', await ports.persist(review.reviewId, signed.ownerSignature, signed.rawSignedTransaction));
    leg = { id: review.reviewId, state: 'signed', hash: Transaction.from(signed.rawSignedTransaction).hash!, portfolioId };
    await confirmRunnerAction(confirm, evidence, 'SEND-TRADE', { ...leg, approval: review.approval });
    await evidence.append('trade.submit-requested', leg);
    await evidence.append('trade.broadcast', await ports.broadcast(review.reviewId));
  }
  const recovered = await ports.recover(leg);
  if (recovered.incident) throw new DomainError('PILOT_INCIDENT_REQUIRES_REVIEW', 'Recovery identified an incident; no further transactions are sent.');
  if (!recovered.complete) { await evidence.append('acceptance.pending', leg); return 'pending'; }
  const before = await ports.accounting(leg);
  await evidence.save('accounting-before-restart.json', before);
  // Runtime implementation creates a fresh recovery invocation, like a restarted worker.
  const restarted = await ports.recover(leg);
  const after = await ports.accounting(leg);
  await evidence.save('accounting-after-restart.json', after);
  requireInput(restarted.complete && !restarted.incident && JSON.stringify(before) === JSON.stringify(after),
    'RECOVERY_REPLAY_CHANGED_ACCOUNTING', 'Restart verification must preserve accounting, fill proof and broadcast claim.');
  await evidence.append('acceptance.complete', { legId: leg.id, hash: leg.hash, restartAccountingUnchanged: true });
  return 'complete';
}
