import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amount, credits } = await request.json();

  const orderId = `order_${user.id.slice(0, 8)}_${Date.now()}`;

  await supabase.from("payment_orders").insert({
    user_id: user.id,
    order_id: orderId,
    amount,
    credits,
    status: "pending",
  });

  return NextResponse.json({ orderId });
}
