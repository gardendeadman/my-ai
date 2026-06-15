import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, character_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: messages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ ...conversation, messages: messages ?? [] });
}
