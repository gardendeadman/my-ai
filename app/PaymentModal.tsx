"use client";

import { useEffect, useRef, useState } from "react";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!;

const PACKAGES = [
  { label: "100 크레딧", credits: 100, amount: 1000 },
  { label: "300 크레딧", credits: 300, amount: 2500 },
  { label: "700 크레딧", credits: 700, amount: 5000 },
];

interface Props {
  onClose: () => void;
  onSuccess: (credits: number) => void;
  userId: string;
}

export default function PaymentModal({ onClose, userId }: Props) {
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handlePay = async () => {
    const pkg = PACKAGES[selected];
    setLoading(true);
    try {
      const res = await fetch("/api/payments/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: pkg.amount, credits: pkg.credits }),
      });
      const { orderId } = await res.json();

      const toss = await loadTossPayments(TOSS_CLIENT_KEY);
      const payment = toss.payment({ customerKey: userId });

      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: pkg.amount },
        orderId,
        orderName: `myai 크레딧 ${pkg.credits}개`,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
      });
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="w-full max-w-sm bg-[#18181a] rounded-3xl border border-white/10 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">크레딧 충전</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="space-y-2 mb-6">
          {PACKAGES.map((pkg, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all text-sm ${
                selected === i
                  ? "border-rose-400/60 bg-rose-500/10 text-white"
                  : "border-white/10 bg-white/4 text-gray-300 hover:bg-white/8"
              }`}
            >
              <span className="font-medium">{pkg.label}</span>
              <span className={selected === i ? "text-rose-300" : "text-gray-500"}>
                {pkg.amount.toLocaleString()}원
              </span>
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-600 text-center mb-4">대화 1회 = 1크레딧 차감</p>

        <button
          onClick={handlePay}
          disabled={loading}
          className="w-full py-3 rounded-2xl bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
        >
          {loading ? "처리 중…" : `${PACKAGES[selected].amount.toLocaleString()}원 결제하기`}
        </button>
      </div>
    </div>
  );
}
