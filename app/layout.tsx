import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { SkipToContent } from "@/components/layout/skip-to-content";
import { Notifications } from "@mantine/notifications";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Austin RTASS",
  description: "Radio Transcription Analysis Scoring System (RTASS) for fireground radio training: transcribe radio traffic, evaluate compliance, and generate scorecards with evidence.",
  keywords: ["transcription", "radio", "fireground", "training", "scorecard", "AI", "OpenAI", "Whisper", "GPT"],
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SkipToContent />
        <Providers>
          <Header />
          <main id="main-content" tabIndex={-1} style={{ minHeight: 'calc(100vh - 120px)' }}>
            {children}
          </main>
          <Footer />
          <Notifications position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
