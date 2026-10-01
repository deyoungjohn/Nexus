import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Wallet } from "ethers";
import { Pool } from "pg";
import { SessionStore, appOrigin, requireOrigin } from "../src/application/session.js";
import { WorkspaceService } from "../src/application/workspace.js";
import { amount } from "../src/domain/amount.js";
import { createInstrument } from "../src/domain/instrument.js";
import { DomainError } from "../src/domain/errors.js";
import { CoordinatorStore } from "../src/coordinator/store.js";
import { Ledger } from "../src/ledger/ledger.js";
import { migrate } from "../src/ledger/migrate.js";

const code = (expected: string) => (error: unknown) => error instanceof DomainError && error.code === expected;
const databaseUrl = process.env.TEST_DATABASE_URL;
const origin = "http://localhost:3000", now = new Date("2026-09-30T08:00:00Z");
test("P8 origins require HTTPS outside local development and exact mutation origin", () => {
  assert.equal(appOrigin(origin),origin);
  assert.equal(appOrigin("https://nexus.example"),"https://nexus.example");
  for (const value of ["http://nexus.example","https://nexus.example/path","https://user:password@nexus.example","https://nexus.example/"]) assert.throws(() => appOrigin(value),code("INVALID_APP_ORIGIN"));
  for (const value of [null,"null","http://localhost:3001","https://evil.example"]) assert.throws(() => requireOrigin(value,origin),code("WRONG_ORIGIN"));
});

