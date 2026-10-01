-- Recovery provenance commits with the observation/fill it describes.
CREATE TABLE eoa_recovery_attempts (
  id uuid PRIMARY KEY,
  leg_id text NOT NULL REFERENCES eoa_execution_legs(id),
  configuration_hash text NOT NULL CHECK (configuration_hash ~ '^[0-9a-f]{64}$'),
  configuration jsonb NOT NULL,
  outcome text NOT NULL DEFAULT 'started',
  reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX eoa_recovery_attempts_by_leg ON eoa_recovery_attempts(leg_id, started_at DESC);

CREATE TABLE eoa_recovery_evidence (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attempt_id uuid NOT NULL REFERENCES eoa_recovery_attempts(id),
  leg_id text NOT NULL REFERENCES eoa_execution_legs(id),
  source_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('observation', 'reconciliation')),
  block_number bigint,
  block_hash text CHECK (block_hash IS NULL OR block_hash ~ '^0x[0-9a-f]{64}$'),
  evidence jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
