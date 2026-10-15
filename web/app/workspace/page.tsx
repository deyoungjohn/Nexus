"use client";

import ExecutionPanel from "../../components/execution-panel";
import PilotPanel from "../../components/pilot-panel";
import { useEffect, useRef, useState } from "react";
import type { WorkspaceView, SavedRuleView } from "../../../src/application/contracts";
import { decimalUnits, formattedUnits, targetBps } from "../../lib/saved-workflow";

type View = "overview" | "plan" | "review" | "activity" | "settings";
const views: View[] = ["overview","plan","review","activity","settings"];
interface WalletProvider {
  request(args: { method:string; params?:unknown[] }): Promise<unknown>;
  on?(event:string,listener:() => void): void;
  removeListener?(event:string,listener:() => void): void;
}
function walletProvider(): WalletProvider {
  const candidate = (window as Window & { ethereum?:WalletProvider }).ethereum;
  if (!candidate || typeof candidate.request !== "function") throw new Error("Open Nexus in a browser with an EOA wallet extension.");
  return candidate;
}
class ApiError extends Error { constructor(message:string,readonly code:string) { super(message); } }
async function api<T>(path:string,body?:unknown): Promise<T> {
  const response = await fetch(path,{ method:body === undefined ? "GET" : "POST",credentials:"same-origin",cache:"no-store",
    ...(body === undefined ? {} : { headers:{ "Content-Type":"application/json" },body:JSON.stringify(body) }) });
  const record = await response.json();
  if (!response.ok) throw new ApiError(record.error ?? "Request failed.",record.code ?? "REQUEST_FAILED");
  return record as T;
}
const jsonText = (value:unknown) => JSON.stringify(value,null,2);
function download(view:WorkspaceView): void {
  const record = { schema:"nexus.workspace.v1",generatedAt:new Date().toISOString(),
    notice:"Owner-scoped database records. Data provenance is shown per portfolio. No trading authority is included.",
    ...view };
  const url = URL.createObjectURL(new Blob([jsonText(record)],{ type:"application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = "nexus-workspace-record.json"; link.click(); URL.revokeObjectURL(url);
}
function RecordDetails({ label,value }: { label:string;value:unknown }) {
  return <details className="record-details"><summary>{label}</summary><pre>{jsonText(value)}</pre></details>;
}
function RuleCard({ rule,checked,setChecked,change,busy }: { rule:SavedRuleView;checked:boolean;setChecked:(value:boolean) => void;change:(state:"ACTIVE"|"PAUSED") => void;busy:boolean }) {
  return <article className="card receipt">
    <span className="panel-kicker">{rule.kind.toUpperCase()} · VERSION {rule.version} · {rule.state}</span>
    <h2>{rule.id}</h2><p>{rule.interpretation}</p>
    <RecordDetails label="Exact saved instruction and review hash" value={{ draft:rule.draft,reviewHash:rule.reviewHash,eventRevision:rule.eventRevision }} />
    <label className="checkbox-label"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} disabled={busy} />I reviewed version {rule.version} of {rule.id}.</label>
    <button type="button" className="secondary" disabled={busy || !checked} onClick={() => change(rule.state === "ACTIVE" ? "PAUSED" : "ACTIVE")}>{rule.state === "ACTIVE" ? "Pause rule" : "Activate reviewed rule"}</button>
    <small>Activation enables evaluation. Each trade requires its own valid execution approval.</small>
  </article>;
}

export default function SavedWorkspace() {
  const [view,setView] = useState<View>("overview"), [data,setData] = useState<WorkspaceView|null>(null);
  const [loading,setLoading] = useState(true), [busy,setBusy] = useState(false), [error,setError] = useState("");
  const [notice,setNotice] = useState(""), [checked,setChecked] = useState<Set<string>>(new Set());
  const [ruleKind,setRuleKind] = useState("basket"), [ruleId,setRuleId] = useState("basket"), [quantity,setQuantity] = useState("5");
  const [frequency,setFrequency] = useState("daily"), [weekday,setWeekday] = useState("1"), [localTime,setLocalTime] = useState("09:00");
  const [zone,setZone] = useState("Africa/Lagos"), [windowMinutes,setWindowMinutes] = useState("30"), [weights,setWeights] = useState<Record<string,string>>({});
  const [selectedInstrument,setSelectedInstrument] = useState(""), [side,setSide] = useState("buy"), [comparator,setComparator] = useState("at-or-below"), [threshold,setThreshold] = useState("100");
  const generation = useRef(0), sessionBlocked = useRef(false), pendingLogout = useRef<Promise<unknown>>(Promise.resolve());
  const portfolio = data?.portfolio;
  async function load(selected?:string): Promise<void> {
    if (sessionBlocked.current) return;
    const started = generation.current;
    try {
      const result = await api<WorkspaceView>(`/api/workspace${selected ? `?portfolio=${encodeURIComponent(selected)}` : ""}`);
      if (started === generation.current && !sessionBlocked.current) setData(result);
    } catch (issue) {
      if (issue instanceof ApiError && issue.code === "SESSION_REQUIRED") { if (started === generation.current) setData(null); return; }
      throw issue;
    } finally { setLoading(false); }
  }
  useEffect(() => {
    let mounted = true;
    load().catch(issue => { if (mounted) setError(issue instanceof Error ? issue.message : "Workspace unavailable."); });
    return () => { mounted = false; generation.current++; };
  },[]);
  useEffect(() => {
    if (!data) return;
    const timer = setInterval(() => { load(portfolio?.id).catch(() => { /* Keep the last record until an explicit refresh. */ }); },30_000);
    return () => clearInterval(timer);
  },[data?.wallet,portfolio?.id]);
  useEffect(() => {
    const instruments = data?.instruments ?? [];
    if (instruments.length && !selectedInstrument) setSelectedInstrument(instruments[0].instrumentId);
    if (instruments.length && !Object.keys(weights).length) setWeights({ [instruments[0].instrumentId]:"100" });
  },[data?.instruments,selectedInstrument,weights]);
  useEffect(() => {
    let injected:WalletProvider;
    try { injected = walletProvider(); } catch { return; }
    const changed = () => {
      generation.current++; sessionBlocked.current = true; setData(null); setChecked(new Set()); setNotice("Wallet connection changed. Sign in again to open saved records.");
      pendingLogout.current = api("/api/session/logout",{}).catch(() => { /* The server also expires sessions independently. */ });
    };
    injected.on?.("accountsChanged",changed); injected.on?.("chainChanged",changed);
    return () => { injected.removeListener?.("accountsChanged",changed); injected.removeListener?.("chainChanged",changed); };
  },[]);
  async function run(action:() => Promise<void>): Promise<void> {
    setBusy(true); setError(""); setNotice("");
    try { await action(); }
    catch (issue) {
      if (issue instanceof ApiError && issue.code === "SESSION_REQUIRED") setData(null);
      setError(issue instanceof Error ? issue.message : "Request failed.");
    } finally { setBusy(false); }
  }
  async function signin(): Promise<void> {
    await pendingLogout.current;
    const started = generation.current;
    const injected = walletProvider();
    const accounts = await injected.request({ method:"eth_requestAccounts" });
    if (!Array.isArray(accounts) || typeof accounts[0] !== "string") throw new Error("The wallet did not share an account.");
    if (await injected.request({ method:"eth_chainId" }) !== "0x38") throw new Error("Switch your wallet to BNB Smart Chain (chain 56), then sign in.");
    const wallet = accounts[0];
    const challenge = await api<{ id:string;message:string }>("/api/session/challenge",{ wallet });
    const encoded = "0x" + Array.from(new TextEncoder().encode(challenge.message),byte => byte.toString(16).padStart(2,"0")).join("");
    const signature = await injected.request({ method:"personal_sign",params:[encoded,wallet] });
    const current = await injected.request({ method:"eth_accounts" });
    if (!Array.isArray(current) || current[0]?.toLowerCase() !== wallet.toLowerCase() || await injected.request({ method:"eth_chainId" }) !== "0x38") throw new Error("The wallet account or chain changed. Start a new sign-in request.");
    if (started !== generation.current) throw new Error("The wallet connection changed. Start a new sign-in request.");
    await api("/api/session/verify",{ id:challenge.id,signature });
    if (started !== generation.current) { await api("/api/session/logout",{}); throw new Error("The wallet connection changed. Sign in again."); }
    sessionBlocked.current = false; await load();
    setNotice("Signed in. This signature grants access to saved records and rule settings.");
  }
  async function command(body:Record<string,unknown>): Promise<void> {
    if (!portfolio) throw new Error("Create or select a portfolio first.");
    await api("/api/workspace",{ ...body,portfolioId:portfolio.id,expectedRevision:portfolio.revision });
    await load(portfolio.id);
  }
  async function saveRule(): Promise<void> {
    if (!portfolio || !data) throw new Error("Create a portfolio first.");
    const current = portfolio.rules.find(rule => rule.id === ruleId);
    const common = { kind:ruleKind,id:ruleId,portfolioId:portfolio.id,version:(current?.version ?? 0)+1,expiresAt:null };
    let draft:unknown;
    if (ruleKind === "basket") {
      const targets = Object.entries(weights).filter(([,weight]) => weight !== "").map(([instrumentId,weight]) => ({ instrumentId,weightBps:targetBps(weight) })).filter(target => target.weightBps > 0);
      if (targets.reduce((sum,target) => sum+target.weightBps,0) !== 10000) throw new Error("Target weights must add to 100%.");
      draft = { ...common,schedule:{ zone,frequency,weekday:frequency === "weekly" ? Number(weekday) : null,localTime,windowMinutes:Number(windowMinutes) },
        contribution:{ ...portfolio.settlement,units:decimalUnits(quantity,portfolio.settlement.decimals) },targets };
    } else {
      const instrument = data.instruments.find(item => item.instrumentId === selectedInstrument);
      if (!instrument) throw new Error("Choose a registered instrument.");
      const denomination = side === "buy" ? portfolio.settlement : { assetId:instrument.assetId,decimals:instrument.decimals };
      draft = { ...common,instrumentId:instrument.instrumentId,side,comparator,pricePerShareRaw:decimalUnits(threshold,18),
        quantity:{ ...denomination,units:decimalUnits(quantity,denomination.decimals) },referenceSource:instrument.referenceSource,maxReferenceAgeMs:60000 };
    }
    await command({ kind:"save-rule",draft }); setView("review"); setNotice("Instruction saved for review. It has not authorized a trade.");
  }
  return <div className="workspace saved-workspace">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark" aria-hidden="true">N</span><span>NEXUS<small>SAVED WORKSPACE</small></span></div>
      <nav className="nav-list" aria-label="Saved workspace navigation">{views.map((item,index) => <button type="button" key={item} className={`nav-item ${view === item ? "active" : ""}`} aria-current={view === item ? "page" : undefined} onClick={() => setView(item)}><span className="nav-number" aria-hidden="true">0{index+1}</span>{item[0].toUpperCase()+item.slice(1)}</button>)}</nav>
      <div className="sidebar-bottom">LIVE EXECUTION BLOCKED<p>Saved rules and records use the server. Trading awaits live evidence and recovery gates.</p><a className="inline-link" href="/">Open fixture walkthrough ↗</a></div>
    </aside>
    <main className="main">
      <div className="topbar"><div className="breadcrumb">SAVED <span>/</span> {view.toUpperCase()}</div><span className="mode-pill">● SERVER RECORDS</span></div>
      <div className="content">
        <span className="eyebrow">YOUR INSTRUCTIONS · YOUR RECORDS</span><h1>{view[0].toUpperCase()+view.slice(1)}</h1>
        <p className="lead">Rules persist across devices and restarts. Every trade still needs current market evidence and a separate approval.</p>
        {error && <div className="error-banner" role="alert">{error}</div>}{notice && <div className="notice" role="status">{notice}</div>}
        {loading ? <p role="status">Loading saved workspace…</p> : !data ? <section className="empty-state"><h2>Sign in with your wallet</h2><p>Use an EOA wallet on BNB Smart Chain. You will sign a five-minute sign-in request for this site. The session lasts one hour.</p><p>The signature proves wallet control. Provider eligibility and trading approval are separate.</p><button type="button" className="primary" disabled={busy} onClick={() => run(signin)}>{busy ? "Waiting for wallet…" : "Sign in with EOA"}</button><p><a className="inline-link" href="/">Open fixture walkthrough ↗</a></p></section> : <>
          <div className="session-toolbar"><span>Wallet {data.wallet.slice(0,6)}…{data.wallet.slice(-4)} · session until {new Date(data.sessionExpiresAt).toLocaleTimeString()}</span><button type="button" className="text-button" disabled={busy} onClick={() => run(async () => { await load(portfolio?.id); setNotice("Server records refreshed."); })}>Refresh records</button></div>
          {data.portfolios.length > 1 && <label>Portfolio<select value={portfolio?.id ?? ""} disabled={busy} onChange={event => run(() => load(event.target.value))}>{data.portfolios.map(item => <option key={item.id} value={item.id}>{item.id}</option>)}</select></label>}
          {!portfolio ? <section className="empty-state"><h2>No saved portfolio yet</h2><p>Create a paused BSC portfolio with USDT settlement. Balances remain unsynchronized until a trusted chain reader imports them.</p><button type="button" className="primary" disabled={busy} onClick={() => run(async () => { const created = await api<{ portfolioId:string }>("/api/workspace",{ kind:"create-portfolio" }); await load(created.portfolioId); })}>Create saved portfolio</button></section> : <>
            <div className="review-warning"><strong>{portfolio.dataMode === "fixture" ? "FIXTURE DATA" : portfolio.dataMode === "chain" ? "CHAIN-SOURCED RECORDS" : "BALANCES NOT VERIFIED"} · {portfolio.paused ? "PAUSED" : "PLANNING RESUMED"}</strong><p>{portfolio.dataMode === "unverified" ? "These balances have no verified chain provenance. Zero is not a wallet balance check." : "Provenance labels describe persisted records; inspect the receipt and evidence before relying on an outcome."} Live trading is unavailable.</p></div>
            {view === "overview" && <>
              <div className="metric-grid"><div className="metric"><span>Portfolio revision</span><strong>{portfolio.revision}</strong><small>Changes invalidate unsigned plans.</small></div><div className="metric"><span>Active rules</span><strong>{portfolio.rules.filter(rule => rule.state === "ACTIVE").length}</strong><small>{portfolio.rules.length} saved instructions</small></div><div className="metric"><span>Portfolio policy</span><strong>{portfolio.policyConfigured ? "Configured" : "Required"}</strong><small>Policy and market evidence are server-owned.</small></div></div>
              <div className="section-heading"><h2>Recorded balances</h2></div><div className="receipt-list">{portfolio.balances.map(balance => <article key={balance.assetId} className="card"><p className="asset-id">{balance.assetId}</p><dl><div><dt>Recorded quantity</dt><dd>{formattedUnits(balance.confirmedUnits,balance.decimals)}</dd></div><div><dt>Reserved quantity</dt><dd>{formattedUnits(balance.reservedUnits,balance.decimals)}</dd></div></dl></article>)}</div>
            </>}
            {view === "plan" && <section className="card form-card"><span className="panel-kicker">CANONICAL SAVED INSTRUCTION</span><h2>Build a rule</h2>
              {!data.instruments.length ? <p>No BSC instruments have been registered by the server. Instrument verification must precede planning.</p> : <form onSubmit={event => { event.preventDefault(); run(saveRule); }}>
                <div className="field-row"><label>Rule type<select value={ruleKind} onChange={event => { setRuleKind(event.target.value); setRuleId(event.target.value); }}><option value="basket">Scheduled basket</option><option value="price">Price condition</option></select></label><label>Rule ID<input required value={ruleId} pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,127}" onChange={event => setRuleId(event.target.value)} /></label></div>
                <p>Saving uses version {(portfolio.rules.find(rule => rule.id === ruleId)?.version ?? 0)+1}; an earlier active version is paused.</p>
                <label>{ruleKind === "price" && side === "sell" ? "Token quantity" : "Settlement contribution"}<input required inputMode="decimal" value={quantity} onChange={event => setQuantity(event.target.value)} /></label>
                {ruleKind === "basket" ? <>
                  <div className="field-row"><label>Frequency<select value={frequency} onChange={event => setFrequency(event.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label><label>Local time<input type="time" required value={localTime} onChange={event => setLocalTime(event.target.value)} /></label></div>
                  <div className="field-row"><label>Timezone<input required value={zone} onChange={event => setZone(event.target.value)} /></label><label>Window (minutes)<input type="number" min="1" max="1440" required value={windowMinutes} onChange={event => setWindowMinutes(event.target.value)} /></label></div>
                  {frequency === "weekly" && <label>Weekday<select value={weekday} onChange={event => setWeekday(event.target.value)}>{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((day,index) => <option key={day} value={index}>{day}</option>)}</select></label>}
                  <h3>Registered targets</h3><p>Use zero to exclude a token. Weights must add to 100%.</p>{data.instruments.map(instrument => <label key={instrument.instrumentId}>{instrument.ticker} ({instrument.issuerId}) target (%)<input inputMode="decimal" value={weights[instrument.instrumentId] ?? "0"} onChange={event => setWeights({ ...weights,[instrument.instrumentId]:event.target.value })} /></label>)}
                </> : <>
                  <div className="field-row"><label>Instrument<select value={selectedInstrument} onChange={event => setSelectedInstrument(event.target.value)}>{data.instruments.map(instrument => <option key={instrument.instrumentId} value={instrument.instrumentId}>{instrument.ticker} ({instrument.issuerId})</option>)}</select></label><label>Action<select value={side} onChange={event => setSide(event.target.value)}><option value="buy">Buy</option><option value="sell">Sell</option></select></label></div>
                  <div className="field-row"><label>Price condition<select value={comparator} onChange={event => setComparator(event.target.value)}><option value="at-or-below">At or below</option><option value="at-or-above">At or above</option></select></label><label>USD per underlying share<input required inputMode="decimal" value={threshold} onChange={event => setThreshold(event.target.value)} /></label></div>
                  <p>Reference source: {data.instruments.find(item => item.instrumentId === selectedInstrument)?.referenceSource}. Require a source update within 60 seconds.</p>
                </>}
                <button type="submit" className="primary" disabled={busy}>{busy ? "Saving…" : "Save instruction for review"}</button>
              </form>}
              <small>Earnings controls require reviewed server event records. Their browser creation is not available yet.</small>
            </section>}
            {view === "review" && <>
              <PilotPanel wallet={data.wallet} portfolioId={portfolio.id} revision={portfolio.revision} paused={portfolio.paused} dataMode={portfolio.dataMode} onRefresh={()=>load(portfolio.id)} />
              <ExecutionPanel key={`${data.wallet}:${portfolio.id}`} wallet={data.wallet} portfolioId={portfolio.id} revision={portfolio.revision} paused={portfolio.paused} dataMode={portfolio.dataMode} onRefresh={()=>load(portfolio.id)} /><p className="lead">Review the exact saved instruction before activation. Market and policy decisions appear after a trusted scheduler evaluates it.</p><div className="receipt-list">{portfolio.rules.length ? portfolio.rules.map(rule => <RuleCard key={rule.id} rule={rule} busy={busy} checked={checked.has(rule.reviewHash)} setChecked={value => setChecked(previous => { const next = new Set(previous); if (value) next.add(rule.reviewHash); else next.delete(rule.reviewHash); return next; })} change={state => run(async () => { await command({ kind:"set-rule-state",ruleId:rule.id,version:rule.version,reviewedHash:rule.reviewHash,state }); setNotice(`Rule ${state === "ACTIVE" ? "activated" : "paused"}. Trading remains unavailable.`); })} />) : <p>No saved instructions to review.</p>}</div><div className="card recovery-card"><h3>Trade approval requires a valid plan</h3><p>A wallet sign-in or rule activation cannot approve a trade. A supervised pilot can prepare a bounded plan for separate exact approval.</p></div></>}
            {view === "activity" && <>
              <div className="activity-toolbar"><span>Latest 100 records per category</span><button type="button" className="secondary" onClick={() => download(data)}>Download saved JSON</button></div>
              <div className="section-heading"><h2>Execution receipts</h2></div>{portfolio.receipts.length ? portfolio.receipts.map(receipt => <article className="card receipt" key={receipt.id}><span className="panel-kicker">{receipt.state.toUpperCase()}</span><h2>{receipt.id}</h2><dl><div><dt>Transaction</dt><dd>{receipt.transactionHash}</dd></div><div><dt>Receipt success</dt><dd>{receipt.receiptSuccess === null ? "Not observed" : String(receipt.receiptSuccess)}</dd></div><div><dt>Effect proof</dt><dd>{receipt.effectProofHash ?? "Not verified"}</dd></div><div><dt>Balance reconciliation</dt><dd>{receipt.reconciledAt ?? "Pending"}</dd></div></dl><RecordDetails label="Receipt and recovery record" value={receipt} /></article>) : <p>No execution receipt has been recorded for this portfolio.</p>}
              <div className="section-heading"><h2>Portfolio decisions</h2></div>{portfolio.decisions.map(decision => <article className="card" key={decision.id}><h3>{decision.kind} · revision {decision.revision}</h3><RecordDetails label={decision.id} value={decision.body} /></article>)}{!portfolio.decisions.length && <p>No P4 decisions recorded.</p>}
              <div className="section-heading"><h2>Rule evaluations</h2></div>{portfolio.batches.map(batch => <article className="card" key={batch.batchId}><h3>{batch.batchId} · revision {batch.revision}</h3><RecordDetails label="Saved evaluation and coordination" value={batch.body} /></article>)}{!portfolio.batches.length && <p>No trusted scheduling batch recorded.</p>}
            </>}
            {view === "settings" && <div className="settings-stack"><section className="card setting-row"><div><h3>Server pause</h3><p>{portfolio.paused ? "This portfolio is paused on the server." : "Planning is enabled on the server."} Pause releases held plans; submitted transactions still need reconciliation.</p></div><button type="button" className={portfolio.paused ? "secondary" : "danger"} disabled={busy} onClick={() => run(async () => { await command({ kind:"set-pause",paused:!portfolio.paused }); setNotice("Server pause state updated."); })}>{portfolio.paused ? "Resume planning" : "Pause portfolio"}</button></section><section className="card"><h3>Session</h3><p>Signing out revokes this session. Saved instructions remain in PostgreSQL.</p><button type="button" className="secondary" disabled={busy} onClick={() => run(async () => { generation.current++; sessionBlocked.current = true; await api("/api/session/logout",{}); setData(null); setChecked(new Set()); setNotice("Signed out."); })}>Sign out</button></section></div>}
          </>}
        </>}
      </div>
      <footer><span>NEXUS · SAVED WORKSPACE</span><a className="inline-link" href="/">Fixture walkthrough ↗</a></footer>
    </main>
  </div>;
}
