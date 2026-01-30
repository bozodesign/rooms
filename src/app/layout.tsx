import type { Metadata } from "next";
import { Kanit } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/providers/QueryProvider";
import LiffProvider from "@/providers/LiffProvider";
import SWRProvider from "@/providers/SWRProvider";

const kanit = Kanit({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "ระบบจัดการหอพัก",
  description: "Family-run Dormitory Management System",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <head>
        <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
      </head>
      <body className={kanit.className}>
        <SWRProvider>
          <QueryProvider>
            <LiffProvider>{children}</LiffProvider>
          </QueryProvider>
        </SWRProvider>
      </body>
    </html>
  );
}
