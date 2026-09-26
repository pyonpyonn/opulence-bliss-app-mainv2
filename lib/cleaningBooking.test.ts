import assert from "node:assert/strict";
import test from "node:test";
import { bookingPricePence, CLEANING_DURATIONS, CLEANING_SESSION_ORDER, cleaningHourlyRatePence, compareCleaningSessions, recommendedCleaningMinutes, validCleaningDuration, validPropertySize } from "./cleaningBooking";

test("cleaning permits two through eight hours in half-hour steps", () => {
  assert.equal(CLEANING_DURATIONS.length, 13);
  for (const minutes of [120,150,180,210,240,270,300,330,360,390,420,450,480]) assert.equal(validCleaningDuration(minutes), true);
  for (const minutes of [0,60,119,170,225,510,600,NaN,Infinity]) assert.equal(validCleaningDuration(minutes), false);
});
test("cleaning sessions retain the catalogue order", () => {
  const shuffled = CLEANING_SESSION_ORDER.map((name) => ({ name })).reverse();
  assert.deepEqual(shuffled.sort(compareCleaningSessions).map((item) => item.name), [...CLEANING_SESSION_ORDER]);
});
test("property-size guidance rounds up and caps at eight hours", () => {
  assert.equal(validPropertySize(0), false);
  assert.equal(validPropertySize(Infinity), false);
  assert.equal(validPropertySize(-1), false);
  assert.equal(recommendedCleaningMinutes(35), 120);
  assert.equal(recommendedCleaningMinutes(71), 150);
  assert.equal(recommendedCleaningMinutes(90), 180);
  assert.equal(recommendedCleaningMinutes(500), 480);
});
test("cleaning hourly rates and checkout totals stay proportional", () => {
  assert.equal(cleaningHourlyRatePence({ price: 37.8, duration_minutes: 120 }), 1890);
  assert.equal(cleaningHourlyRatePence({ price: 45.98, duration_minutes: 120 }), 2299);
  assert.equal(cleaningHourlyRatePence({ price: 74.7, duration_minutes: 180 }), 2490);
  const pkg = { price: 50, duration_minutes: 120, service_type: "cleaning" };
  assert.equal(bookingPricePence(pkg, 120), 5000);
  assert.equal(bookingPricePence(pkg, 150), 6250);
  assert.equal(bookingPricePence(pkg, 480), 20000);
  assert.throws(() => bookingPricePence(pkg, 510));
  assert.throws(() => bookingPricePence(pkg, 170));
  assert.throws(() => bookingPricePence({ ...pkg, price: NaN }, 120));
});
