import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "帰宅鬼ごっこ：終電の影",
  description: "駅で遭遇した鬼から逃げ、隠れながら自宅を目指す3Dサバイバル鬼ごっこ。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
