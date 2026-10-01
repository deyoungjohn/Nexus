import { requireInput } from "../domain/errors.js";

export interface RuleSchedule {
  readonly zone: string;
  readonly frequency: "daily" | "weekly";
  /** Sunday=0 through Saturday=6; required only for weekly rules. */
  readonly weekday: number | null;
  readonly localTime: string;
  /** Absolute UTC minutes after the first matching wall-clock instant. */
  readonly windowMinutes: number;
}

export interface ScheduleOccurrence {
  readonly localDate: string;
  readonly dueAt: string;
}

function formatter(zone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit"
  });
}

function localParts(format: Intl.DateTimeFormat, instant: Date): { date: string; time: string } {
  const values = Object.fromEntries(format.formatToParts(instant).map((part) => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
}

export function validateRuleSchedule(schedule: RuleSchedule): void {
  requireInput(typeof schedule.zone === "string" && schedule.zone.length > 0, "INVALID_ZONE", "IANA timezone is required.");
  try { formatter(schedule.zone); } catch { requireInput(false, "INVALID_ZONE", "Unsupported IANA timezone."); }
  requireInput(schedule.frequency === "daily" || schedule.frequency === "weekly", "INVALID_SCHEDULE", "Unknown frequency.");
  requireInput(/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.localTime), "INVALID_SCHEDULE", "Use local HH:mm time.");
  requireInput(Number.isSafeInteger(schedule.windowMinutes) && schedule.windowMinutes >= 1 && schedule.windowMinutes <= 180,
    "INVALID_SCHEDULE", "Schedule window must be 1–180 minutes.");
  requireInput(schedule.frequency === "weekly"
    ? Number.isInteger(schedule.weekday) && schedule.weekday !== null && schedule.weekday >= 0 && schedule.weekday <= 6
    : schedule.weekday === null, "INVALID_SCHEDULE", "Weekday belongs only to a weekly schedule.");
}

/** A nonexistent DST wall time is skipped. An overlap uses the first instant. */
export function scheduleOccurrence(schedule: RuleSchedule, now: Date): ScheduleOccurrence | null {
  validateRuleSchedule(schedule);
  requireInput(now instanceof Date && Number.isFinite(now.getTime()), "INVALID_CLOCK", "Valid clock required.");
  const format = formatter(schedule.zone);
  const local = localParts(format, now);
  const localDay = new Date(`${local.date}T00:00:00.000Z`);
  requireInput(Number.isFinite(localDay.getTime()), "INVALID_CLOCK", "Valid local date required.");
  // A bounded absolute window may still be due after local midnight.
  const previous = new Date(localDay.getTime() - 86_400_000);
  for (const day of [previous, localDay]) {
    if (schedule.frequency === "weekly" && day.getUTCDay() !== schedule.weekday) continue;
    const date = day.toISOString().slice(0,10);
    const nominal = Date.parse(`${date}T${schedule.localTime}:00.000Z`);
    let first: number | null = null;
    // Global IANA offsets are multiples of 15 minutes in the supported schedule domain.
    for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
      const candidate = nominal - offset * 60_000;
      const parts = localParts(format, new Date(candidate));
      if (parts.date === date && parts.time === schedule.localTime
        && (first === null || candidate < first)) first = candidate;
    }
    if (first !== null && now.getTime() >= first && now.getTime() < first + schedule.windowMinutes * 60_000)
      return { localDate: date, dueAt: new Date(first).toISOString() };
  }
  return null;
}
