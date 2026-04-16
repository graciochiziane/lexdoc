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
  title: "LexDoc — Gestão Documental Jurídica",
  description:
    "Plataforma SaaS de Gestão Documental Jurídica Inteligente — Moçambique",
  keywords: [
    "LexDoc",
    "gestão documental",
    "jurídico",
    "Moçambique",
    "advocacia",
    "SaaS",
    "documentos",
  ],
  authors: [{ name: "LexDoc Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "LexDoc — Gestão Documental Jurídica",
    description: "Plataforma SaaS de Gestão Documental Jurídica Inteligente — Moçambique",
    siteName: "LexDoc",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LexDoc — Gestão Documental Jurídica",
    description: "Plataforma SaaS de Gestão Documental Jurídica Inteligente — Moçambique",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
