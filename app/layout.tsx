import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "vookcat web",
  description: "หน้าไลฟ์ สมาชิก และคลิปย้อนหลัง vookcat web",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
