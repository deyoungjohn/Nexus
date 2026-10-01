-- Server-derived executable reviews. Browser commands submit signatures only.
CREATE TABLE eoa_execution_reviews (
  id text PRIMARY KEY,
  portfolio_id text NOT NULL REFERENCES portfolios(id),
  plan_id text NOT NULL REFERENCES plans(id),
  reservation_id text NOT NULL REFERENCES reservations(id),
  leg_index integer NOT NULL CHECK (leg_index >= 0),
  context_hash text NOT NULL CHECK (context_hash ~ '^[0-9a-f]{64}$'),
  request jsonb NOT NULL,
  metadata jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  owner_signature text,
  tx_hash text REFERENCES eoa_execution_legs(tx_hash),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((owner_signature IS NULL AND tx_hash IS NULL)
    OR (owner_signature ~ '^0x[0-9a-fA-F]{130}$' AND tx_hash IS NOT NULL))
);
CREATE INDEX eoa_execution_reviews_by_portfolio ON eoa_execution_reviews(portfolio_id, created_at);

-- An acknowledged send remains an unknown transaction until chain recovery.
CREATE TABLE eoa_broadcast_results (
  review_id text PRIMARY KEY REFERENCES eoa_execution_reviews(id),
  outcome text NOT NULL CHECK (outcome IN ('accepted', 'unknown')),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
