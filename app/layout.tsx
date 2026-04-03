import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "PBK PM Inspection",
  description: "Promega BioSystems Korea PM Inspection System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </head>
      <body className="bg-[#f0f2f5]">
        <Sidebar />
        <main className="ml-[260px] min-h-screen p-6">
          {children}
        </main>
      </body>
    </html>
  );
}
