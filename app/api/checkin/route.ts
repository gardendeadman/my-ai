import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const CHECKIN_CREDITS = 20;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const { data: existing } = await supabase
    .from("daily_checkins")
    .select("last_checkin")
    .eq("user_id", user.id)
    .single();

  if (existing?.last_checkin === today) {
    return NextResponse.json({ error: "already_checked", message: "오늘 이미 출석했어요" }, { status: 400 });
  }

  // 출석 기록 upsert
  await supabase
    .from("daily_checkins")
    .upsert({ user_id: user.id, last_checkin: today });

  // 크레딧 지급
  const { data: creditRow } = await supabase
    .from("user_credits")
    .select("credits")
    .eq("user_id", user.id)
    .single();

  const current = creditRow?.credits ?? 0;
  await supabase
    .from("user_credits")
    .upsert({ user_id: user.id, credits: current + CHECKIN_CREDITS, updated_at: new Date().toISOString() });

  return NextResponse.json({ credits: current + CHECKIN_CREDITS, earned: CHECKIN_CREDITS });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("daily_checkins")
    .select("last_checkin")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({ checked: data?.last_checkin === today });
}
