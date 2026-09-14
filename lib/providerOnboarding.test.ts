import assert from "node:assert/strict";
import test from "node:test";
import {
  canFinalizeProviderPartnership,
  estimateProviderMonthlyEarnings,
  isOptionalUtrNumber,
  isProviderResidentStatus,
  isProviderWeeklyHours,
} from "./providerOnboarding";

test("professional availability accepts every whole hour from zero through forty", () => {
  assert.equal(isProviderWeeklyHours(0), true);
  assert.equal(isProviderWeeklyHours(40), true);
  assert.equal(isProviderWeeklyHours(-1), false);
  assert.equal(isProviderWeeklyHours(41), false);
  assert.equal(isProviderWeeklyHours(20.5), false);
});

test("the earnings simulation follows the selected weekly hours", () => {
  assert.equal(estimateProviderMonthlyEarnings(0), 0);
  assert.equal(estimateProviderMonthlyEarnings(20), 1290);
  assert.equal(estimateProviderMonthlyEarnings(40), 2580);
});

test("professional status only accepts the displayed UK resident options", () => {
  assert.equal(isProviderResidentStatus("British or Irish citizen"), true);
  assert.equal(isProviderResidentStatus("Student Visa"), true);
  assert.equal(isProviderResidentStatus("Tourist"), false);
});

test("UTR is optional but must contain ten digits when supplied", () => {
  assert.equal(isOptionalUtrNumber(null), true);
  assert.equal(isOptionalUtrNumber(""), true);
  assert.equal(isOptionalUtrNumber("1234567890"), true);
  assert.equal(isOptionalUtrNumber("12345"), false);
});

test("only self-employed professionals can finalize the partnership", () => {
  assert.equal(canFinalizeProviderPartnership(true), true);
  assert.equal(canFinalizeProviderPartnership(false), false);
  assert.equal(canFinalizeProviderPartnership("agree"), false);
});
