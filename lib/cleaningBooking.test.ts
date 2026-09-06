import assert from "node:assert/strict";
import test from "node:test";
import { bookingPricePence, CLEANING_DURATIONS, recommendedCleaningMinutes, validCleaningDuration, validPropertySize } from "./cleaningBooking";

test("cleaning has exactly 13 valid half-hour choices", () => {
  assert.equal(CLEANING_DURATIONS.length, 13);
  for (const minutes of [120,150,180,210,240,270,300,330,360,390,420,450,480]) assert.equal(validCleaningDuration(minutes), true);
  for (const minutes of [0,60,119,170,225,481,510,NaN,Infinity]) assert.equal(validCleaningDuration(minutes), false);
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
test("checkout quotes use the original package rate and round to pence", () => {
  const pkg = { price: 50, duration_minutes: 120, service_type: "cleaning" };
  assert.equal(bookingPricePence(pkg, 120), 5000);
  assert.equal(bookingPricePence(pkg, 150), 6250);
  assert.equal(bookingPricePence(pkg, 480), 20000);
  assert.throws(() => bookingPricePence(pkg, 170));
  assert.throws(() => bookingPricePence({ ...pkg, price: NaN }, 120));
  assert.equal(bookingPricePence({ price: 75, duration_minutes: 90, service_type: "massage" }, 90), 7500);
});
