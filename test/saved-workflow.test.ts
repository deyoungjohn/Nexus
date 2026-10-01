import assert from "node:assert/strict";
import { test } from "node:test";
import { decimalUnits, formattedUnits, targetBps } from "../web/lib/saved-workflow.js";
test("P8 saved drafts preserve exact decimal units and fractional target weights", () => {
  assert.equal(decimalUnits("5.000000000000000001",18),"5000000000000000001");
  assert.equal(formattedUnits("5000000000000000001",18),"5.000000000000000001");
  assert.equal(formattedUnits("0",18),"0.0");
  assert.equal(decimalUnits("12",0),"12");
  assert.equal(targetBps("33.33"),3333);
  assert.equal(targetBps("100"),10000);
  assert.equal(targetBps("0.00"),0);
  assert.throws(() => targetBps("0.000"));
  for (const invalid of ["0","-1","1e3"," 5","01","1.001"]) assert.throws(() => decimalUnits(invalid,2));
  assert.throws(() => targetBps("100.01"));
  assert.throws(() => decimalUnits("1".repeat(79),0));
});
