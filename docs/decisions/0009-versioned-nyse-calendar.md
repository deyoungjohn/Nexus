# ADR 0009: Pin the published NYSE calendar and fail closed on revisions

- Status: accepted for read-only P5.5 evidence; live release remains gated
- Date: 2026-09-26
- Owners: Codex (implementation)

## Context

The Market Gate needs a dated America/New_York session record independent of
token transferability. NYSE publishes 2026–2028 holidays, early closes and
regular core hours on a public page, but that page can change. A calendar
generated from unreviewed static dates could miss an exchange revision.

## Decision

Version the reviewed NYSE holiday table and early-close notes by SHA-256 of
the relevant published HTML section. Fetch the official page before issuing
each session record. If the page, schedule section, network or expected digest
changes, return no evidence until a human reviews and updates the schedule and
digest. Limit the implemented date range to 2026–2027 and expire each receipt
after five minutes. Mark weekends closed, listed holidays as holidays, and
early closes with the actual 13:00 local close. The ordinary session remains
09:30–16:00 America/New_York. P5's policy can conservatively block early-close
days unless separately configured for the shorter session.

## Consequences

Live read-only checks on 2026-09-26 matched the reviewed publisher section
and produced correct weekend, regular, holiday and early-close evidence.
Layout changes can block trading even without schedule changes; that is an
intentional fail-closed maintenance event. This source does not identify
intraday emergency closures or a particular stock's halt, which require
separate evidence. No trade permission follows from a calendar match.

Source: [NYSE holidays and trading hours](https://www.nyse.com/markets/hours-calendars).
