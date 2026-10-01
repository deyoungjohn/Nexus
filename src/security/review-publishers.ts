/** Operator-maintained primary auditor publication namespaces. No browser URL trust. */
export const REVIEW_PUBLISHERS = Object.freeze([
  Object.freeze({ id: "etherauthority", organization: "EtherAuthority" }),
  Object.freeze({ id: "peckshield", organization: "PeckShield" })
]);

export function trustedReviewPublication(publisherId: unknown, reportUrl: unknown): boolean {
  if (typeof publisherId !== "string" || typeof reportUrl !== "string") return false;
  try {
    const u = new URL(reportUrl);
    if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash || u.port) return false;
    if (publisherId === "etherauthority") return u.hostname === "raw.githubusercontent.com"
      && /^\/EtherAuthority\/Audit\/[0-9a-f]{40}\/[A-Za-z0-9_.-]+\.pdf$/.test(u.pathname);
    if (publisherId === "peckshield") return u.hostname === "raw.githubusercontent.com"
      && /^\/peckshield\/publications\/[0-9a-f]{40}\/audit_reports\/[A-Za-z0-9_.-]+\.pdf$/.test(u.pathname);
    return false;
  } catch { return false; }
}
