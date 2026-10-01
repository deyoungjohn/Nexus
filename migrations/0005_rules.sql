CREATE TABLE rule_versions (
  portfolio_id text NOT NULL REFERENCES portfolios(id),
  rule_id text NOT NULL,
  version bigint NOT NULL CHECK (version > 0),
  draft jsonb NOT NULL,
  rule_hash text NOT NULL CHECK (rule_hash ~ '^[0-9a-f]{64}$'),
  review_hash text NOT NULL CHECK (review_hash ~ '^[0-9a-f]{64}$'),
  event_revision text,
  state text NOT NULL CHECK (state IN ('READY_FOR_REVIEW', 'ACTIVE', 'PAUSED')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (portfolio_id, rule_id, version)
);
CREATE UNIQUE INDEX one_active_rule_version ON rule_versions(portfolio_id, rule_id)
  WHERE state = 'ACTIVE';

CREATE TABLE rule_batches (
  portfolio_id text NOT NULL REFERENCES portfolios(id),
  batch_id text NOT NULL,
  revision bigint NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  body jsonb NOT NULL,
  inputs jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (portfolio_id, batch_id),
  FOREIGN KEY (portfolio_id, revision) REFERENCES portfolio_revisions(portfolio_id, revision)
);
CREATE TABLE rule_occurrences (
  portfolio_id text NOT NULL,
  rule_id text NOT NULL,
  version bigint NOT NULL,
  occurrence_id text NOT NULL,
  batch_id text NOT NULL,
  PRIMARY KEY (portfolio_id, occurrence_id),
  FOREIGN KEY (portfolio_id, rule_id, version) REFERENCES rule_versions(portfolio_id, rule_id, version),
  FOREIGN KEY (portfolio_id, batch_id) REFERENCES rule_batches(portfolio_id, batch_id)
);

CREATE TABLE allocation_positions (
  portfolio_id text NOT NULL REFERENCES portfolios(id),
  allocation_id text NOT NULL,
  instrument_id text NOT NULL REFERENCES instruments(instrument_id),
  revision bigint NOT NULL,
  units numeric(78,0) NOT NULL CHECK (units >= 0),
  PRIMARY KEY (portfolio_id, allocation_id, instrument_id),
  FOREIGN KEY (portfolio_id, revision) REFERENCES portfolio_revisions(portfolio_id, revision)
);

CREATE TABLE rule_changes (
  portfolio_id text NOT NULL,
  revision bigint NOT NULL,
  rule_id text NOT NULL,
  version bigint NOT NULL,
  review_hash text NOT NULL,
  state text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (portfolio_id, revision),
  FOREIGN KEY (portfolio_id, revision) REFERENCES portfolio_revisions(portfolio_id, revision),
  FOREIGN KEY (portfolio_id, rule_id, version) REFERENCES rule_versions(portfolio_id, rule_id, version)
);
