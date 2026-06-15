import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId, role, content } = await request.json();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .single();

  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await supabase.from("messages").insert({ conversation_id: conversationId, role, content });
  await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);

  return NextResponse.json({ ok: true });
}
