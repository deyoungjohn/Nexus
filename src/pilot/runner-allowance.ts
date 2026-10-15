import { Interface, Transaction, keccak256 } from 'ethers';
import { requireInput } from '../domain/errors.js';
import { nativeAssetId } from '../domain/amount.js';
import { BSC_USDT_ASSET, BSC_USDT_USD_FEED } from '../market-gate/chainlink-bsc.js';
import { BSTOCKS_BSC_NVDAB, fetchBStocksBscQuantity } from '../market-gate/bstocks-bsc.js';
import { BSTOCKS_BSC_V3_ROUTER } from '../market-gate/bstocks-transfer.js';
import { BSC_BNB_USD_FEED, routeAbi } from '../market-gate/bstocks-route.js';
import { collectBscTokenSecurity } from '../security/bsc-token-security.js';
import { tokenSecurityFingerprint, securityDigest } from '../security/token-security.js';
import { createBscExecutionChain } from '../execution/bsc-execution-chain.js';
import { verifyPilotAllowanceApproval } from './allowance.js';
import type { PilotRunnerRuntime } from './runner-runtime.js';
import type { PilotSigner } from './runner-input.js';
import type { RunnerEvidence } from './runner-evidence.js';
import { assertPilotSigner, confirmRunnerAction, type RunnerConfirm } from './runner-trade.js';

const USDT = BSC_USDT_ASSET.split('erc20:')[1]!;
const abi = new Interface(['function approve(address,uint256) returns(bool)']);
const qty = (x: unknown): bigint => { requireInput(typeof x === 'string' && /^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(x),
  'RPC_EVIDENCE_UNAVAILABLE', 'Canonical RPC quantity required.'); return BigInt(x); };
