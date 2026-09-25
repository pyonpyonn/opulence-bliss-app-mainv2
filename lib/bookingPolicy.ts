export type BookingFrequency = "one_time" | "weekly" | "monthly";

/** A regular price must never be used for a single-visit checkout. */
export function bookingPolicyError(packageName: string, frequency: string): string | null {
  if (!["one_time", "weekly", "monthly"].includes(frequency)) {
    return "Choose a valid cleaning frequency.";
  }

  if (frequency !== "one_time" && packageName !== "Essential Clean") {
    return "Weekly and monthly bookings use Essential Clean. Choose Essential Clean for six visits, or book this session once.";
  }

  if (packageName === "Essential Clean") {
    if (frequency === "one_time") {
      return "Essential Clean at £18.90 per hour is for bookings of six visits. For one visit, choose One-Time Essential Clean.";
    }
  }

  return null;
}
