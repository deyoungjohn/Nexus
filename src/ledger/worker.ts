import { Ledger, type OutboxEvent } from "./ledger.js";
import { setTimeout as delay } from "node:timers/promises";

export type OutboxHandler = (event: OutboxEvent) => Promise<void>;

// Delivery is at least once. A handler must use eventKey for its own
// idempotency; a crash after its side effect but before acknowledgement replays.
export async function runOutboxOnce(
  ledger: Ledger, workerId: string, handler: OutboxHandler,
  leaseSeconds = 30, retrySeconds = 5
): Promise<boolean> {
  const event = await ledger.claimOutbox(workerId, leaseSeconds);
  if (!event) return false;
  try {
    await handler(event);
    if (!await ledger.acknowledgeOutbox(event.id, workerId)) {
      throw new Error(`Outbox lease lost before acknowledgement: ${event.eventKey}`);
    }
    return true;
  } catch (error) {
    await ledger.retryOutbox(event.id, workerId, retrySeconds);
    throw error;
  }
}

export async function runOutboxWorker(
  ledger: Ledger, workerId: string, handler: OutboxHandler, signal: AbortSignal,
  pollMilliseconds = 1000
): Promise<void> {
  while (!signal.aborted) {
    try {
      if (await runOutboxOnce(ledger, workerId, handler)) continue;
    } catch {
      // The event was scheduled for retry; keep the durable worker alive.
    }
    try {
      await delay(pollMilliseconds, undefined, { signal });
    } catch {
      // Abort only interrupts the idle wait; the loop checks the signal.
    }
  }
}
