"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function PaymentFail() {
  const router = useRouter();
  const params = useSearchParams();
  const message = params.get("message") ?? "결제가 취소되었어요";

  return (
    <div className="flex flex-col h-full items-center justify-center bg-[#0f0f10] text-gray-100 px-6">
      <div className="text-center">
        <div className="text-4xl mb-4">😢</div>
        <h1 className="text-xl font-semibold text-white mb-2">결제 실패</h1>
        <p className="text-gray-400 text-sm mb-6">{message}</p>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-3 rounded-2xl bg-white/8 hover:bg-white/12 text-white text-sm font-medium transition-colors"
        >
          돌아가기
        </button>
      </div>
    </div>
  );
}
