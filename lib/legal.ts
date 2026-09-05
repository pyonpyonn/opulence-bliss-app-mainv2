export const TERMS_URL = process.env.NEXT_PUBLIC_TERMS_URL ?? "";
export const PRIVACY_URL = process.env.NEXT_PUBLIC_PRIVACY_URL ?? "";
export const LEGAL_VERSION = "2026-09-06";
export const legalLinksReady = Boolean(TERMS_URL && PRIVACY_URL);
