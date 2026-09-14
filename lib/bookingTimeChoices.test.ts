import assert from "node:assert/strict";
import test from "node:test";
import { londonDate } from "./appointmentWindow";
import {
  normaliseOptionalBookingTimes,
} from "./bookingTimeChoices";

const now = new Date("2026-09-14T08:00:00.000Z");
const preferred = londonDate(2026, 9, 20, 10).toISOString();

test("optional booking times are normalised and sorted", () => {
  const later = londonDate(2026, 9, 22, 12).toISOString();
  const earlier = londonDate(2026, 9, 21, 9, 30).toISOString();
  assert.deepEqual(
    normaliseOptionalBookingTimes([later, earlier], preferred, 120, now),
    [earlier, later],
  );
});

test("optional booking times must be distinct from the preferred time", () => {
  assert.throws(
    () => normaliseOptionalBookingTimes([preferred], preferred, 120, now),
    /distinct/,
  );
  const alternative = londonDate(2026, 9, 21, 9).toISOString();
  assert.throws(
    () =>
      normaliseOptionalBookingTimes(
        [alternative, alternative],
        preferred,
        120,
        now,
      ),
    /distinct/,
  );
});

test("optional booking times use the same booking window", () => {
  assert.throws(
    () =>
      normaliseOptionalBookingTimes(
        [londonDate(2026, 9, 21, 19).toISOString()],
        preferred,
        120,
        now,
      ),
    /valid/,
  );
});

test("customers can add every valid optional time without an arbitrary cap", () => {
  const alternatives = Array.from({ length: 40 }, (_, index) =>
    londonDate(2026, 9, 21 + index, 9).toISOString(),
  );
  assert.equal(
    normaliseOptionalBookingTimes(alternatives, preferred, 120, now).length,
    40,
  );
});
