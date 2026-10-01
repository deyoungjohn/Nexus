# Reproducing bStocks public source and governance research

Date: 2026-10-01. Work items: P5.5d/P7.1.
These commands read public data and compile source locally. They do not sign,
broadcast, approve a trade, submit remote source verification or authorize risk.

## Preserved evidence

- [Inspection report](../../integrations/2026-10-01-bstocks-governance.md)
  and [same-block RPC snapshot](../../integrations/2026-10-01-bstocks-governance.json).
- [Beacon standard input](beacon-standard-input.json), containing four unmodified
  MIT-licensed OpenZeppelin v5.2.0 files and the recovered compiler settings.
- [Local rebuild results](source-rebuilds.json), including compiled/deployed
  bytecode, hashes, exact/executable match distinctions and sanitized layouts.
- [OpenZeppelin license](LICENSE.OpenZeppelin), retained with the source input.

Official source provenance: the v5.2.0 tag's
[UpgradeableBeacon](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.2.0/contracts/proxy/beacon/UpgradeableBeacon.sol),
[IBeacon](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.2.0/contracts/proxy/beacon/IBeacon.sol),
[Ownable](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.2.0/contracts/access/Ownable.sol)
and [Context](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.2.0/contracts/utils/Context.sol).
The exact deployed match establishes this build's correspondence; it does not
identify which release the issuer originally downloaded.

## Fresh public inspection

From the repository root, after installing existing pinned project dependencies:

```sh
node --network-family-autoselection-attempt-timeout=2000 \
  scripts/inspect-bstocks-governance.mjs > /tmp/nexus-governance.json
```

Research defaults are Sentio and Blast. Anonymous providers can throttle or fail.
Set `NEXUS_GOVERNANCE_RPC` and `NEXUS_GOVERNANCE_BACKUP_RPC` to trusted distinct
HTTPS BSC sources supporting canonical hash references. The connection-attempt
option above avoided transient connection timeouts on this host. BNB Chain's
public RPC returned `missing trie node` during a pinned read; do not treat a
passing chain-ID or interface probe as full proof availability.
The inspector bounds request concurrency/load and read retries; it never mixes
blocks or substitutes an RPC failure for a successful permission test.
Fresh inspection stdout is emitted only when the full comparison succeeds.
Without `NEXUS_GOVERNANCE_BLOCK`, the script selects latest minus 64 blocks.
Recent-state availability can lag on archival endpoints even when older state
is available. Replay the inspection's initial public observation block with:

```sh
NEXUS_GOVERNANCE_BLOCK=0x77495fe \
  NEXUS_GOVERNANCE_BACKUP_RPC=https://bsc-mainnet.public.blastapi.io \
  node --network-family-autoselection-attempt-timeout=2000 \
  scripts/inspect-bstocks-governance.mjs > /tmp/nexus-governance-replay.json
```

This is historical research at a specified block, not fresh live-trade evidence.
Blockmachine's sampled code read succeeded, but a later same-block storage read
reported unavailable historical state. The preserved comparison therefore uses
Blast as the second endpoint. This does not change Nexus's production recovery
configuration or qualify Blast for every recovery interface.

## Source rebuild

The repository check also runs three offline research regressions: unavailable
RPC errors cannot prove denial, a returned false cannot prove inner execution,
and invalid replay blocks/unsafe endpoints are rejected before network access.
They can be run separately with:

```sh
node --test scripts/inspect-bstocks-governance.test.mjs
```

Install the two compiler versions outside the project; project packages and lock
files must remain unchanged. No compilation requires a wallet or paid service.

```sh
npm install --prefix /tmp/nexus-governance-compiler --no-save --ignore-scripts \
  solc@0.8.24 solc084@npm:solc@0.8.4
NEXUS_SOLC_0824_MODULE=/tmp/nexus-governance-compiler/node_modules/solc/index.js \
NEXUS_SOLC_084_MODULE=/tmp/nexus-governance-compiler/node_modules/solc084/index.js \
  node --network-family-autoselection-attempt-timeout=2000 \
  scripts/verify-bstocks-governance-sources.mjs > /tmp/nexus-rebuilds.json
```

The default evidence input is the checked-in dated snapshot. Set
`NEXUS_GOVERNANCE_EVIDENCE=/tmp/nexus-governance.json` to rebuild against a fresh
inspection. Source records are fetched anew from Sourcify, compared to the
observed runtime, then compiled with their published compiler settings.
The beacon is rebuilt from the local preserved standard input.

Remote compiler input can contain a developer's personal absolute source path.
Original path names are used transiently to preserve metadata fidelity but are
not retained in the report or shared memory. Results preserve a compiler-input
digest, public source URL, contract name and storage labels/types instead.

## Limits

This establishes source correspondence and sampled current permissions. It is
not an independent audit, custody/backing attestation, identity determination,
historical governance-event analysis, exhaustive access-control test or accepted
risk policy. No constructor/creation-bytecode match is claimed. The beacon's
external Sourcify availability and the production collector are unchanged.
Snapshot/rebuild JSON is research evidence, never a trusted review-registry entry.

A future adapter must also bind the privileged proxies' inner implementations,
administrators and ownership state; their unchanged outer runtime is insufficient.
See [ADR 0027](../../decisions/0027-local-source-recovery-governance-evidence.md).
