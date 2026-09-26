# ADR 0007: Source equity price age and Ondo share exposure independently

- Status: accepted for read-only integration; live release remains gated
- Date: 2026-09-26
- Owners: Codex (implementation); project owner (eligibility and risk policy pending)

## Context

The P2 Binance public RWA price payload has no provider-origin price timestamp.
Its display multiplier was observed against the supervised trade, but that
observation is not a durable economic mapping. Ondo's published BSC
SyntheticSharesOracle provides per-asset `sValue`, an active pause flag and
corporate-action metadata. Pyth Pro exposes the underlying equity's
`feedUpdateTimestamp`, distinct from a transport/envelope timestamp; price
access requires a server-side API key. An Ondo display/reference price is
explicitly indicative, not an execution oracle.

## Decision

Use a Pyth Pro equity feed for the regular-session USD reference, preserving
`feedUpdateTimestamp` as the source clock. Resolve exact stable feed IDs before
activation, keep the key server-side, and block on missing, carried-forward or
non-regular prices. Use Ondo's published chain-56 oracle at
`0xF4Fd8a1B412633e10527454137A29Db7Aa35F15e` for the raw-token-to-share
ratio. Read `getSValue` and `assetData` at one pinned BSC block; reject absent,
paused or scheduled corporate-action mappings, wrong chain and stale blocks.
The ratio is `sValue / 10^18` for these 18-decimal candidate tokens. The
mapping revision binds token, value and last update; P7 must refresh it before
submission and after each fill.

Neither source replaces owner/venue eligibility, dated exchange calendar,
issuer events, settlement conversion, audit policy or a transaction receipt.
The Pyth shape is verified from documentation and fixtures, not yet from an
authenticated provider response. Its feed IDs and data rights must be checked
again when access is provisioned. Unsupported Binance token audit stays
blocked; issuer contract audits do not equal a token-specific clear result.

## Consequences

Two read-only adapters can feed existing P5 evidence interfaces without a
signer or schema change. A live oracle check on 2026-09-26 returned positive
NVDAon, AMDon and AAPLon ratios and no pause; those values are point-in-time
only. P5.5 and P7 remain incomplete, so Nexus cannot execute a live plan.
See [the live-readiness matrix](../integrations/2026-09-26-live-readiness.md).
