"use client";

import { useEffect, useState } from "react";
import {
  approveFixturePlan, cents, createFixturePlan, initialFixtureState,
  recordFixtureReceipt, restoreFixtureState,
  type FixtureDraft, type FixtureState,
} from "../lib/workflow";

type View = "overview" | "plan" | "review" | "activity" | "settings";
const NAV: { id: View; label: string; number: string }[] = [
  { id: "overview", label: "Overview", number: "01" },
  { id: "plan", label: "Plan", number: "02" },
  { id: "review", label: "Review", number: "03" },
  { id: "activity", label: "Activity", number: "04" },
  { id: "settings", label: "Settings", number: "05" },
];

interface Eip1193Provider {
  request(args: { method: string }): Promise<unknown>;
}

function provider(): Eip1193Provider | null {
  const injected = (window as Window & { ethereum?: unknown }).ethereum;
  if (typeof injected !== "object" || injected === null || !("request" in injected) ||
    typeof (injected as { request?: unknown }).request !== "function") return null;
  return injected as Eip1193Provider;
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function downloadFixture(state: FixtureState): void {
  const exportRecord = {
    schema: "nexus.fixture.v1",
    generatedAt: new Date().toISOString(),
    notice: "Synthetic local walkthrough only. No wallet approval, transaction, or reconciled chain balance.",
    draft: state.draft,
    preview: state.plan,
    localApproval: state.approval,
    fixtureReceipts: state.receipts,
    localPause: state.paused,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(exportRecord, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "nexus-fixture-record.json";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function Workspace() {
  const [view, setView] = useState<View>("overview");
  const [state, setState] = useState<FixtureState>(initialFixtureState);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [wallet, setWallet] = useState("Not checked");
  const [checkingWallet, setCheckingWallet] = useState(false);

  useEffect(() => {
    try { setState(restoreFixtureState(window.localStorage.getItem("nexus.fixture.v1"))); }
    catch { setError("Local fixture storage is unavailable. This session will still work."); }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { window.localStorage.setItem("nexus.fixture.v1", JSON.stringify(state)); }
    catch { /* The walkthrough remains usable without storage. */ }
  }, [loaded, state]);

  function updateDraft(key: keyof FixtureDraft, value: string): void {
    setError("");
    setState((current) => ({ ...current, draft: { ...current.draft, [key]: value }, plan: null, approval: null }));
  }

  function preview(): void {
    try {
      const plan = createFixturePlan(state.draft, new Date(), crypto.randomUUID());
      setState((current) => ({ ...current, plan, approval: null }));
      setError("");
      setView("review");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Preview failed."); }
  }

  function approve(): void {
    try {
      const approval = approveFixturePlan(state.plan, state.paused, new Date());
      setState((current) => ({ ...current, approval }));
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Fixture approval failed."); }
  }

  function record(): void {
    try {
      const receipt = recordFixtureReceipt(state.plan, state.approval, state.receipts, new Date());
      setState((current) => ({ ...current, receipts: [receipt, ...current.receipts] }));
      setError("");
      setView("activity");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Fixture outcome failed."); }
  }

  async function discoverWallet(): Promise<void> {
    setCheckingWallet(true);
    setError("");
    try {
      const injected = provider();
      if (!injected) { setWallet("No EIP-1193 wallet detected"); return; }
      const [accounts, chain] = await Promise.all([
        injected.request({ method: "eth_accounts" }),
        injected.request({ method: "eth_chainId" }),
      ]);
      const chainLabel = chain === "0x38" ? "BNB Smart Chain" : `chain ${String(chain)}`;
      const first = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : null;
      setWallet(first ? `${first.slice(0, 6)}…${first.slice(-4)} · ${chainLabel}` : `Wallet detected · ${chainLabel} · no shared account`);
    } catch {
      setWallet("Wallet discovery failed");
      setError("The wallet did not return account and chain information. Check its connection and try again.");
    } finally { setCheckingWallet(false); }
  }

  const plan = state.plan;
  const hasReceipt = plan !== null && state.receipts.some((receipt) => receipt.planId === plan.id);
  const currentNav = NAV.find((item) => item.id === view)!;

  return <div className="workspace">
    <aside className="sidebar" aria-label="Workspace navigation">
      <div className="brand"><span className="brand-mark" aria-hidden="true">N</span><span>NEXUS<small>PORTFOLIO WORKSPACE</small></span></div>
      <p className="sidebar-label">WORKSPACE</p>
      <nav className="nav-list" aria-label="Main navigation">
        {NAV.map((item) => <button key={item.id} type="button" className={`nav-item ${view === item.id ? "active" : ""}`}
          aria-current={view === item.id ? "page" : undefined} onClick={() => { setView(item.id); setError(""); }}>
          <span className="nav-number">{item.number}</span><span>{item.label}</span><span className="nav-arrow" aria-hidden="true">↗</span>
        </button>)}
      </nav>
      <div className="sidebar-bottom"><span className="status-dot"/> FIXTURE WORKSPACE
        <p>Local planning walkthrough. Live execution is disabled.</p>
      </div>
    </aside>

    <main className="main">
      <div className="topbar"><div className="breadcrumb">WORKSPACE <span>/</span> {currentNav.label.toUpperCase()}</div>
        <div className="topbar-actions"><a className="inline-link" href="/workspace">Saved workspace ↗</a><span className="mode-pill">● FIXTURE MODE</span><button type="button" className="text-button" onClick={() => setView("settings")}>Settings ↗</button></div></div>

      <div className="content">
        {!loaded && <p role="status" className="notice">Loading local fixture workspace…</p>}
        {error && <div role="alert" className="error-banner">{error}</div>}

        {view === "overview" && <>
          <div className="eyebrow">01 / PORTFOLIO CONTROL</div><h1>Plan with clarity.<br/><em>Act with intent.</em></h1>
          <p className="lead">A guided workspace for rules, bounds, decisions and recovery. All figures on this page are synthetic.</p>
          <div className="hero-panel"><div><span className="panel-kicker">CURRENT MODE</span><h2>Explore the full decision path</h2>
            <p>Create a basket rule, inspect a bounded fixture preview, approve the walkthrough, and record a sample outcome. Nothing is signed or sent to a chain.</p>
            <button type="button" className="primary" onClick={() => setView("plan")}>Create a plan <span aria-hidden="true">↗</span></button></div>
            <div className="hero-graphic" aria-hidden="true"><div className="orb orb-one"/><div className="orb orb-two"/><span>PLAN<br/>→ REVIEW<br/>→ RECORD</span></div></div>
          <div className="section-heading"><div><span className="eyebrow">AT A GLANCE</span><h2>Workspace status</h2></div><span>LOCAL DATA ONLY</span></div>
          <div className="metric-grid">
            <div className="metric"><span>Illustrative contribution</span><strong>{cents(Math.round(Number(state.draft.contribution || 0) * 100) || 0)}</strong><small>per {state.draft.cadence} occurrence</small></div>
            <div className="metric"><span>Preview</span><strong>{plan ? "Ready" : "Not created"}</strong><small>{plan ? `Expires ${dateTime(plan.expiresAt)}` : "Build from your draft rule"}</small></div>
            <div className="metric"><span>Automation</span><strong>{state.paused ? "Paused" : "Demo only"}</strong><small>No live scheduler or broadcaster</small></div>
          </div>
          <div className="two-column"><div className="card"><span className="eyebrow">NEXT DECISION</span><h3>{plan ? "Inspect the preview" : "Shape your first rule"}</h3><p>{plan ? "Review every illustrative amount and constraint before local approval." : "Set contribution, reserve, allocation and a per-leg cap."}</p><button type="button" className="inline-link" onClick={() => setView(plan ? "review" : "plan")}>{plan ? "Open review" : "Open plan"} ↗</button></div>
            <div className="card"><span className="eyebrow">WALLET DISCOVERY</span><h3>EOA connection</h3><p>{wallet}</p><button type="button" className="secondary" disabled={checkingWallet} onClick={discoverWallet}>{checkingWallet ? "Checking wallet…" : "Check connected wallet"}</button><small>Reads shared accounts and chain only. No connection request or signature.</small></div></div>
        </>}

        {view === "plan" && <>
          <div className="eyebrow">02 / DESIGN THE RULE</div><h1>Make the rule<br/><em>unambiguous.</em></h1>
          <p className="lead">Choose a synthetic two-stock basket. Changing a field invalidates the current preview and local approval.</p>
          <div className="form-grid"><section className="card form-card"><span className="eyebrow">BASKET INSTRUCTIONS</span><h2>Contribution & allocation</h2>
            <div className="field-row"><label>Contribution (USD)<input inputMode="decimal" value={state.draft.contribution} onChange={(event) => updateDraft("contribution", event.target.value)}/></label><label>Cash reserve (USD)<input inputMode="decimal" value={state.draft.reserve} onChange={(event) => updateDraft("reserve", event.target.value)}/></label></div>
            <div className="field-row"><label>NVDAB target (%)<input inputMode="numeric" value={state.draft.nvdabWeight} onChange={(event) => updateDraft("nvdabWeight", event.target.value)}/></label><label>AMDB target (%)<input inputMode="numeric" value={state.draft.amdbWeight} onChange={(event) => updateDraft("amdbWeight", event.target.value)}/></label></div>
            <div className="field-row"><label>Per-leg cap (%)<input inputMode="numeric" value={state.draft.perLegCap} onChange={(event) => updateDraft("perLegCap", event.target.value)}/></label><label>Schedule<select value={state.draft.cadence} onChange={(event) => updateDraft("cadence", event.target.value)}><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label></div>
            <button type="button" className="primary" onClick={preview}>Generate fixture preview <span aria-hidden="true">↗</span></button>
          </section><aside className="card rule-note"><span className="eyebrow">HOW TO READ THIS</span><h3>One rule. Separate approval.</h3><p>The form creates a local, interpreted example. Its targets are not a live order. Preview approval is separate from a wallet signature or transaction.</p><div className="divider"/><p><strong>Fixture prices:</strong> NVDAB $120, AMDB $80. Minimum units use a synthetic 2% buffer. No market source, portfolio holdings, quote or gas estimate is connected.</p><p><strong>Live gate:</strong> bStocks eligibility, token risk, market evidence and execution recovery remain open.</p></aside></div>
        </>}

        {view === "review" && <>
          <div className="eyebrow">03 / INSPECT THE BOUNDS</div><h1>Every number<br/><em>has a reason.</em></h1>
          {!plan ? <div className="empty-state"><h2>No preview yet</h2><p>Create a fixture plan to inspect its interpretation and local approval terms.</p><button type="button" className="primary" onClick={() => setView("plan")}>Go to Plan ↗</button></div> : <>
            <div className="review-warning"><strong>FIXTURE PREVIEW · NOT EXECUTABLE</strong><p>Prices, quantities and evidence below are synthetic. This screen cannot authorize a wallet or submit a trade.</p></div>
            <div className="summary-strip"><div><span>Contribution</span><strong>{cents(plan.contributionCents)}</strong></div><div><span>Accepted spend</span><strong>{cents(plan.acceptedCents)}</strong></div><div><span>Reserved cash</span><strong>{cents(plan.reserveCents)}</strong></div><div><span>Unallocated</span><strong>{cents(plan.unallocatedCents)}</strong></div></div>
            <div className="section-heading"><div><span className="eyebrow">INTERPRETED RULE</span><h2>{plan.cadence === "weekly" ? "Weekly" : "Monthly"} basket · {plan.perLegCap}% per-leg cap</h2></div><button type="button" className="inline-link" onClick={() => setView("plan")}>Edit instructions ↗</button></div>
            <div className="leg-list">{plan.legs.map((leg) => <div className="leg" key={leg.symbol}><div className="ticker">{leg.symbol.slice(0, 1)}</div><div className="leg-name"><strong>{leg.symbol}</strong><small>{leg.targetWeight}% target · {leg.reason}</small></div><div><span>INTENDED</span><strong>{cents(leg.intendedCents)}</strong></div><div><span>ACCEPTED</span><strong>{cents(leg.acceptedCents)}</strong></div><div><span>MIN. UNITS*</span><strong>{leg.minimumUnits}</strong></div></div>)}</div>
            <p className="footnote">*Illustrative minimum derived from fixture prices with a 2% buffer. It is not an executable quote or on-chain minimum output.</p>
            <div className="two-column review-details"><div className="card"><span className="eyebrow">BOUNDARY & EVIDENCE</span><h3>What the preview knows</h3><dl><div><dt>Spend ceiling</dt><dd>{cents(plan.acceptedCents + plan.feeAllowanceCents)} fixture</dd></div><div><dt>Fee allowance</dt><dd>{cents(plan.feeAllowanceCents)} synthetic</dd></div><div><dt>Evidence source</dt><dd>Local fixture values</dd></div><div><dt>Created</dt><dd>{dateTime(plan.createdAt)}</dd></div><div><dt>Approval expires</dt><dd>{dateTime(plan.expiresAt)}</dd></div><div><dt>Market simulation</dt><dd>Unavailable</dd></div></dl></div>
              <div className="card action-card"><span className="eyebrow">EXPLICIT LOCAL ACTION</span><h3>{state.approval?.planId === plan.id ? "Fixture approved" : "Approve this walkthrough?"}</h3><p>This records a local acknowledgement of this exact fixture plan. A live EOA path would require separate Nexus approval, transaction signing and current market checks.</p>
                {!state.approval && <button type="button" className="primary" onClick={approve} disabled={state.paused}>Approve fixture plan ↗</button>}
                {state.approval && !hasReceipt && <button type="button" className="primary" onClick={record}>Record sample outcome ↗</button>}
                {hasReceipt && <span className="success-note">Sample outcome recorded. See Activity.</span>}
                {state.paused && <small>Local fixture is paused. Resume in Settings.</small>}
                <button type="button" className="inline-link" onClick={() => setView("settings")}>Pause or inspect settings ↗</button></div></div>
          </>}
        </>}

        {view === "activity" && <>
          <div className="eyebrow">04 / DECISION HISTORY</div><h1>Know what<br/><em>happened next.</em></h1>
          <p className="lead">Local fixture records are clearly separate from chain receipts. Export them for review or reset this browser workspace.</p>
          <div className="activity-toolbar"><span>{state.receipts.length} fixture outcome{state.receipts.length === 1 ? "" : "s"}</span><button type="button" className="secondary" onClick={() => downloadFixture(state)}>Download fixture JSON ↓</button></div>
          {state.receipts.length === 0 ? <div className="empty-state"><h2>No outcomes recorded</h2><p>Preview and approve a fixture plan, then record its sample outcome.</p><button type="button" className="primary" onClick={() => setView("plan")}>Start in Plan ↗</button></div> : <div className="receipt-list">{state.receipts.map((receipt) => <article className="card receipt" key={receipt.id}><div className="receipt-head"><span className="success-note">● RECONCILED FIXTURE</span><time dateTime={receipt.recordedAt}>{dateTime(receipt.recordedAt)}</time></div><h2>{cents(receipt.spentCents)} illustrative spend</h2><p>{receipt.details}</p><dl><div><dt>Record ID</dt><dd>{receipt.id}</dd></div><div><dt>Cash not spent</dt><dd>{cents(receipt.unallocatedCents)}</dd></div><div><dt>Chain transaction</dt><dd>None</dd></div></dl></article>)}</div>}
          <div className="card recovery-card"><span className="eyebrow">RECOVERY PATH</span><h3>Uncertain chain outcomes stay unresolved</h3><p>In live execution, a timeout cannot mean “try the trade again.” Nexus must locate the persisted transaction by hash and nonce, prove receipt effects and reconcile balances before another leg. That server integration is still a P7 gate; no recovery action is available in this fixture.</p><span className="mode-pill">LIVE RECOVERY DISABLED</span></div>
        </>}

        {view === "settings" && <>
          <div className="eyebrow">05 / CONTROL PANEL</div><h1>Keep control<br/><em>in reach.</em></h1><p className="lead">These settings apply only to this browser walkthrough.</p>
          <div className="settings-stack"><div className="card setting-row"><div><span className="eyebrow">FIXTURE CONTROL</span><h3>{state.paused ? "Walkthrough paused" : "Walkthrough active"}</h3><p>Pausing blocks new local fixture approvals. It does not change a server policy or on-chain state.</p></div><button type="button" className={state.paused ? "secondary" : "danger"} onClick={() => { setState((current) => ({ ...current, paused: !current.paused, approval: null })); setError(""); }}>{state.paused ? "Resume fixture" : "Pause fixture"}</button></div>
            <div className="card setting-row"><div><span className="eyebrow">LOCAL DATA</span><h3>Reset this workspace</h3><p>Clear draft, previews and fixture receipts from this browser. Download records first if needed.</p></div><button type="button" className="secondary" onClick={() => { setState(initialFixtureState()); setError(""); setWallet("Not checked"); }}>Reset fixture</button></div>
            <div className="card"><span className="eyebrow">PRODUCTION STATUS</span><h3>Live actions are unavailable</h3><p>No bStocks account or jurisdiction evidence is collected here. No wallet signing, allowance, route submission, real receipt or server-side pause is wired to this web app. The headless P5.5 and P7 gates must pass before those controls can be offered.</p></div></div>
        </>}
      </div>
      <footer>© NEXUS · INSPECTABLE AUTOMATION <span>FIXTURE BUILD / P8</span></footer>
    </main>
  </div>;
}