export interface SetupApproval {
  readonly wallet: string; readonly token: string; readonly spender: string; readonly amount: string;
  readonly chainId: 56; readonly nonce: number; readonly gasLimit: string; readonly maxFeePerGas: string;
  readonly maximumNativeFeeRaw: string; readonly maximumSettlementFeeRaw: string; readonly configurationHash: string;
}
export interface SetupApprovalPort {
  inspect(): Promise<SetupApproval>;
  verify(hash: string): Promise<unknown | null>;
  send(hash: string, raw: string): Promise<'accepted' | 'unknown'>;
}
export function createSetupApprovalPort(runtime: PilotRunnerRuntime, fetcher: typeof fetch = fetch, evidence?: RunnerEvidence): SetupApprovalPort {
  const config = runtime.config, profile = config.deployment.pilotProfile;
  let requestId = 0;
  const rpc = async (method: string, params: unknown[]) => {
    const id = ++requestId, r = await fetcher(config.rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }), signal: AbortSignal.timeout(5000) });
    const b = await r.json() as Record<string, unknown>;
    requireInput(r.ok && b.jsonrpc === '2.0' && b.id === id && !b.error && Object.hasOwn(b, 'result'), 'RPC_EVIDENCE_UNAVAILABLE', 'RPC evidence unavailable.');
    return b.result;
  };
  return {
    async inspect() {
      const used = await runtime.pool.query('SELECT 1 FROM eoa_execution_legs WHERE chain_id=56 AND wallet=$1 LIMIT 1', [profile.wallet]);
      const initialized = await runtime.pool.query("SELECT 1 FROM chain_snapshot_reviews WHERE wallet=$1 AND activated_revision IS NOT NULL LIMIT 1", [profile.wallet]);
      requireInput(used.rowCount === 0 && initialized.rowCount === 0, 'ALLOWANCE_SETUP_AFTER_BOOTSTRAP',
        'External setup must precede the initial bootstrap; never reset an existing pilot.');
      const state = await createBscExecutionChain(config.rpcUrl, config.deployment.marketPolicy.maxStatusAgeMs, fetcher).state(profile.wallet,
        [{ assetId: nativeAssetId(56), decimals: 18 }, { assetId: BSC_USDT_ASSET, decimals: 18 },
          { assetId: `eip155:56/erc20:${BSTOCKS_BSC_NVDAB}`, decimals: 18 }], new Date().toISOString());
      requireInput(state !== null && state.balances.find(b => b.assetId === BSC_USDT_ASSET)!.units >= profile.maximumSpendRaw
        && state.balances.find(b => b.assetId.endsWith(BSTOCKS_BSC_NVDAB))!.units === 0n,
        'PILOT_FUNDING_REQUIRED', 'Code-free funded EOA with no NVDAB holding and no pending nonce required.');
      const quantity = await fetchBStocksBscQuantity({ rpcUrl: config.rpcUrl, instrumentId: profile.instrumentId,
        tokenAddress: BSTOCKS_BSC_NVDAB, maxBlockAgeMs: config.deployment.marketPolicy.maxStatusAgeMs }, fetcher);
      requireInput(quantity !== null, 'PILOT_CONTROLS_UNAVAILABLE', 'Canonical controls required before setup.');
      const reports = await collectBscTokenSecurity({ rpcUrl: config.rpcUrl, reviews: [], maxAgeMs: config.deployment.marketPolicy.maxStatusAgeMs,
        blockNumber: quantity.sourceBlock, blockHash: quantity.sourceBlockHash }, fetcher);
      requireInput(profile.security.every(pin => {
        const s = reports.find(r => r.assetId === pin.assetId);
        return !!s?.observation && tokenSecurityFingerprint(s.observation) === pin.fingerprint
          && s.providers.every(p => p.state !== 'unavailable' && p.findings.every(f => pin.acceptedFindings[p.provider].includes(f)));
      }), 'PILOT_SECURITY_CHANGED', 'Current complete control fingerprints and accepted findings must match before setup.');
      const ref = { blockHash: state.blockHash, requireCanonical: true };
      const call = async (to: string, name: string, args: unknown[] = []) => {
        const r = await rpc('eth_call', [{ to, data: routeAbi.encodeFunctionData(name, args) }, ref]);
        requireInput(typeof r === 'string', 'RPC_EVIDENCE_UNAVAILABLE', 'Contract result required.');
        return routeAbi.decodeFunctionResult(name, r);
      };
      requireInput((await call(USDT, 'allowance', [profile.wallet, BSTOCKS_BSC_V3_ROUTER]))[0] === 0n,
        'EXISTING_ALLOWANCE', 'Provide the existing exact approval receipt instead; no implicit reset or unlimited approval.');
      const routerCode = await rpc('eth_getCode', [BSTOCKS_BSC_V3_ROUTER, ref]);
      requireInput(typeof routerCode === 'string' && keccak256(routerCode) === config.route.codeHashes.router,
        'ROUTER_CHANGED', 'Reviewed router must match.');
      const data = abi.encodeFunctionData('approve', [BSTOCKS_BSC_V3_ROUTER, profile.maximumSpendRaw]);
      const estimate = qty(await rpc('eth_estimateGas', [{ from: profile.wallet, to: USDT, data, value: '0x0' }]));
      const gasLimit = (estimate * 120n + 99n) / 100n;
      const nativeFee = gasLimit * config.deployment.maxFeePerGas;
      requireInput(estimate > 0n && gasLimit <= 100000n && gasLimit <= config.deployment.maxGasLimit
        && qty(await rpc('eth_gasPrice', [])) <= config.deployment.maxFeePerGas && nativeFee <= profile.gas.maximumNativeFeeRaw
        && state.balances.find(b => b.assetId === nativeAssetId(56))!.units >= nativeFee + config.pilotCoordinatorPolicy.requiredNativeGas.units,
        'SETUP_GAS_BOUND', 'Setup gas and retained native reserve must fit reviewed caps.');
      const feed = async (proxy: string, description: string) => {
        const [round, decimals, label] = await Promise.all([call(proxy, 'latestRoundData'), call(proxy, 'decimals'), call(proxy, 'description')]);
        const [id, answer, start, update, complete] = round as unknown as bigint[];
        const now = BigInt(Date.now()), header = await rpc('eth_getBlockByNumber', [`0x${state.blockNumber.toString(16)}`, false]) as Record<string, unknown>;
        requireInput(decimals[0] === 8n && label[0] === description && !!id && !!answer && answer > 0n && !!start && !!update
          && complete !== undefined && complete >= id && start <= update && update * 1000n <= qty(header.timestamp) * 1000n
          && now - update * 1000n <= BigInt(config.route.feeFeedMaxAgeMs), 'SETUP_FEE_SOURCE_UNAVAILABLE', 'Current complete fee feed required.');
        return answer;
      };
      const [bnb, usdt] = await Promise.all([feed(BSC_BNB_USD_FEED, 'BNB / USD'), feed(BSC_USDT_USD_FEED.proxy, 'USDT / USD')]);
      requireInput((usdt >= 100000000n ? usdt - 100000000n : 100000000n - usdt) * 10000n <= 100000000n * 50n,
        'SETUP_FEE_SOURCE_UNAVAILABLE', 'USDT fee conversion must fit the 50-bps peg limit.');
      const feeN = nativeFee * bnb * BigInt(10000 + config.route.feeUncertaintyBps), feeD = usdt * BigInt(10000 - config.route.feeUncertaintyBps);
      const settlementFee = (feeN + feeD - 1n) / feeD;
      requireInput(settlementFee <= profile.gas.maximumSettlementFeeRaw, 'SETUP_GAS_BOUND', 'Setup must fit absolute USDT gas cap.');
      const end = await rpc('eth_getBlockByNumber', [`0x${state.blockNumber.toString(16)}`, false]) as Record<string, unknown>;
      requireInput(end.hash === state.blockHash, 'CHAIN_STATE_CHANGED', 'Setup read block changed.');
      await evidence?.append('allowance.sources', { state, quantity, security: reports,
        feeConversion: { bnbAnswer8: bnb, usdtAnswer8: usdt, uncertaintyBps: config.route.feeUncertaintyBps } });
      return { wallet: profile.wallet, token: USDT, spender: BSTOCKS_BSC_V3_ROUTER, amount: profile.maximumSpendRaw.toString(), chainId: 56,
        nonce: state.nonce, gasLimit: gasLimit.toString(), maxFeePerGas: config.deployment.maxFeePerGas.toString(),
        maximumNativeFeeRaw: nativeFee.toString(), maximumSettlementFeeRaw: settlementFee.toString(), configurationHash: securityDigest(config) };
    },
    async verify(hash) {
      const receipt = await rpc('eth_getTransactionReceipt', [hash]) as Record<string, unknown> | null;
      if (!receipt) return null;
      const depth = BigInt(runtime.recovery.finalityBlocks) > 12n ? BigInt(runtime.recovery.finalityBlocks) : 12n;
      return await verifyPilotAllowanceApproval({ rpcUrl: config.rpcUrl, profile, transactionHash: hash,
        snapshotBlock: qty(receipt.blockNumber), finalityBlocks: depth }, fetcher) ? receipt : null;
    },
    async send(hash, raw) { return createBscExecutionChain(config.rpcUrl, config.deployment.marketPolicy.maxStatusAgeMs, fetcher)
      .send({ hash, rawSignedTransaction: raw }); }
  };
}

