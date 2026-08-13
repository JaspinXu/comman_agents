import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "comman_agents · 群像",
  description: "把每个 Agent 当作具体的人：透明配置人格、关系、场景与工具。",
  openGraph: {
    title: "comman_agents · 群像",
    description: "让每个 Agent 成为具体的人。",
    type: "website",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "comman_agents 多 Agent 工作室" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "comman_agents · 群像",
    description: "透明配置人格、场景与工具的多 Agent 工作室。",
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
