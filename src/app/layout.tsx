import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Manufacturing System - SCADA/MES/Traceability",
  description: "Comprehensive modular manufacturing system with SCADA HMI, MES, traceability, condition monitoring, and edge connectivity.",
  keywords: ["Manufacturing", "SCADA", "MES", "Traceability", "OEE", "Condition Monitoring", "Industry 4.0"],
  authors: [{ name: "Manufacturing Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Manufacturing System",
    description: "Comprehensive manufacturing execution and control system",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
