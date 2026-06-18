"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function SuccessContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [credits, setCredits] = useState(0);

  useEffect(() => {
    const paymentKey = params.get("paymentKey");
    const orderId = params.get("orderId");
    const amount = Number(params.get("amount"));

    if (!paymentKey || !orderId || !amount) {
      setStatus("error");
      return;
    }

    fetch("/api/payments/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setStatus("error"); return; }
        setCredits(data.credits);
        setStatus("done");
      })
      .catch(() => setStatus("error"));
  }, [params]);

  if (status === "loading") {
    return <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />;
  }

  if (status === "done") {
    return (
      <div className="text-center">
        <div className="text-4xl mb-4">🎉</div>
        <h1 className="text-xl font-semibold text-white mb-2">충전 완료!</h1>
        <p className="text-gray-400 text-sm mb-6">현재 보유 크레딧: <span className="text-white font-semibold">{credits}개</span></p>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-3 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white text-sm font-medium transition-colors"
        >
          대화하러 가기
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="text-4xl mb-4">😢</div>
      <h1 className="text-xl font-semibold text-white mb-2">결제에 실패했어요</h1>
      <button
        onClick={() => router.push("/")}
        className="px-6 py-3 rounded-2xl bg-white/8 hover:bg-white/12 text-white text-sm font-medium transition-colors mt-4"
      >
        돌아가기
      </button>
    </div>
  );
}

export default function PaymentSuccess() {
  return (
    <div className="flex flex-col h-full items-center justify-center bg-[#0f0f10] text-gray-100 px-6">
      <Suspense fallback={<div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />}>
        <SuccessContent />
      </Suspense>
    </div>
  );
}
