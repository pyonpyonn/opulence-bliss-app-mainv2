"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function reviewChatFlag(formData: FormData) {
  const flagId = Number(formData.get("flagId"));
  const status = String(formData.get("status") ?? "");

  if (!Number.isSafeInteger(flagId) || flagId <= 0) {
    throw new Error("Invalid safety flag.");
  }
  if (status !== "reviewed" && status !== "dismissed") {
    throw new Error("Invalid review decision.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") throw new Error("Administrators only.");

  const { error } = await supabase.rpc("review_chat_moderation_flag", {
    p_flag_id: flagId,
    p_status: status,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/chat-flags");
}
