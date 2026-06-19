import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "工厂柴油管理系统",
  description: "极简轻量级柴油进出库与车辆油耗管理系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