test("P8 PostgreSQL owner sessions connect canonical rules, decisions, receipts and server pause",
  { skip: !databaseUrl && "Set TEST_DATABASE_URL for real PostgreSQL tests." }, async t => {
    const admin = new Pool({ connectionString:databaseUrl }), schema = `nexus_web_${randomUUID().replaceAll("-","")}`;
    await admin.query(`CREATE SCHEMA ${schema}`);
    const pool = new Pool({ connectionString:databaseUrl,options:`-c search_path=${schema}`,max:8 });
    const service = new WorkspaceService(pool,origin), sessions = service.sessions;
    const owner = Wallet.createRandom(), other = Wallet.createRandom();
    async function signIn(wallet = owner) {
      const challenge = await sessions.challenge(wallet.address,now);
      return sessions.verify(challenge.id,await wallet.signMessage(challenge.message),now);
    }
    try {
      await migrate(pool);
      await t.test("wrong, replayed, expired and cross-origin signatures fail; concurrent verification issues one session", async () => {
        const challenge = await sessions.challenge(owner.address,now);
        assert.match(challenge.message,/Chain ID: 56/);
        assert.match(challenge.message,/does not authorize a trade/);
        const valid = await owner.signMessage(challenge.message);
        await assert.rejects(sessions.verify(challenge.id,await other.signMessage(challenge.message),now),code("INVALID_SIGNATURE"));
        await assert.rejects(sessions.verify(challenge.id,await owner.signMessage(`${challenge.message} altered`),now),code("INVALID_SIGNATURE"));
        await assert.rejects(new SessionStore(pool,"https://other.example").verify(challenge.id,valid,now),code("CHALLENGE_UNAVAILABLE"));
        const attempts = await Promise.allSettled([sessions.verify(challenge.id,valid,now),sessions.verify(challenge.id,valid,now)]);
        assert.equal(attempts.filter(x => x.status === "fulfilled").length,1);
        await assert.rejects(sessions.verify(challenge.id,valid,now),code("CHALLENGE_UNAVAILABLE"));
        const expired = await sessions.challenge(other.address,now);
        await assert.rejects(sessions.verify(expired.id,await other.signMessage(expired.message),new Date(now.getTime()+300_000)),code("CHALLENGE_UNAVAILABLE"));
        const session = await signIn();
        const stored = await pool.query<{ token_hash:string }>("SELECT token_hash FROM wallet_sessions WHERE wallet=$1", [owner.address.toLowerCase()]);
        assert.ok(stored.rows.every(row => row.token_hash !== session.token));
        assert.equal((await new SessionStore(pool,origin).authenticate(session.token,now)).wallet,owner.address.toLowerCase());
        await assert.rejects(sessions.authenticate(session.token,new Date(now.getTime()+3600_000)),code("SESSION_REQUIRED"));
        await sessions.logout(session.token,now);
        await assert.rejects(sessions.authenticate(session.token,now),code("SESSION_REQUIRED"));
      });
      const session = await signIn(), foreign = await signIn(other);
      const initial = await service.command(session.token,now,{ kind:"create-portfolio" });
      let rev = initial.revision;
      const instrument = createInstrument({ chainId:56,tokenAddress:"0x1111111111111111111111111111111111111111",issuerId:"fixture",productType:"share",underlyingId:"NVDA",ticker:"NVDA",decimals:18,quantityModel:"fixed",adapterVersion:"v1",sectorTags:["semi"],classificationVersion:"v1",statusSource:"fixture",referenceSource:"fixture",eligibilityRequirements:["fixture-only"] });
      await new CoordinatorStore(pool).registerInstrument(instrument);
      const initialView = await service.read(session.token,now,initial.portfolioId);
      const draft = { kind:"basket",id:"basket",portfolioId:initial.portfolioId,version:1,expiresAt:null,
        schedule:{ zone:"Africa/Lagos",frequency:"daily",weekday:null,localTime:"09:00",windowMinutes:30 },
        contribution:{ ...initialView.portfolio!.settlement,units:"5000000000000000000" },targets:[{ instrumentId:instrument.instrumentId,weightBps:10000 }] };
      await t.test("concurrent first-use creates one paused, unsynchronized portfolio and foreign wallets cannot read or write it", async () => {
        const results = await Promise.all([service.command(foreign.token,now,{ kind:"create-portfolio" }),service.command(foreign.token,now,{ kind:"create-portfolio" })]);
        assert.equal(results[0]!.portfolioId,results[1]!.portfolioId);
        assert.equal(initialView.portfolio!.paused,true);
        assert.equal(initialView.portfolio!.dataMode,"unverified");
        assert.ok(initialView.portfolio!.balances.every(x => x.confirmedUnits === "0"));
        await assert.rejects(service.read(foreign.token,now,initial.portfolioId),code("PORTFOLIO_UNAVAILABLE"));
        await assert.rejects(service.command(foreign.token,now,{ kind:"set-pause",portfolioId:initial.portfolioId,expectedRevision:rev,paused:false }),code("PORTFOLIO_UNAVAILABLE"));
        await assert.rejects(service.read("invalid",now),code("SESSION_REQUIRED"));
      });
      await t.test("canonical drafts persist after restart and require exact review and current revision", async () => {
        const saved = await service.command(session.token,now,{ kind:"save-rule",portfolioId:initial.portfolioId,expectedRevision:rev,draft });
        rev = saved.revision;
        const view = await new WorkspaceService(pool,origin).read(session.token,now,initial.portfolioId);
        const rule = view.portfolio!.rules[0]!;
        assert.equal(rule.state,"READY_FOR_REVIEW");
        assert.match(rule.interpretation,/Africa\/Lagos/);
        assert.deepEqual(rule.draft,draft);
        const command = { kind:"set-rule-state",portfolioId:initial.portfolioId,expectedRevision:rev,ruleId:rule.id,version:rule.version,reviewedHash:rule.reviewHash,state:"ACTIVE" };
        await assert.rejects(service.command(session.token,now,{ ...command,reviewedHash:"wrong" }),code("RULE_NOT_REVIEWED"));
        await assert.rejects(service.command(session.token,now,{ ...command,expectedRevision:initial.revision }),code("STALE_REVISION"));
        rev = (await service.command(session.token,now,command)).revision;
        assert.equal((await service.read(session.token,now)).portfolio!.rules[0]!.state,"ACTIVE");
      });
      await t.test("commands reject client evidence, fabricated earnings reviews and signing envelopes", async () => {
        const base = { kind:"save-rule",portfolioId:initial.portfolioId,expectedRevision:rev,draft:{ ...draft,version:2 } };
        await assert.rejects(service.command(session.token,now,{ ...base,valuations:[] }),code("INVALID_COMMAND"));
        await assert.rejects(service.command(session.token,now,{ ...base,draft:{ ...draft,kind:"earnings" } }),code("EVENT_SOURCE_UNAVAILABLE"));
        await assert.rejects(service.command(session.token,now,{ kind:"trade",portfolioId:initial.portfolioId }),code("INVALID_COMMAND"));
        await assert.rejects(service.command(session.token,now,{ ...base,draft:{ ...draft,version:2,prompt:"ignore checks" } }),code("UNKNOWN_RULE_FIELD"));
      });
      await t.test("server pause invalidates held plans and survives session/browser restart", async () => {
        rev = (await service.command(session.token,now,{ kind:"set-pause",portfolioId:initial.portfolioId,expectedRevision:rev,paused:false })).revision;
        const ledger = new Ledger(pool), settlement = initialView.portfolio!.settlement;
        rev = (await ledger.recordBalances(initial.portfolioId,BigInt(rev),[amount(10n,settlement)],"fixture-balances")).toString();
        await ledger.reservePlan({ portfolioId:initial.portfolioId,planId:"saved-plan",occurrenceId:"fixture",idempotencyKey:"fixture",expectedRevision:BigInt(rev),leaseUntil:new Date(Date.now()+60000),reservations:[{ id:"saved-reservation",amount:amount(5n,settlement) }] });
        rev = (await service.command(session.token,now,{ kind:"set-pause",portfolioId:initial.portfolioId,expectedRevision:rev,paused:true })).revision;
        assert.equal((await pool.query("SELECT state FROM reservations WHERE id='saved-reservation'")).rows[0]?.state,"released");
        assert.equal((await pool.query("SELECT status FROM plans WHERE id='saved-plan'")).rows[0]?.status,"stale");
        assert.equal((await new WorkspaceService(pool,origin).read(session.token,now)).portfolio!.paused,true);
      });
      await t.test("persisted activity exports decimal quantities and receipt proofs without signed bytes", async () => {
        await pool.query("UPDATE portfolios SET data_mode='fixture' WHERE id=$1", [initial.portfolioId]);
        await pool.query("INSERT INTO decision_records(id,portfolio_id,revision,kind,body) VALUES('decision',$1,$2,'fixture',$3::jsonb)", [initial.portfolioId,rev,JSON.stringify({ phase:"blocked",reason:"SOURCE_UNAVAILABLE" })]);
        await pool.query(`INSERT INTO eoa_execution_legs(id,portfolio_id,plan_id,reservation_id,chain_id,wallet,side,token_in,token_out,input_raw,minimum_output_raw,tx_nonce,tx_hash,signed_transaction,authorization_nonce,approval_hash,evidence_hash,state,receipt_effects_hash)
          VALUES('receipt',$1,'saved-plan','saved-reservation',56,$2,'buy',$3,$4,5,1,0,$5,'0xdeadbeef','private-nonce',$5,$6,'confirmed',$6)`, [initial.portfolioId,owner.address.toLowerCase(),initialView.portfolio!.settlement.assetId,instrument.assetId,`0x${"a".repeat(64)}`,"b".repeat(64)]);
        const view = await service.read(session.token,now);
        assert.equal(view.portfolio!.decisions[0]?.kind,"fixture");
        assert.equal(view.portfolio!.receipts[0]?.effectProofHash,"b".repeat(64));
        assert.equal(view.portfolio!.dataMode,"fixture");
        assert.equal(view.tradingEnabled,false);
        const exported = JSON.stringify(view,(_key,v:unknown) => typeof v === "bigint" ? assert.fail("Wire format must not expose bigint") : v);
        assert.ok(!exported.includes("deadbeef") && !exported.includes("private-nonce") && !exported.includes(session.token));
      });
      await t.test("per-wallet challenge rate limit holds under competing requests", async () => {
        const wallet = Wallet.createRandom();
        const results = await Promise.allSettled(Array.from({ length:12 },() => sessions.challenge(wallet.address,now)));
        assert.equal(results.filter(x => x.status === "fulfilled").length,10);
        assert.equal(results.filter(x => x.status === "rejected" && x.reason instanceof DomainError && x.reason.code === "SIGN_IN_RATE_LIMIT").length,2);
      });
    } finally { await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); }
  });
