-- Feed high-water marks survive restarts and profile revisions; private journal.
CREATE TABLE pilot_feed_highwater (
  source text PRIMARY KEY,
  round_id numeric(78,0) NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE TABLE pilot_price_observations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_revision text NOT NULL,
  phase text NOT NULL CHECK (phase IN ('prepare','revalidate')),
  evidence jsonb NOT NULL,
  gate_reason text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE eoa_execution_legs ADD COLUMN pilot_profile_hash text
  CHECK (pilot_profile_hash IS NULL OR pilot_profile_hash ~ '^[0-9a-f]{64}$');
-- Legacy pilot reviews still require the allowance invariant; no old leg escapes it.
UPDATE eoa_execution_legs l SET pilot_profile_hash=repeat('0',64)
  WHERE EXISTS(SELECT 1 FROM eoa_execution_reviews r WHERE r.tx_hash=l.tx_hash AND r.request ? 'pilotProfile');
-- Preserve the original receipt and all raw before/after balances for R1.
CREATE TABLE eoa_fill_proofs (
  leg_id text PRIMARY KEY REFERENCES eoa_execution_legs(id),
  proof jsonb NOT NULL,
  before_balances jsonb NOT NULL,
  after_balances jsonb NOT NULL,
  allowance_proof jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE eoa_reanchor_reviews (
  id text PRIMARY KEY,
  leg_id text NOT NULL REFERENCES eoa_execution_legs(id),
  portfolio_id text NOT NULL REFERENCES portfolios(id),
  expected_revision bigint NOT NULL,
  evidence_hash text NOT NULL CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  body jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  owner_signature text,
  applied_revision bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((owner_signature IS NULL) = (applied_revision IS NULL))
);
CREATE UNIQUE INDEX eoa_reanchor_once ON eoa_reanchor_reviews(leg_id) WHERE applied_revision IS NOT NULL;
