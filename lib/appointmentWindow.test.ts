import assert from "node:assert/strict";
import test from "node:test";
import { appointmentFitsWindow, appointmentTimeLabel, londonDate, londonParts } from "./appointmentWindow";

test("appointments start from 7 AM and finish by 8 PM", () => {
  assert.equal(appointmentFitsWindow(londonDate(2026, 9, 12, 7), 120), true);
  assert.equal(appointmentFitsWindow(londonDate(2026, 9, 12, 6, 30), 120), false);
  assert.equal(appointmentFitsWindow(londonDate(2026, 9, 12, 18), 120), true);
  assert.equal(appointmentFitsWindow(londonDate(2026, 9, 12, 18, 30), 120), false);
  assert.equal(appointmentFitsWindow(londonDate(2026, 9, 12, 12), 480), true);
  assert.equal(appointmentFitsWindow(londonDate(2026, 9, 12, 12, 30), 480), false);
  assert.equal(appointmentFitsWindow(londonDate(2026, 9, 12, 7), 600), true);
  assert.equal(appointmentFitsWindow(londonDate(2026, 9, 12, 10, 30), 600), false);
  assert.equal(appointmentFitsWindow(londonDate(2026, 9, 12, 20), 120), false);
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

test("booking times stay in London time regardless of the viewer's timezone", () => {
  assert.equal(appointmentTimeLabel("2026-09-07T12:00:00.000Z"), "01:00 pm");
  assert.equal(appointmentTimeLabel("2026-09-07T14:00:00.000Z"), "03:00 pm");
});
