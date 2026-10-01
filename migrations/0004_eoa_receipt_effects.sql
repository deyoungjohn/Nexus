-- Preserve a digest of the canonical receipt effects used for reconciliation.
ALTER TABLE eoa_execution_legs ADD COLUMN receipt_effects_hash text
  CHECK (receipt_effects_hash IS NULL OR receipt_effects_hash ~ '^[0-9a-f]{64}$');
