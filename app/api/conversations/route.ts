import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("conversations")
    .select(`
      id,
      character_id,
      updated_at,
      messages (
        content,
        role,
        created_at
      )
    `)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1, { foreignTable: "messages" })
    .order("created_at", { ascending: false, foreignTable: "messages" });

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { characterId } = await request.json();

  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: user.id, character_id: characterId })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
