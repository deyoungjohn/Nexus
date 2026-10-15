import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { getBytes, Wallet } from "ethers";
import { Pool } from "pg";
import { amount, nativeAssetId } from "../../src/domain/amount.js";
import type { Instrument } from "../../src/domain/instrument.js";
import { CoordinatorStore } from "../../src/coordinator/store.js";
import { Ledger } from "../../src/ledger/ledger.js";
import { RuleStore } from "../../src/rules/store.js";
import type { WorkspaceView } from "../../src/application/contracts.js";

test.skip(!process.env.NEXUS_E2E_SCHEMA,"Set TEST_DATABASE_URL for owner-authenticated browser/PostgreSQL tests.");
const origin = "http://localhost:3180";
async function inject(page:Page,chain = "0x38") {
  const owner = Wallet.createRandom();
  await page.exposeFunction("signNexusMessage",(hex:string) => owner.signMessage(getBytes(hex)));
  await page.addInitScript(({ address,chain }) => {
    (window as Window & { walletCalls?:string[] }).walletCalls = [];
    const listeners: Record<string,(() => void)[]> = {};
    (window as unknown as { walletListeners:typeof listeners }).walletListeners = listeners;
    Object.defineProperty(window,"ethereum",{ value:{
      on:(event:string,listener:() => void) => { (listeners[event] ??= []).push(listener); },
      removeListener:(event:string,listener:() => void) => { listeners[event] = (listeners[event] ?? []).filter(item => item !== listener); },
      request:async ({ method,params }: { method:string;params?:unknown[] }) => {
      (window as unknown as Window & { walletCalls:string[] }).walletCalls.push(method);
      if (method === "eth_accounts" || method === "eth_requestAccounts") return [address];
      if (method === "eth_chainId") return chain;
      if (method === "personal_sign") return (window as unknown as Window & { signNexusMessage:(hex:string) => Promise<string> }).signNexusMessage(params![0] as string);
      throw new Error(`Unexpected wallet method: ${method}`);
    } } });
  },{ address:owner.address,chain });
  return owner;
}
async function signin(page:Page) {
  await inject(page); await page.goto("/workspace");
  await page.getByRole("button",{ name:"Sign in with EOA",exact:true }).click();
  await expect(page.getByRole("button",{ name:"Create saved portfolio" })).toBeVisible();
  await page.getByRole("button",{ name:"Create saved portfolio" }).click();
  await expect(page.getByText("BALANCES NOT VERIFIED · PAUSED")).toBeVisible();
}
async function seedDecision(id:string) {
  const pool = new Pool({ connectionString:process.env.DATABASE_URL });
  try {
    const rows = await pool.query<{ revision:string;settlement_asset_id:string;settlement_decimals:number }>("SELECT revision,settlement_asset_id,settlement_decimals FROM portfolios WHERE id=$1",[id]);
    const row = rows.rows[0]!, settlement = { assetId:row.settlement_asset_id,decimals:row.settlement_decimals };
    const instrument = (await pool.query<{ body:Instrument }>("SELECT body FROM instruments LIMIT 1")).rows[0]!.body;
    const cash = amount(100n * 10n**18n,settlement), gas = amount(10n**18n,{ assetId:nativeAssetId(56),decimals:18 });
    let revision = await new Ledger(pool).recordBalances(id,BigInt(row.revision),[cash,gas,amount(0n,instrument)],"browser-fixture");
    await pool.query("UPDATE portfolios SET data_mode='fixture' WHERE id=$1",[id]);
    revision = await new CoordinatorStore(pool).activatePolicy({ portfolioId:id,expectedRevision:revision,policyId:`${id}-policy`,version:1,
      policy:{ minimumCash:amount(0n,settlement),feeAllowance:amount(0n,settlement),requiredNativeGas:amount(0n,gas),companyCapsBps:{},sectorCapsBps:{},issuerCapsBps:{} } });
    const result = await new RuleStore(pool).plan({ portfolioId:id,batchId:"browser-batch",expectedRevision:revision,
      now:new Date("2026-09-30T08:05:00Z"),leaseUntil:new Date(Date.now()+60000),references:{},events:{},
      snapshot:{ revision,sourceBlock:100n,valuationUnit:"fixture-USD",confirmedCash:cash,reservedCash:amount(0n,settlement),cashValueLower:cash.units,nativeGas:gas,
        positions:[{ instrument,raw:amount(0n,instrument),reservedRaw:amount(0n,instrument),valueLower:0n,valueUpper:0n,buyEligible:true,sellEligible:true }] },
      valuations:[{ instrumentId:instrument.instrumentId,settlementValueLowerNumerator:1n,settlementValueUpperNumerator:1n,settlementValueDenominator:1n,
        tokenValueLowerNumerator:1n,tokenValueUpperNumerator:1n,tokenValueDenominator:1n,tokenProceedsNumerator:1n,tokenProceedsDenominator:1n }] });
    expect(result.coordination?.reservedPlanId).toBeTruthy();
  } finally { await pool.end(); }
}

