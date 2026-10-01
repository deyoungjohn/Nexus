# ADR 0027: Preserve rebuilt source and governance facts without granting clearance

- Status: accepted for research evidence; production collector integration deferred
- Date: 2026-10-01
- Work items: P5.5d, P7.1

## Context

The September 30 collector could obtain four of NVDAB's five execution sources.
Its beacon had no Sourcify record and public explorer/IPFS access was unavailable.
Two current privileged addresses had matching proxy code, but their implementation,
administrator and application ownership were unknown. A wrapper fingerprint
alone cannot detect a change to the logic executed through that wrapper.

## Decision

Recover the beacon from the public OpenZeppelin release and reproduce deployed
runtime locally using the original compiler settings and source paths. Preserve
the complete standard input, license, bytecode and hashes as versioned research.
Require a full byte-for-byte match, including metadata, for this recovery claim.
For Sourcify governance sources, distinguish exact matches from executable-only
matches explicitly; the latter do not establish matching compiler metadata.

Inspect the current privileged proxies through canonical EIP-1898 reads,
EIP-1967 implementation/admin slots, source-derived storage layouts, getters and
read-only caller-specific simulations. Compare the entire observation against
another public RPC at the same block hash and recheck canonicality at completion.
A provider/network failure cannot count as a rejected unauthorized call.

Keep local source recovery separate from independent security review, scanner
support and risk acceptance. Do not upload a verification record, populate the
trusted review registry or relax ADR 0026. No application gate, live instrument,
approval, recovery interface or transaction broadcaster changes in this task.

## Consequences

The beacon's public source gap is resolved locally. The two privileged contracts
are identifiable as upgradeable OperatorWallet and BurnWallet instances. Their
current code-free control addresses have single-address on-chain permissions;
no multisignature threshold or timelock is established by these paths. Off-chain
custody/key controls cannot be inferred from a code-free address.

Research evidence is dated, not a standing clearance. A future production
adapter must revalidate the beacon, inner implementation, proxy administrator,
owner/operator and relevant storage/roles at the trade evidence block, with
bounded source provenance and canonical fallback. It must reject changed or
unavailable views. Any accepted centralization/scanner risk needs a distinct,
explicitly approved policy and qualified review; source matching is insufficient.

See [the inspection report](../integrations/2026-10-01-bstocks-governance.md)
and [reproduction instructions](../research/bstocks-governance/README.md).
