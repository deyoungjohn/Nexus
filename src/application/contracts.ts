/** Wire records contain decimal strings, never private keys or signed bytes. */
export interface SavedRuleView {
  id: string; version: number; kind: string; state: string;
  reviewHash: string; eventRevision: string | null; interpretation: string; draft: unknown;
}
export interface PortfolioSummary { id: string; revision: string; paused: boolean; dataMode: string }
export interface WorkspaceView {
  wallet: string;
  sessionExpiresAt: string;
  portfolios: PortfolioSummary[];
  portfolio: (PortfolioSummary & {
    chainId: number; settlement: { assetId: string; decimals: number };
    policyConfigured: boolean;
    balances: { assetId: string; decimals: number; confirmedUnits: string; reservedUnits: string }[];
    rules: SavedRuleView[];
    decisions: { id: string; revision: string; kind: string; body: unknown; recordedAt: string }[];
    batches: { batchId: string; revision: string; body: unknown; recordedAt: string }[];
    receipts: { id: string; planId: string; transactionHash: string; state: string;
      includedBlock: string | null; receiptSuccess: boolean | null; spentRaw: string | null;
      receivedRaw: string | null; effectProofHash: string | null; reconciledAt: string | null }[];
  }) | null;
  instruments: { instrumentId: string; ticker: string; issuerId: string; assetId: string; decimals: number; underlyingId: string; referenceSource: string }[];
  tradingEnabled: false;
}
