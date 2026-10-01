-- P7 stores signed bytes before any external submission. Existing P3 records
-- remain intact; every EOA leg is frozen until receipt-aware reconciliation.
ALTER TABLE portfolios ADD COLUMN owner_wallet text;
ALTER TABLE portfolios ADD COLUMN execution_paused boolean NOT NULL DEFAULT true;
ALTER TABLE portfolios ADD CONSTRAINT owner_wallet_shape
  CHECK (owner_wallet IS NULL OR owner_wallet ~ '^0x[0-9a-f]{40}$');

CREATE TABLE eoa_execution_legs (
  id text PRIMARY KEY,
  portfolio_id text NOT NULL REFERENCES portfolios(id),
  plan_id text NOT NULL REFERENCES plans(id),
  reservation_id text NOT NULL UNIQUE REFERENCES reservations(id),
  chain_id integer NOT NULL CHECK (chain_id > 0),
  wallet text NOT NULL,
  side text NOT NULL CHECK (side IN ('buy', 'sell')),
  token_in text NOT NULL,
  token_out text NOT NULL,
  input_raw numeric(78, 0) NOT NULL CHECK (input_raw > 0),
  minimum_output_raw numeric(78, 0) NOT NULL CHECK (minimum_output_raw > 0),
  tx_nonce bigint NOT NULL CHECK (tx_nonce >= 0),
  tx_hash text NOT NULL UNIQUE CHECK (tx_hash ~ '^0x[0-9a-f]{64}$'),
  signed_transaction text NOT NULL CHECK (signed_transaction ~ '^0x[0-9a-f]+$'),
  authorization_nonce text NOT NULL UNIQUE,
  approval_hash text NOT NULL CHECK (approval_hash ~ '^0x[0-9a-f]{64}$'),
  evidence_hash text NOT NULL CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  state text NOT NULL CHECK (state IN ('signed', 'unknown', 'included', 'confirmed', 'reverted', 'replaced', 'reorged')),
  attempted_at timestamptz,
  included_block bigint,
  included_block_hash text,
  receipt_success boolean,
  replacement_hash text CHECK (replacement_hash IS NULL OR replacement_hash ~ '^0x[0-9a-f]{64}$'),
  balance_block bigint,
  balance_block_hash text CHECK (balance_block_hash IS NULL OR balance_block_hash ~ '^0x[0-9a-f]{64}$'),
  spent_raw numeric(78, 0) CHECK (spent_raw IS NULL OR spent_raw >= 0),
  received_raw numeric(78, 0) CHECK (received_raw IS NULL OR received_raw >= 0),
  reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((included_block IS NULL AND included_block_hash IS NULL AND receipt_success IS NULL)
    OR (included_block IS NOT NULL AND included_block_hash IS NOT NULL
      AND included_block_hash ~ '^0x[0-9a-f]{64}$'
      AND receipt_success IS NOT NULL))
);
CREATE UNIQUE INDEX eoa_nonce_once ON eoa_execution_legs(chain_id, lower(wallet), tx_nonce);
CREATE INDEX eoa_unresolved_by_portfolio ON eoa_execution_legs(portfolio_id, state)
  WHERE state IN ('signed', 'unknown', 'included', 'reorged');
