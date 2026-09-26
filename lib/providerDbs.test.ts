import test from "node:test";
import assert from "node:assert/strict";
import {
  DBS_CERTIFICATE_MAX_BYTES,
  dbsCertificateExtension,
  isDbsCertificateNumber,
  isDbsIssueDate,
  isSupportedDbsCertificate,
  normalizeDbsCertificateNumber,
} from "./providerDbs";

test("DBS certificate numbers contain exactly twelve digits", () => {
  assert.equal(normalizeDbsCertificateNumber("0012 3456 7890"), "001234567890");
  assert.equal(isDbsCertificateNumber("0012 3456 7890"), true);
  assert.equal(isDbsCertificateNumber("123456"), false);
});

test("DBS issue dates must be valid, non-future dates", () => {
  const now = new Date("2026-09-25T12:00:00Z");
  assert.equal(isDbsIssueDate("2026-09-25", now), true);
  assert.equal(isDbsIssueDate("2026-09-26", now), false);
  assert.equal(isDbsIssueDate("2026-02-31", now), false);
  assert.equal(isDbsIssueDate("1999-12-31", now), false);
  assert.equal(isDbsIssueDate("not-a-date", now), false);
});

test("DBS uploads accept PDF and common image formats up to eight megabytes", () => {
  assert.equal(dbsCertificateExtension("check.pdf", "application/pdf"), "pdf");
  assert.equal(dbsCertificateExtension("check.jpeg", ""), "jpg");
  assert.equal(isSupportedDbsCertificate("check.png", "image/png", 1024), true);
  assert.equal(
    isSupportedDbsCertificate(
      "check.pdf",
      "application/pdf",
      DBS_CERTIFICATE_MAX_BYTES + 1,
    ),
    false,
  );
  assert.equal(isSupportedDbsCertificate("check.exe", "", 1024), false);
  assert.equal(
    isSupportedDbsCertificate("check.exe", "application/pdf", 1024),
    false,
  );
  assert.equal(
    isSupportedDbsCertificate("check.png", "application/pdf", 1024),
    false,
  );
});
