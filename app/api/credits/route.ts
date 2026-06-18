import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("user_credits")
    .select("credits")
    .eq("user_id", user.id)
    .single();

  // 첫 조회 시 신규 유저 → 100 크레딧 지급
  if (!data) {
    await supabase
      .from("user_credits")
      .insert({ user_id: user.id, credits: 100 });
    return NextResponse.json({ credits: 100 });
  }

  return NextResponse.json({ credits: data.credits });
}
