import { NextResponse } from "next/server";

/** Joining is free; this retired endpoint must never create another fee checkout. */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Professional registration no longer has a joining fee. Continue in the professional portal.",
      redirect: "/worker",
    },
    { status: 410 },
  );
}
