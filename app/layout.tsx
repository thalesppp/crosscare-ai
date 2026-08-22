import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CrossCare AI · 跨境电商售后指挥中心",
  description: "手动巡检演示订单、识别物流异常并生成有政策依据的售后处理建议。",
  metadataBase: new URL(process.env.SITE_ORIGIN ?? "http://localhost:3000"),
  openGraph: {
    title: "CrossCare AI · 跨境售后异常 Agent",
    description: "按需巡检演示订单与物流异常，基于售后政策生成可追溯的处理建议。",
    type: "website",
    locale: "zh_CN",
    images: [{ url: "/og.png", width: 1672, height: 941, alt: "CrossCare AI 跨境售后异常 Agent" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CrossCare AI · 跨境售后异常 Agent",
    description: "按需巡检演示订单与物流异常，基于售后政策生成可追溯的处理建议。",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
