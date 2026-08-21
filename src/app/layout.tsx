import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppQueryProvider } from "@/shared/providers/query-provider";

import "@xyflow/react/dist/style.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mindmap",
  description: "구조와 상세 기록을 연결하는 마인드맵",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ko">
      <body><AppQueryProvider>{children}</AppQueryProvider></body>
    </html>
  );
}
