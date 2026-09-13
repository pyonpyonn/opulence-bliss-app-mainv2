import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Membership syncing has been retired." },
    { status: 410 },
  );
}
