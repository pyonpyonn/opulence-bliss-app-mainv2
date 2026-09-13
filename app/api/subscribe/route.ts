import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Memberships are no longer offered. Please book a cleaning visit instead." },
    { status: 410 },
  );
}
