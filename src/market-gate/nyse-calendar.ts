import { createHash } from "node:crypto";
import type { SessionEvidence } from "./evidence.js";

export const NYSE_CALENDAR_URL = "https://www.nyse.com/markets/hours-calendars";
/** Reviewed 2026–2028 holiday table and early-close notes, checked 2026-09-26. */
export const NYSE_CALENDAR_DIGEST = "457f9a0af49bc278cf651dc45d6da105cd24cbdf7470c1e3bef631139d1c63be";

const holidays: Record<string, readonly string[]> = {
  "2026": ["01-01", "01-19", "02-16", "04-03", "05-25", "06-19", "07-03", "09-07", "11-26", "12-25"],
  "2027": ["01-01", "01-18", "02-15", "03-26", "05-31", "06-18", "07-05", "09-06", "11-25", "12-24"]
};
const earlyClose: Record<string, readonly string[]> = {
  "2026": ["11-27", "12-24"],
  "2027": ["11-26"]
};

/** The exact page subsection is versioned; any publisher change requires review. */
export function nyseCalendarSection(html: string): string | null {
  const start = html.indexOf('<table class="table-data');
  const lastEarlyClose = html.indexOf("Thursday, December 24, 2026", start);
  const end = html.indexOf("Trading Hours", lastEarlyClose);
  if (start < 0 || lastEarlyClose < start || end < lastEarlyClose || end - start > 20_000)
    return null;
  return html.slice(start, end);
}

export function adaptNyseSession(html: string, localDate: string, receivedAt: string,
  expectedDigest: string = NYSE_CALENDAR_DIGEST): SessionEvidence | null {
  const section = nyseCalendarSection(html);
  if (!section || createHash("sha256").update(section).digest("hex") !== expectedDigest
    || !/^20(26|27)-\d{2}-\d{2}$/.test(localDate)
    || !Number.isFinite(Date.parse(receivedAt))) return null;
  const parsed = new Date(`${localDate}T12:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== localDate) return null;
  const year = localDate.slice(0, 4), monthDay = localDate.slice(5);
  const weekend = parsed.getUTCDay() === 0 || parsed.getUTCDay() === 6;
  const holiday = holidays[year]?.includes(monthDay) ?? false;
  const early = earlyClose[year]?.includes(monthDay) ?? false;
  const seen = Date.parse(receivedAt);
  return { source: `nyse-calendar:${expectedDigest}`, observedAt: new Date(seen).toISOString(),
    expiresAt: new Date(seen + 300_000).toISOString(), exchangeZone: "America/New_York",
    localDate, openLocal: "09:30", closeLocal: early ? "13:00" : "16:00",
    status: weekend ? "closed" : holiday ? "holiday" : "regular" };
}

/** Read-only public page; a content revision or network failure blocks the session. */
export async function fetchNyseSession(localDate: string, fetcher: typeof fetch = fetch): Promise<SessionEvidence | null> {
  try {
    const response = await fetcher(NYSE_CALENDAR_URL, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const html = await response.text();
    return adaptNyseSession(html, localDate, new Date().toISOString());
  } catch { return null; }
}
