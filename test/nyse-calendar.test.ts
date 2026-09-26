import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { adaptNyseSession, fetchNyseSession } from "../src/market-gate/nyse-calendar.js";

const section = '<table class="table-data"><tr><td>2026</td></tr></table><p>Thursday, December 24, 2026</p><h3>Trading Hours';
const digest = createHash("sha256").update(section.slice(0, section.indexOf("Trading Hours"))).digest("hex");
const at = "2026-09-26T18:00:00.000Z";

test("P5.5 NYSE calendar distinguishes regular, holiday, weekend and early close", () => {
  assert.equal(adaptNyseSession(section, "2026-09-28", at, digest)?.status, "regular");
  assert.equal(adaptNyseSession(section, "2026-11-26", at, digest)?.status, "holiday");
  assert.equal(adaptNyseSession(section, "2026-09-26", at, digest)?.status, "closed");
  assert.equal(adaptNyseSession(section, "2026-11-27", at, digest)?.closeLocal, "13:00");
  assert.equal(adaptNyseSession(section, "2027-12-24", at, digest)?.status, "holiday");
});

test("P5.5 NYSE calendar blocks revised, invalid and out-of-range schedules", async () => {
  assert.equal(adaptNyseSession(section.replace("2026</td>", "2028</td>"), "2026-09-28", at, digest), null);
  assert.equal(adaptNyseSession(section, "2028-09-28", at, digest), null);
  assert.equal(adaptNyseSession(section, "2026-02-30", at, digest), null);
  const outage = (async () => new Response("unavailable", { status: 503 })) as typeof fetch;
  assert.equal(await fetchNyseSession("2026-09-28", outage), null);
});
