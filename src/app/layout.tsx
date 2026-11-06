import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], axes: ["opsz"], display: "swap" });

export const metadata: Metadata = {
  title: "Clause — your spend policy, enforced",
  description: "Claude reads your expense policy once. Clause enforces it on every request — instantly, identically, with the clause cited. No AI inside.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
