# Manual issuer-event review for P5.5

This is the P2-selected manual source process for NVDA and AAPL. It records
issuer announcements for P5's `EventEvidence`; it is not an automated
earnings feed. A reviewer must repeat it before each execution leg when the
record expires or the issuer changes a date. No date-dependent live rule is
currently enabled.

1. Open the official [NVIDIA events](https://investor.nvidia.com/events-and-presentations/events-and-presentations/default.aspx)
   and [financial reports](https://investor.nvidia.com/financial-info/financial-reports/default.aspx),
   or Apple's [investor relations](https://investor.apple.com/investor-relations/default.aspx)
   and [Newsroom financial releases](https://www.apple.com/newsroom/).
   Check the specific issuer's latest earnings announcement and any correction
   or corporate-action notice. A press release with a confirmed date and
   timezone is stronger evidence than a third-party earnings estimate.
2. Record the exact HTTPS issuer URL, retrieval time, source revision or
   content digest, confirmed event time with timezone, and the policy blackout
   window. Use `confirmed` only if the issuer has actually announced the date.
   A changed announcement creates a new revision and invalidates dependent
   plans. If the issuer explicitly says no next date is announced, a reviewer
   may record `none-confirmed` with the checked source and short expiry.
3. Use `uncertain` when a source is inaccessible, dynamic content cannot be
   inspected, two issuer pages conflict, only an estimated third-party date
   exists, or no authoritative statement about the next event is visible.
   Use `withdrawn` if the issuer withdraws a prior date. These states block
   the P5 gate. Never infer `none-confirmed` from a blank or failed page.
4. Recheck the issuer source before each proposed leg and immediately after
   any event or correction alert. The runtime record must be fresh under the
   market policy; the future P7 worker must compare the evidence hash and
   pause on a new revision. Operator notes may contain no identity details
   beyond a role identifier. Repository examples must be synthetic.

Read-only review on 2026-09-26: NVIDIA's financial-results page identified
its latest reported quarter and its events page exposed no machine-readable
next earnings date through the text view. Apple's investor page also relies
on dynamic sections. This was **not** converted into a `none-confirmed`
record. No issuer-event evidence currently authorizes live use.
