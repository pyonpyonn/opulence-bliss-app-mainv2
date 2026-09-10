import assert from "node:assert/strict";
import test from "node:test";
import {
  effectiveReviewVisibility,
  isPositiveCleanerReview,
} from "./reviewVisibility";

test("one to three star cleaner reviews are always private", () => {
  for (const rating of [1, 2, 3]) {
    assert.equal(effectiveReviewVisibility(rating, "public"), "private");
    assert.equal(isPositiveCleanerReview(rating), false);
  }
});

test("four and five star reviews can be public", () => {
  for (const rating of [4, 5]) {
    assert.equal(effectiveReviewVisibility(rating, "public"), "public");
    assert.equal(isPositiveCleanerReview(rating), true);
  }
});

test("a customer can keep a positive review private", () => {
  assert.equal(effectiveReviewVisibility(5, "private"), "private");
  assert.equal(effectiveReviewVisibility(5, undefined), "private");
});

test("a professional can make any client review public or private", () => {
  assert.equal(effectiveReviewVisibility(1, "public", "provider"), "public");
  assert.equal(effectiveReviewVisibility(5, "private", "provider"), "private");
});
