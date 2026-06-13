import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "My AI Assistant",
  description: "Claude 기반 AI 어시스턴트",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
