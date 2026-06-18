import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY!;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { paymentKey, orderId, amount } = await request.json();

  // 주문 검증
  const { data: order } = await supabase
    .from("payment_orders")
    .select("*")
    .eq("order_id", orderId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .single();

  if (!order) return NextResponse.json({ error: "주문을 찾을 수 없어요" }, { status: 404 });
  if (order.amount !== amount) return NextResponse.json({ error: "금액이 일치하지 않아요" }, { status: 400 });

  // 토스페이먼츠 승인 요청
  const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${TOSS_SECRET_KEY}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });

  if (!tossRes.ok) {
    const err = await tossRes.json();
    await supabase.from("payment_orders").update({ status: "failed" }).eq("order_id", orderId);
    return NextResponse.json({ error: err.message ?? "결제 승인 실패" }, { status: 400 });
  }

  // 크레딧 지급
  const { data: creditRow } = await supabase
    .from("user_credits")
    .select("credits")
    .eq("user_id", user.id)
    .single();

  const current = creditRow?.credits ?? 0;
  await supabase
    .from("user_credits")
    .upsert({ user_id: user.id, credits: current + order.credits, updated_at: new Date().toISOString() });

  await supabase
    .from("payment_orders")
    .update({ status: "done", payment_key: paymentKey })
    .eq("order_id", orderId);

  return NextResponse.json({ credits: current + order.credits });
}
