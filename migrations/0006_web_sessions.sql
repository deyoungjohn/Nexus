-- Sign-in is separate from trading authority. Store token digests only.
ALTER TABLE portfolios ADD COLUMN data_mode text NOT NULL DEFAULT 'unverified'
  CHECK (data_mode IN ('unverified', 'fixture', 'chain'));
CREATE INDEX portfolios_by_owner ON portfolios(owner_wallet);
CREATE TABLE wallet_challenges (
  id text PRIMARY KEY,
  wallet text NOT NULL CHECK (wallet ~ '^0x[0-9a-f]{40}$'),
  origin text NOT NULL,
  message text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL
);
CREATE INDEX wallet_challenges_by_wallet ON wallet_challenges(wallet, created_at);
CREATE TABLE wallet_sessions (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  wallet text NOT NULL,
  origin text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX wallet_sessions_by_expiry ON wallet_sessions(expires_at);
