import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-family-sans",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
  variable: "--font-family-mono",
});

export const metadata: Metadata = {
  title: "Reiz Admin",
  description: "Panel interno Reiz — soporte y operaciones",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontMono.variable} h-full`}
    >
      <body
        className={`${fontSans.className} bg-background flex min-h-full flex-col antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
