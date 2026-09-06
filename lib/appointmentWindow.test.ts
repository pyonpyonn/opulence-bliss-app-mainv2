import assert from "node:assert/strict";
import test from "node:test";
import { appointmentFitsWindow, londonDate, londonParts } from "./appointmentWindow";

test("starts range from 7 AM through 8 PM, including overnight sessions", () => {
  assert.equal(appointmentFitsWindow(londonDate(2026, 9, 12, 7), 120), true);
  assert.equal(appointmentFitsWindow(londonDate(2026, 9, 12, 6, 30), 120), false);
  assert.equal(appointmentFitsWindow(londonDate(2026, 9, 12, 20), 480), true);
  assert.equal(appointmentFitsWindow(londonDate(2026, 9, 12, 20, 30), 120), false);
});
test("start times reject irregular minutes, seconds and invalid inputs", () => {
  assert.equal(appointmentFitsWindow(londonDate(2026, 9, 12, 12, 30), 150), true);
  assert.equal(appointmentFitsWindow(londonDate(2026, 9, 12, 12, 45), 150), false);
  assert.equal(appointmentFitsWindow(new Date(londonDate(2026, 9, 12, 12).getTime() + 1000), 150), false);
  assert.equal(appointmentFitsWindow("invalid", 120), false);
  assert.equal(appointmentFitsWindow(londonDate(2026, 9, 12, 12), NaN), false);
});
test("London calendar conversion handles summer, winter and DST boundaries", () => {
  assert.equal(londonDate(2026, 8, 12, 7).toISOString(), "2026-08-12T06:00:00.000Z");
  assert.equal(londonDate(2026, 12, 12, 7).toISOString(), "2026-12-12T07:00:00.000Z");
  assert.equal(londonDate(2026, 3, 29, 7).toISOString(), "2026-03-29T06:00:00.000Z");
  assert.equal(londonDate(2026, 10, 25, 7).toISOString(), "2026-10-25T07:00:00.000Z");
  assert.equal(londonParts("2026-08-12T18:00:00.000Z").hour, 19);
});
