import assert from "node:assert/strict";
import test from "node:test";
import { allocateRegularPayment, regularVisitSlots } from "./regularBooking";
import { londonDate, londonParts } from "./appointmentWindow";
import { bookingPricePence } from "./cleaningBooking";

test("weekly visits keep the same London hour through the autumn clock change", () => {
  const first = londonDate(2026, 10, 19, 9).toISOString();
  const slots = regularVisitSlots(first, "weekly", 120, new Date("2026-10-01"));
  assert.equal(slots.length, 6);
  assert.deepEqual(slots.map((slot) => londonParts(slot).hour), [9, 9, 9, 9, 9, 9]);
  assert.equal(new Date(slots[1]).getTime() - new Date(slots[0]).getTime(), 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000);
});

test("monthly visits keep the original day where possible", () => {
  const first = londonDate(2027, 1, 31, 10).toISOString();
  const slots = regularVisitSlots(first, "monthly", 120, new Date("2027-01-01"));
  assert.deepEqual(slots.map((slot) => londonParts(slot).day), [31, 28, 31, 30, 31, 30]);
});

test("all six dates must fit in the one-year booking horizon", () => {
  const first = londonDate(2027, 9, 1, 10).toISOString();
  assert.throws(() => regularVisitSlots(first, "monthly", 120, new Date("2026-09-25")), /one year/);
});

test("upfront payment is allocated to six visits exactly", () => {
  const visits = allocateRegularPayment(22681, 4519);
  assert.equal(visits.length, 6);
  assert.equal(visits.reduce((sum, visit) => sum + visit.grossPence, 0), 22681);
  assert.equal(visits.reduce((sum, visit) => sum + visit.platformPence, 0), 4519);
  assert.ok(visits.every((visit) => visit.providerPence > 0));
});

test("two hours at the £18.90 regular rate charges six sessions upfront", () => {
  const perVisit = bookingPricePence({
    price: 37.80,
    duration_minutes: 120,
    service_type: "cleaning",
  }, 120);
  assert.equal(perVisit, 3780);
  const visits = allocateRegularPayment(perVisit * 6, Math.round(perVisit * 6 * 0.2));
  assert.equal(visits.reduce((sum, visit) => sum + visit.grossPence, 0), 22680);
  assert.ok(visits.every((visit) => visit.grossPence === 3780));
});
