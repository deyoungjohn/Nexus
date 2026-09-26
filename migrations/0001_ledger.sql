CREATE TABLE portfolios (
  id text PRIMARY KEY,
  chain_id integer NOT NULL CHECK (chain_id > 0),
  settlement_asset_id text NOT NULL,
  settlement_decimals integer NOT NULL CHECK (settlement_decimals BETWEEN 0 AND 255),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE portfolio_revisions (
  portfolio_id text NOT NULL REFERENCES portfolios(id),
  revision bigint NOT NULL CHECK (revision >= 0),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (portfolio_id, revision)
);

CREATE TABLE balances (
  portfolio_id text NOT NULL REFERENCES portfolios(id),
  asset_id text NOT NULL,
  decimals integer NOT NULL CHECK (decimals BETWEEN 0 AND 255),
  confirmed_units numeric(78, 0) NOT NULL CHECK (confirmed_units >= 0),
  PRIMARY KEY (portfolio_id, asset_id)
);

CREATE TABLE policies (
  id text PRIMARY KEY,
  portfolio_id text NOT NULL REFERENCES portfolios(id),
  version bigint NOT NULL CHECK (version > 0),
  body jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portfolio_id, version)
);

CREATE TABLE evidence_snapshots (
  id text PRIMARY KEY,
  portfolio_id text NOT NULL REFERENCES portfolios(id),
  revision bigint NOT NULL,
  source_block numeric(78, 0),
  observed_at timestamptz NOT NULL,
  body jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (portfolio_id, revision) REFERENCES portfolio_revisions(portfolio_id, revision)
);

CREATE TABLE decision_records (
  id text PRIMARY KEY,
  portfolio_id text NOT NULL REFERENCES portfolios(id),
  revision bigint NOT NULL,
  kind text NOT NULL,
  body jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (portfolio_id, revision) REFERENCES portfolio_revisions(portfolio_id, revision)
);

CREATE TABLE plans (
  id text PRIMARY KEY,
  portfolio_id text NOT NULL REFERENCES portfolios(id),
  revision bigint NOT NULL,
  occurrence_id text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('reserved', 'executing', 'reconciling', 'unknown', 'stale', 'expired', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (portfolio_id, revision) REFERENCES portfolio_revisions(portfolio_id, revision),
  UNIQUE (portfolio_id, occurrence_id),
  UNIQUE (portfolio_id, idempotency_key)
);

CREATE UNIQUE INDEX one_executing_batch_per_portfolio ON plans(portfolio_id)
  WHERE status IN ('executing', 'reconciling', 'unknown');

CREATE TABLE reservations (
  id text PRIMARY KEY,
  portfolio_id text NOT NULL REFERENCES portfolios(id),
  plan_id text NOT NULL REFERENCES plans(id),
  asset_id text NOT NULL,
  decimals integer NOT NULL CHECK (decimals BETWEEN 0 AND 255),
  units numeric(78, 0) NOT NULL CHECK (units > 0),
  state text NOT NULL CHECK (state IN ('held', 'submitted', 'released', 'consumed')),
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((state = 'held' AND lease_until IS NOT NULL) OR (state <> 'held' AND lease_until IS NULL))
);
CREATE INDEX active_reservations_by_asset ON reservations(portfolio_id, asset_id)
  WHERE state IN ('held', 'submitted');

CREATE TABLE transactions (
  id text PRIMARY KEY,
  portfolio_id text NOT NULL REFERENCES portfolios(id),
  plan_id text NOT NULL REFERENCES plans(id),
  reservation_id text NOT NULL UNIQUE REFERENCES reservations(id),
  state text NOT NULL CHECK (state IN ('unknown', 'included', 'confirmed', 'reverted', 'replaced')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_key text NOT NULL UNIQUE,
  topic text NOT NULL,
  payload jsonb NOT NULL,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  worker_id text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((lease_until IS NULL AND worker_id IS NULL) OR
         (lease_until IS NOT NULL AND worker_id IS NOT NULL))
);
CREATE INDEX outbox_ready ON outbox(available_at, id) WHERE delivered_at IS NULL;
