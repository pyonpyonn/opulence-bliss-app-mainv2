import assert from "node:assert/strict";
import test from "node:test";
import { bookingPolicyError } from "./bookingPolicy";

test("regular rate cannot be checked out for a single visit", () => {
  assert.match(bookingPolicyError("Essential Clean", "one_time") ?? "", /six visits/);
});

test("a stated regular frequency requires the regular package", () => {
  for (const frequency of ["weekly", "monthly"]) {
    assert.equal(bookingPolicyError("Essential Clean", frequency), null);
    assert.match(bookingPolicyError("One-Time Essential Clean", frequency) ?? "", /Essential Clean/);
  }
});

test("one-time packages remain available for a single visit", () => {
  assert.equal(bookingPolicyError("One-Time Essential Clean", "one_time"), null);
  assert.equal(bookingPolicyError("Signature Deep Clean", "one_time"), null);
});

test("unknown frequencies are rejected", () => {
  assert.match(bookingPolicyError("One-Time Essential Clean", "fortnightly") ?? "", /valid/);
});
