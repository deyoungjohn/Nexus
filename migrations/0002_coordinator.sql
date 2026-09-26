ALTER TABLE portfolios ADD COLUMN active_policy_id text REFERENCES policies(id);

CREATE TABLE instruments (
  instrument_id text PRIMARY KEY,
  asset_id text NOT NULL UNIQUE,
  body jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE coordination_occurrences (
  portfolio_id text NOT NULL REFERENCES portfolios(id),
  occurrence_id text NOT NULL,
  plan_id text NOT NULL UNIQUE,
  decision_record_id text NOT NULL UNIQUE REFERENCES decision_records(id),
  PRIMARY KEY (portfolio_id, occurrence_id)
);

CREATE INDEX decision_records_by_portfolio_revision
  ON decision_records(portfolio_id, revision, recorded_at);
