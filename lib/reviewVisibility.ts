export const PUBLIC_REVIEW_MIN_RATING = 4;

export type ReviewVisibility = "public" | "private";
export type ReviewAuthor = "client" | "provider";

export function isPositiveCleanerReview(rating: number) {
  return Math.round(rating) >= PUBLIC_REVIEW_MIN_RATING;
}

export function effectiveReviewVisibility(
  rating: number,
  requested: string | null | undefined,
  reviewer: ReviewAuthor = "client",
): ReviewVisibility {
  if (requested !== "public") return "private";
  if (reviewer === "client" && !isPositiveCleanerReview(rating)) {
    return "private";
  }
  return "public";
}
