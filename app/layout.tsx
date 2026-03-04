import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "hoodies神経衰弱",
  description: "20種x2枚で遊ぶ神経衰弱ゲーム"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
