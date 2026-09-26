import type { SessionEvidence } from "./evidence.js";

function localParts(at: Date, zone: string): { date: string; time: string; weekday: string } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit",
      day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(at);
    const get = (type: string): string => parts.find((part) => part.type === type)?.value ?? "";
    return { date: `${get("year")}-${get("month")}-${get("day")}`,
      time: `${get("hour")}:${get("minute")}`, weekday: get("weekday") };
  } catch { return null; }
}

/** A dated, sourced calendar record is required even for apparently ordinary weekdays. */
export function regularSessionOpen(now: Date, session: SessionEvidence): boolean {
  const local = localParts(now, session.exchangeZone);
  if (!local || !/^\d{4}-\d{2}-\d{2}$/.test(session.localDate)
    || !/^([01]\d|2[0-3]):[0-5]\d$/.test(session.openLocal)
    || !/^([01]\d|2[0-3]):[0-5]\d$/.test(session.closeLocal)) return false;
  return session.status === "regular" && local.date === session.localDate
    && local.weekday !== "Sat" && local.weekday !== "Sun"
    && session.openLocal < session.closeLocal
    && local.time >= session.openLocal && local.time < session.closeLocal;
}
