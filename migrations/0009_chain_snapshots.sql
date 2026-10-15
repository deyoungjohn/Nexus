-- Owner-acknowledged finalized snapshots; history and prior fills are immutable.
CREATE TABLE chain_snapshot_reviews (
  id text PRIMARY KEY,
  portfolio_id text NOT NULL REFERENCES portfolios(id),
  wallet text NOT NULL CHECK (wallet ~ '^0x[0-9a-f]{40}$'),
  expected_revision bigint NOT NULL CHECK (expected_revision >= 0),
  kind text NOT NULL CHECK (kind IN ('bootstrap','resync')),
  reason text NOT NULL,
  evidence_hash text NOT NULL CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  configuration_hash text NOT NULL CHECK (configuration_hash ~ '^[0-9a-f]{64}$'),
  source_block numeric(78,0) NOT NULL CHECK (source_block >= 0),
  source_block_hash text NOT NULL CHECK (source_block_hash ~ '^0x[0-9a-f]{64}$'),
  tx_nonce numeric(78,0) NOT NULL CHECK (tx_nonce >= 0),
  body jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  owner_signature text,
  activated_revision bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((owner_signature IS NULL) = (activated_revision IS NULL)),
  FOREIGN KEY (portfolio_id, activated_revision) REFERENCES portfolio_revisions(portfolio_id,revision)
);
CREATE UNIQUE INDEX chain_snapshot_revision_once ON chain_snapshot_reviews(portfolio_id,activated_revision);
CREATE INDEX chain_snapshot_start ON chain_snapshot_reviews(portfolio_id,kind,source_block)
  WHERE activated_revision IS NOT NULL;
