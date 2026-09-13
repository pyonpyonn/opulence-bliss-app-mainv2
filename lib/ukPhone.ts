import { parsePhoneNumberFromString } from "libphonenumber-js";

export function getUkPhoneDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

export function isValidUkPhone(value: unknown) {
  const rawValue = String(value ?? "").trim();
  const digits = getUkPhoneDigits(rawValue);

  if (!/^[\d\s()-]+$/.test(rawValue) || digits.length !== 10) {
    return false;
  }

  const phoneNumber = parsePhoneNumberFromString(`+44${digits}`);
  return phoneNumber?.country === "GB" && phoneNumber.isValid();
}

export function normalizeUkPhone(value: unknown) {
  return `+44${getUkPhoneDigits(value)}`;
}
