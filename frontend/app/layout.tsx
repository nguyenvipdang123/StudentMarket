import type { Metadata } from "next";
import "./globals.css";
import "./typography.css";
import "./product-card.css";
import "./auth.css";
import "./features.css";
import "./listing-filters.css";
import "./region-picker.css";
import "./search-suggestions.css";
import "./interface.css";
import "./figma.css";
import "./figma-motion.css";
import "./assistant.css";
import "./page-transitions.css";
import "./footer-crowd.css";
import "./robot-widget.css";
import AssistantWidget from "@/components/AssistantWidget";
import RobotWidget from "@/components/RobotWidget";
import PageTransition from "@/components/PageTransition";

export const metadata: Metadata = {
  title: "SangTay | Chợ đồ cũ dành cho sinh viên",
  description: "Mua bán và trao đổi đồ dùng giữa sinh viên. Tìm đồ học tập, công nghệ, nội thất và nhiều món hay với giá dễ thương.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        {process.env.NODE_ENV === "development" && (
          <script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async />
        )}
        <link rel="preload" href="/fonts/dm-serif-display.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/plus-jakarta-400.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
      </head>
      <body><PageTransition>{children}</PageTransition><RobotWidget /><AssistantWidget /></body>
    </html>
  );
}
