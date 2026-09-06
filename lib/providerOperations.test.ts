import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTO_CHECKOUT_GRACE_MINUTES,
  nextFortnightlyPayoutAt,
  providerAutoCheckoutAt,
} from "./providerOperations";

test("automatic checkout becomes due exactly ten minutes after the booked end", () => {
  assert.equal(AUTO_CHECKOUT_GRACE_MINUTES, 10);
  assert.equal(
    providerAutoCheckoutAt("2026-09-07T07:00:00.000Z", 150).toISOString(),
    "2026-09-07T09:40:00.000Z",
  );
});

test("fortnightly payouts retain the same UTC time every fourteen days", () => {
  assert.equal(
    nextFortnightlyPayoutAt("2026-09-07T10:30:00.000Z").toISOString(),
    "2026-09-21T10:30:00.000Z",
  );
});
