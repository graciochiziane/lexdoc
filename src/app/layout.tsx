import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "next-themes";
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
    "direito moçambicano",
  ],
  authors: [{ name: "LexDoc Team" }],
  icons: {
    icon: "/logo.png",
  },
  openGraph: {
    title: "LexDoc — Gestão Documental Jurídica",
    description: "Plataforma SaaS de Gestão Documental Jurídica Inteligente — Moçambique",
    siteName: "LexDoc",
    type: "website",
    images: [{ url: "/og-image.png", width: 1344, height: 768, alt: "LexDoc — Gestão Documental Jurídica Inteligente" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LexDoc — Gestão Documental Jurídica",
    description: "Plataforma SaaS de Gestão Documental Jurídica Inteligente — Moçambique",
    images: ["/og-image.png"],
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
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