/** This is external owner setup, NOT a new Nexus approval-leg or unlimited authorization. */
export async function runSetupApproval(input: { wallet: string; signer: PilotSigner; port: SetupApprovalPort;
  evidence: RunnerEvidence; confirm: RunnerConfirm; assertOperatorLock: () => Promise<void> }): Promise<{ hash: string; receipt: unknown | null }> {
  const { evidence, port, signer } = input;
  assertPilotSigner(signer, input.wallet);
  const prior = await evidence.load<{ hash: string; rawSignedTransaction: string }>('allowance.json');
  if (prior) {
    const tx = Transaction.from(prior.rawSignedTransaction);
    requireInput(tx.isSigned() && tx.hash === prior.hash && tx.from?.toLowerCase() === input.wallet && tx.chainId === 56n
      && tx.to?.toLowerCase() === USDT && tx.value === 0n, 'INVALID_SETUP_RECORD', 'Exact saved owner setup identity required.');
    const receipt = await port.verify(prior.hash);
    await evidence.append('allowance.resume', { hash: prior.hash, receipt, resent: false });
    return { hash: prior.hash, receipt };
  }
  const setup = await port.inspect();
  requireInput(setup.wallet === input.wallet && setup.token === USDT && setup.spender === BSTOCKS_BSC_V3_ROUTER
    && setup.chainId === 56 && /^(0|[1-9][0-9]{0,77})$/.test(setup.amount) && BigInt(setup.amount) > 0n
    && BigInt(setup.amount) <= 5n * 10n ** 18n, 'INVALID_SETUP_RECORD', 'Setup must be the bounded exact canonical USDT allowance.');
  await confirmRunnerAction(input.confirm, evidence, 'APPROVE-USDT', setup);
  const current = await port.inspect();
  requireInput(securityDigest(current) === securityDigest(setup), 'SETUP_CHANGED', 'Nonce, controls or gas changed; review setup again.');
  const raw = await signer.signTransaction({ type: 2, chainId: 56, to: setup.token,
    data: abi.encodeFunctionData('approve', [setup.spender, BigInt(setup.amount)]), value: 0n, nonce: setup.nonce,
    gasLimit: BigInt(setup.gasLimit), maxFeePerGas: BigInt(setup.maxFeePerGas), maxPriorityFeePerGas: 0n });
  const signed = Transaction.from(raw);
  requireInput(signed.isSigned() && signed.from?.toLowerCase() === input.wallet && signed.chainId === 56n && signed.type === 2
    && setup.wallet === input.wallet && setup.token === USDT && setup.spender === BSTOCKS_BSC_V3_ROUTER
    && signed.to?.toLowerCase() === USDT && signed.value === 0n && signed.nonce === setup.nonce
    && signed.data === abi.encodeFunctionData('approve', [setup.spender, BigInt(setup.amount)])
    && signed.gasLimit === BigInt(setup.gasLimit) && signed.maxFeePerGas === BigInt(setup.maxFeePerGas)
    && signed.maxPriorityFeePerGas === 0n, 'INVALID_SETUP_RECORD', 'Signed setup must exactly match the confirmed bounded approval.');
  const hash = signed.hash!;
  await evidence.save('allowance.json', { setup, hash, rawSignedTransaction: raw, state: 'send-claimed-no-retry' });
  await evidence.append('allowance.send-claimed', { setup, hash });
  await input.assertOperatorLock();
  const outcome = await port.send(hash, raw);
  await evidence.append('allowance.broadcast', { hash, outcome });
  const receipt = await port.verify(hash);
  await evidence.save('allowance-result.json', { hash, receipt, outcome });
  return { hash, receipt };
}
