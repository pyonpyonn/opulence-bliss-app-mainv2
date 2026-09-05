// SETUP: mkdir -p "app/api/client-signup" && code "app/api/client-signup/route.ts"
//
// Create a customer account AND their profile in one go, from inside the
// booking flow. No confirmation email — they're mid-purchase.

import { LEGAL_VERSION, legalLinksReady } from "@/lib/legal";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { fullName, email, password, phone, address, postcode, consentAccepted, requireEmailConfirmation } =
      await req.json();

    if (!legalLinksReady) {
      return NextResponse.json({ error: "Registration is unavailable until the Terms & Conditions and Privacy Policy are published." }, { status: 503 });
    }
    if (consentAccepted !== true) {
      return NextResponse.json({ error: "Accept the Terms & Conditions and Privacy Policy before signing up." }, { status: 400 });
    }

    if (!fullName || !email || !password) {
      return NextResponse.json(
        { error: "Please fill in your name, email and a password." },
        { status: 400 }
      );
    }
    if (String(password).length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const consent = { legal_accepted: true, legal_version: LEGAL_VERSION, legal_accepted_at: new Date().toISOString() };
    const credentials = { email: String(email).trim(), password: String(password) };
    const { data: created, error } = requireEmailConfirmation === true
      ? await admin.auth.signUp({ ...credentials, options: { data: consent } })
      : await admin.auth.admin.createUser({ ...credentials, email_confirm: true, user_metadata: consent });

    if (error || !created.user) {
      const msg = error?.message ?? "Could not create your account.";
      const exists = /already|exists|registered/i.test(msg);
      return NextResponse.json(
        {
          error: exists
            ? "There's already an account with that email — sign in instead."
            : msg,
          exists,
        },
        { status: 400 }
      );
    }

    // Profile, filled in properly from the start.
    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: created.user.id,
        email: String(email).trim(),
        role: "customer",
        full_name: String(fullName).trim(),
        phone: phone ? String(phone).trim() : null,
        address: address ? String(address).trim() : null,
        postcode: postcode ? String(postcode).trim().toUpperCase() : null,
      },
      { onConflict: "id" }
    );

    if (profileError) throw profileError;
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sign-up failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}