test("saved workspace signs in, persists a reviewed rule, reads P4 decisions and pauses the server", async ({ page }) => {
  await signin(page);
  const cookies = await page.context().cookies();
  const session = cookies.find(cookie => cookie.name === "nexus_session")!;
  expect(session.httpOnly).toBe(true); expect(session.sameSite).toBe("Strict");
  expect(await page.evaluate(() => document.cookie)).not.toContain("nexus_session");
  const nav = page.getByRole("navigation",{ name:"Saved workspace navigation" });
  await nav.getByRole("button",{ name:"Plan",exact:true }).click();
  await page.getByRole("button",{ name:"Save instruction for review" }).click();
  await expect(page.getByText("BASKET · VERSION 1 · READY_FOR_REVIEW")).toBeVisible();
  await expect(page.getByRole("button",{ name:"Activate reviewed rule" })).toBeDisabled();
  await page.getByLabel("I reviewed version 1 of basket.").check();
  await page.getByRole("button",{ name:"Activate reviewed rule" }).click();
  await expect(page.getByText("BASKET · VERSION 1 · ACTIVE")).toBeVisible();
  await nav.getByRole("button",{ name:"Settings",exact:true }).click();
  await page.getByRole("button",{ name:"Resume planning" }).click();
  await expect(page.getByRole("button",{ name:"Pause portfolio" })).toBeVisible();
  const current = await (await page.request.get("/api/workspace")).json() as WorkspaceView;
  await seedDecision(current.portfolio!.id);
  await page.getByRole("button",{ name:"Refresh records" }).click();
  await nav.getByRole("button",{ name:"Activity",exact:true }).click();
  await expect(page.getByText("No execution receipt has been recorded for this portfolio.")).toBeVisible();
  await expect(page.getByText(/coordination · revision/)).toBeVisible();
  await page.getByText("Saved evaluation and coordination").click();
  await expect(page.locator("pre").filter({ hasText:"browser-batch" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button",{ name:"Download saved JSON" }).click();
  const download = await downloadPromise;
  const record = JSON.parse(await readFile(await download.path(),"utf8"));
  expect(record.schema).toBe("nexus.workspace.v1"); expect(record.portfolio.rules[0].state).toBe("ACTIVE"); expect(record.portfolio.decisions).toHaveLength(1);
  expect(record.portfolio.dataMode).toBe("fixture"); expect(record.tradingEnabled).toBe(false); expect(record.portfolio.receipts).toHaveLength(0);
  await nav.getByRole("button",{ name:"Settings",exact:true }).click();
  await page.getByRole("button",{ name:"Pause portfolio" }).click();
  const methods = await page.evaluate(() => (window as unknown as Window & { walletCalls:string[] }).walletCalls);
  await page.reload();
  await expect(page.getByText("FIXTURE DATA · PAUSED")).toBeVisible();
  const paused = await (await page.request.get("/api/workspace")).json() as WorkspaceView;
  expect(paused.portfolio!.paused).toBe(true);
  expect(paused.portfolio!.balances.every(balance => balance.reservedUnits === "0")).toBe(true);
  await nav.getByRole("button",{ name:"Settings",exact:true }).click();
  await page.getByRole("button",{ name:"Sign out",exact:true }).click();
  await expect(page.getByRole("button",{ name:"Sign in with EOA",exact:true })).toBeVisible();
  expect((await page.request.get("/api/workspace")).status()).toBe(401);
  expect(methods).toContain("personal_sign"); expect(methods).not.toContain("eth_sendTransaction"); expect(methods).not.toContain("eth_signTypedData_v4");
});

test("HTTP boundary rejects cross-origin writes, replay, foreign portfolio and oversized commands", async ({ request }) => {
  const wallet = Wallet.createRandom();
  const challenge = await request.post("/api/session/challenge",{ headers:{ Origin:origin },data:{ wallet:wallet.address } });
  const body = await challenge.json();
  const signature = await wallet.signMessage(body.message);
  const verify = await request.post("/api/session/verify",{ headers:{ Origin:origin },data:{ id:body.id,signature } });
  expect(verify.status()).toBe(200); expect(await verify.json()).not.toHaveProperty("token");
  expect((await request.post("/api/session/verify",{ headers:{ Origin:origin },data:{ id:body.id,signature } })).status()).toBe(400);
  expect((await request.post("/api/workspace",{ headers:{ Origin:"https://evil.example" },data:{ kind:"create-portfolio" } })).status()).toBe(403);
  expect((await request.post("/api/workspace",{ data:{ kind:"create-portfolio" } })).status()).toBe(403);
  expect((await request.post("/api/workspace",{ headers:{ Origin:origin },data:{ kind:"create-portfolio",extra:"x".repeat(17000) } })).status()).toBe(413);
  expect((await request.get("/api/workspace?portfolio=foreign-portfolio")).status()).toBe(404);
  const response = await request.get("/api/workspace"); expect(response.headers()["cache-control"]).toBe("no-store");
  expect((await request.post("/api/execution",{headers:{Origin:"https://evil.example"},data:{kind:"prepare",planId:"plan",legIndex:0}})).status()).toBe(403);
  expect((await request.post("/api/execution",{headers:{Origin:origin},data:{kind:"prepare",planId:"plan",legIndex:0,evidence:{state:"clear"}}})).status()).toBe(400);
  expect((await request.post("/api/execution",{headers:{Origin:origin},data:{kind:"prepare",planId:"plan",legIndex:0}})).status()).toBe(503);
  expect((await request.get("/api/execution?portfolio=foreign-portfolio")).status()).toBe(404);
  for(const path of ['/api/chain-snapshot','/api/pilot-plan','/api/reanchor']){
    expect((await request.post(path,{headers:{Origin:'https://evil.example'},data:{}})).status()).toBe(403);
    expect((await request.post(path,{headers:{Origin:origin},data:{extra:'x'.repeat(17000)}})).status()).toBe(413);
  }
  expect((await request.get('/api/chain-snapshot?portfolio=foreign-portfolio')).status()).toBe(404);
  expect((await request.post('/api/reanchor',{headers:{Origin:origin},data:{kind:'prepare',portfolioId:'foreign',legId:'leg'}})).status()).toBe(404);
  expect((await request.post("/api/session/logout",{ headers:{ Origin:origin },data:{} })).status()).toBe(200);
  expect((await request.get("/api/workspace")).status()).toBe(401);
  expect((await request.get("/api/execution?portfolio=foreign-portfolio")).status()).toBe(401);
  expect((await request.post('/api/reanchor',{headers:{Origin:origin},data:{kind:'prepare',portfolioId:'foreign',legId:'leg'}})).status()).toBe(401);
  expect((await request.post('/api/pilot-plan',{headers:{Origin:origin},data:{portfolioId:'foreign',requestId:'request'}})).status()).toBe(401);
});

test("mobile sign-in rejects the wrong chain and preserves keyboard navigation", async ({ page }) => {
  await page.setViewportSize({ width:390,height:844 }); await inject(page,"0x1"); await page.goto("/workspace");
  await page.getByRole("button",{ name:"Sign in with EOA",exact:true }).click();
  await expect(page.locator(".error-banner")).toContainText("Switch your wallet to BNB Smart Chain");
  const methods = await page.evaluate(() => (window as unknown as Window & { walletCalls:string[] }).walletCalls);
  expect(methods).not.toContain("personal_sign");
  await page.getByRole("navigation",{ name:"Saved workspace navigation" }).getByRole("button",{ name:"Settings",exact:true }).focus();
  await expect(page.getByRole("button",{ name:"Settings",exact:true })).toBeFocused();
});


test("a delayed authenticated read cannot restore saved records after wallet change", async ({ page }) => {
  await signin(page);
  let fetched!:() => void, release!:() => void;
  const received = new Promise<void>(resolve => { fetched = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/workspace*",async route => {
    if (route.request().method() !== "GET") { await route.continue(); return; }
    const response = await route.fetch(); fetched(); await gate;
    await route.fulfill({ response });
  },{ times:1 });
  await page.getByRole("button",{ name:"Refresh records" }).click(); await received;
  await page.evaluate(() => {
    const listeners = (window as unknown as { walletListeners:Record<string,(() => void)[]> }).walletListeners;
    for (const listener of listeners.accountsChanged ?? []) listener();
  });
  await expect(page.getByRole("heading",{ name:"Sign in with your wallet" })).toBeVisible();
  await expect.poll(async () => (await page.request.get("/api/workspace")).status()).toBe(401);
  release();
  await expect(page.getByRole("button",{ name:"Sign in with EOA",exact:true })).toBeEnabled();
  await expect(page.getByRole("heading",{ name:"Sign in with your wallet" })).toBeVisible();
  await expect(page.getByText("BALANCES NOT VERIFIED · PAUSED")).toHaveCount(0);
});
